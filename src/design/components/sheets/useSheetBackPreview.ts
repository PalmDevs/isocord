import { useEffect } from 'react'
import {
    cancelAnimation,
    Extrapolation,
    interpolate,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated'
import {
    ANDROID_PREDICTIVE_BACK_INPUT_TIMING,
    SWIPE_RELEASE_TIMING,
} from '../../tokens/motion'
import {
    dispatchBackPress,
    watchBackPreview,
} from '../overlays/usePanelBackPreview'
import { useSheetStore } from './sheetStore'

const MIN_BACK_SCALE = 0.9

export function useSheetBackPreview(key: string | undefined, width: number) {
    const scale = useSharedValue(1)
    useEffect(() => {
        if (key === undefined || width <= 0) return
        scale.set(1)
        let previewing = false
        const restore = () => scale.set(withTiming(1, SWIPE_RELEASE_TIMING))
        const unwatch = watchBackPreview(true, frame => {
            if (frame.finished) {
                previewing = false
                if (frame.committed) {
                    cancelAnimation(scale)
                    dispatchBackPress()
                    // ActionSheetStore: keep the release scale through the dismissal slide.
                    if (
                        useSheetStore
                            .getState()
                            .sheets.find(sheet => sheet.key === key)?.closing
                    )
                        return
                }
                restore()
                return
            }
            previewing = true
            const nextScale = interpolate(
                Math.abs(frame.offset),
                [0, width],
                [1, MIN_BACK_SCALE],
                Extrapolation.CLAMP,
            )
            scale.set(
                withTiming(nextScale, ANDROID_PREDICTIVE_BACK_INPUT_TIMING),
            )
        })
        return () => {
            unwatch?.()
            if (previewing) restore()
        }
    }, [key, scale, width])
    return scale
}
