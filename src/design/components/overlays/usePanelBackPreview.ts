import { useEffect, useId, useRef } from 'react'
import { DeviceEventEmitter } from 'react-native'
import { useSharedValue, withTiming } from 'react-native-reanimated'
import { scheduleOnUI } from 'react-native-worklets'
import NativeIsocordBack from '../../../native/NativeIsocordBack'
import {
    PANEL_ANDROID_PREDICTIVE_BACK_INPUT_TIMING,
    SWIPE_RELEASE_TIMING,
} from '../../tokens/motion'
import type { SharedValue } from 'react-native-reanimated'
import type { BackPreviewFrame } from '../../../native/NativeIsocordBack'

const DIRECT_PANEL_BACK_TRAVEL = 0
const MAX_PANEL_BACK_TRAVEL = 0.25
const HARDWARE_BACK_EVENT = 'hardwareBackPress'

const previewListeners = new Map<string, (frame: BackPreviewFrame) => void>()
let dispatchUsers = 0
let subscription: ReturnType<typeof NativeIsocordBack.onBackPreview> | undefined

function easeOutCubic(t: number) {
    return 1 - (1 - t) ** 3
}

/** Routes commits that arrive after the preview owner unmounts. */
export function usePanelBackEvents() {
    useEffect(() => {
        if (dispatchUsers++ === 0) {
            subscription = NativeIsocordBack.onBackPreview(frame => {
                const listener = previewListeners.get(frame.owner)
                if (listener) listener(frame)
                else if (frame.committed)
                    DeviceEventEmitter.emit(HARDWARE_BACK_EVENT)
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
    const id = useId()
    const offset = useSharedValue(0)
    const layer = useSharedValue<string | undefined>(undefined)
    const committingTarget = useRef<string | undefined>(undefined)
    const registrations = useRef(0)
    useEffect(() => {
        if (!target) return
        const owner = `${id}:${++registrations.current}`
        let previewing = false
        const restore = () => {
            previewing = false
            offset.set(withTiming(0, SWIPE_RELEASE_TIMING))
        }
        previewListeners.set(owner, frame => {
            if (frame.finished) {
                if (frame.committed) {
                    committingTarget.current = target
                    try {
                        // BackHandler: panel, composer and overlay priority in one dispatch.
                        DeviceEventEmitter.emit(HARDWARE_BACK_EVENT)
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
                    PANEL_ANDROID_PREDICTIVE_BACK_INPUT_TIMING,
                ),
            )
        })
        NativeIsocordBack.watch(owner, true, overlay)
        return () => {
            previewListeners.delete(owner)
            NativeIsocordBack.watch(owner, false, overlay)
            if (previewing) restore()
        }
    }, [id, layer, offset, overlay, target, width])
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
