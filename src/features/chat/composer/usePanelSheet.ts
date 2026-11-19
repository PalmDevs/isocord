import { createContext, use, useMemo } from 'react'
import { useSharedValue, withTiming } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { KEYBOARD_SHEET_TIMING } from '../../../design/tokens/motion'
import type { SharedValue } from 'react-native-reanimated'

/**
 * The expandable, draggable "sheet keyboard" of the reference (`PortalKeyboardBottomSheet`, a bottom sheet with
 * the snap points `[minimum, maximum]` from `useKeyboardActionSheetHeight`): the panel opens at `min` (the
 * keyboard's height) and can be dragged up to `max`, or down to close it.
 */
export interface PanelSheet {
    /** Height of the sheet on screen: `min` to `max` when open; less than `min` while it is dragged towards closing. */
    height: SharedValue<number>
    min: number
    max: number
    /** Snaps to `max`. */
    expand: () => void
    /** Snaps back to `min`. */
    collapse: () => void
    /** Closes the panel (the composer stays). */
    close: () => void
}

export const PanelSheetContext = createContext<PanelSheet | null>(null)

/** The sheet the calling panel is shown in, or null when it is used outside the keyboard area. */
export const usePanelSheet = () => use(PanelSheetContext)

export function animateTo(
    value: SharedValue<number>,
    to: number,
    onEnd?: () => void,
) {
    'worklet'
    const callback = (finished?: boolean) => {
        'worklet'
        if (finished && onEnd) scheduleOnRN(onEnd)
    }
    value.set(
        // Like the keyboard it stands in for; no overshoot past a snap point.
        withTiming(to, KEYBOARD_SHEET_TIMING, callback),
    )
}

/** State and controls of the sheet, for the keyboard area that draws it. */
export function useSheetController({
    min,
    max,
    close,
}: {
    min: number
    max: number
    close: () => void
}): PanelSheet {
    const height = useSharedValue(min)
    // Memoised for identity: the context value.
    return useMemo(
        () => ({
            height,
            min,
            max,
            close,
            expand: () => animateTo(height, max),
            collapse: () => animateTo(height, min),
        }),
        [height, min, max, close],
    )
}
