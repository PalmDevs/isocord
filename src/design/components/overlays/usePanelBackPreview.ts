import { useEffect, useRef } from 'react'
import { DeviceEventEmitter } from 'react-native'
import { useSharedValue, withTiming } from 'react-native-reanimated'
import { scheduleOnUI } from 'react-native-worklets'
import NativeIsocordBack from '../../../native/NativeIsocordBack'
import {
    ANDROID_PREDICTIVE_BACK_INPUT_TIMING,
    SWIPE_RELEASE_TIMING,
} from '../../tokens/motion'
import type { SharedValue } from 'react-native-reanimated'
import type { BackPreviewFrame, Spec } from '../../../native/NativeIsocordBack'

const DIRECT_PANEL_BACK_TRAVEL = 0
const MAX_PANEL_BACK_TRAVEL = 0.25
const HARDWARE_BACK_EVENT = 'hardwareBackPress'

const previewListeners = new Map<string, (frame: BackPreviewFrame) => void>()
let nextOwner = 0
let dispatchUsers = 0
let subscription: ReturnType<Spec['onBackPreview']> | undefined

function easeOutCubic(t: number) {
    return 1 - (1 - t) ** 3
}

export function dispatchBackPress() {
    DeviceEventEmitter.emit(HARDWARE_BACK_EVENT)
}

export function watchBackPreview(
    overlay: boolean,
    listener: (frame: BackPreviewFrame) => void,
) {
    const back = NativeIsocordBack
    if (!back) return
    const owner = String(++nextOwner)
    previewListeners.set(owner, listener)
    back.watch(owner, true, overlay)
    return () => {
        previewListeners.delete(owner)
        back.watch(owner, false, overlay)
    }
}

/** Routes commits that arrive after the preview owner unmounts. */
export function usePanelBackEvents() {
    useEffect(() => {
        if (!NativeIsocordBack) return
        if (dispatchUsers++ === 0) {
            subscription = NativeIsocordBack.onBackPreview(frame => {
                const listener = previewListeners.get(frame.owner)
                if (listener) listener(frame)
                else if (frame.committed) dispatchBackPress()
            })
        }
        return () => {
            if (--dispatchUsers === 0) {
                subscription?.remove()
                subscription = undefined
            }
        }
    }, [])
}

function panelBackOffset(touchOffset: number, width: number) {
    if (width <= 0) return 0
    // ChannelScreenAnimatedFrame: the closed panel sits at maxWidth.
    const distance = Math.abs(touchOffset)
    const travel = distance / width
    if (travel <= DIRECT_PANEL_BACK_TRAVEL) return distance

    const remaining =
        (Math.min(1, travel) - DIRECT_PANEL_BACK_TRAVEL) /
        (1 - DIRECT_PANEL_BACK_TRAVEL)
    const position =
        DIRECT_PANEL_BACK_TRAVEL +
        (MAX_PANEL_BACK_TRAVEL - DIRECT_PANEL_BACK_TRAVEL) *
            easeOutCubic(remaining)
    return position * width
}

export function usePanelBackPreview(
    target: string | undefined,
    width: number,
    overlay = false,
) {
    const offset = useSharedValue(0)
    const layer = useSharedValue<string | undefined>(undefined)
    const committingTarget = useRef<string | undefined>(undefined)
    useEffect(() => {
        if (!target) return
        let previewing = false
        const restore = () => {
            previewing = false
            offset.set(withTiming(0, SWIPE_RELEASE_TIMING))
        }
        const unwatch = watchBackPreview(overlay, frame => {
            if (frame.finished) {
                if (frame.committed) {
                    committingTarget.current = target
                    try {
                        // BackHandler: panel, composer and overlay priority in one dispatch.
                        dispatchBackPress()
                    } finally {
                        committingTarget.current = undefined
                        restore()
                    }
                    return
                }
                restore()
                return
            }
            previewing = true
            layer.set(target)
            offset.set(
                withTiming(
                    panelBackOffset(frame.offset, width),
                    ANDROID_PREDICTIVE_BACK_INPUT_TIMING,
                ),
            )
        })
        return () => {
            unwatch?.()
            if (previewing) restore()
        }
    }, [layer, offset, overlay, target, width])
    const takeOffset = (panel: string, x: SharedValue<number>) => {
        if (committingTarget.current !== panel) return
        scheduleOnUI(() => {
            'worklet'
            x.set(x.get() + offset.get())
            offset.set(0)
        })
    }
    return { layer, offset, takeOffset }
}

export type PanelBackPreview = ReturnType<typeof usePanelBackPreview>

export function panelBackStyle(x: number, offset: number) {
    'worklet'
    return { transform: [{ translateX: x + offset }] }
}
