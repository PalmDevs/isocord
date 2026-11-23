import { useEffect, useId } from 'react'
import { useSharedValue, withTiming } from 'react-native-reanimated'
import NativeIsocordBack from '../../../native/NativeIsocordBack'
import { SWIPE_RELEASE_TIMING } from '../../tokens/motion'

const DIRECT_PANEL_BACK_TRAVEL = 0.15
const MAX_PANEL_BACK_TRAVEL = 0.25

function panelBackOffset(offset: number, width: number) {
    if (width <= 0) return 0
    const travel = Math.abs(offset) / width
    if (travel <= DIRECT_PANEL_BACK_TRAVEL) return offset

    const remaining =
        (Math.min(1, travel) - DIRECT_PANEL_BACK_TRAVEL) /
        (1 - DIRECT_PANEL_BACK_TRAVEL)
    const position =
        DIRECT_PANEL_BACK_TRAVEL +
        (MAX_PANEL_BACK_TRAVEL - DIRECT_PANEL_BACK_TRAVEL) * remaining
    return Math.sign(offset) * position * width
}

export function usePanelBackPreview(
    target: string | undefined,
    width: number,
    overlay = false,
) {
    const id = useId()
    const offset = useSharedValue(0)
    const layer = useSharedValue<string | undefined>(undefined)
    useEffect(() => {
        if (!target) return
        let previewing = false
        const restore = () => {
            previewing = false
            offset.set(withTiming(0, SWIPE_RELEASE_TIMING))
        }
        const subscription = NativeIsocordBack.onBackPreview(frame => {
            if (frame.owner !== id) return
            if (frame.finished) {
                restore()
                return
            }
            previewing = true
            layer.set(target)
            offset.set(panelBackOffset(frame.offset, width))
        })
        NativeIsocordBack.watch(id, true, overlay)
        return () => {
            NativeIsocordBack.watch(id, false, overlay)
            subscription.remove()
            if (previewing) restore()
        }
    }, [id, layer, offset, overlay, target, width])
    return { layer, offset }
}

export type PanelBackPreview = ReturnType<typeof usePanelBackPreview>

export function panelBackStyle(x: number, offset: number) {
    'worklet'
    return { transform: [{ translateX: x + offset }] }
}
