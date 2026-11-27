import { createContext, use, useMemo } from 'react'
import { useSharedValue, withSpring } from 'react-native-reanimated'
import { KEYBOARD_SHEET_SPRING } from '../../../../design/tokens/motion'
import type { SharedValue } from 'react-native-reanimated'

/**
 * The expandable, draggable "sheet keyboard" of the reference (`PortalKeyboardBottomSheet`, a bottom sheet with
 * the snap points `[minimum, maximum]` from `useKeyboardActionSheetHeight`): the panel opens at `min` (the
 * panel's resting height) and can be dragged up to `max`, or down to close it.
 */
export interface PanelSheet {
    /** Height of the sheet on screen: 0 when closed, `min` to `max` when open, or in between while dragged or animating. */
    height: SharedValue<number>
    /** Non-zero while closing: fixed sheet height so closing slides purely by transform without re-layout. */
    closingFrom: SharedValue<number>
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

/** Springs `value` to `to`, starting at `velocity` (px/s, positive grows the sheet). */
export function animateTo(
    value: SharedValue<number>,
    to: number,
    velocity = 0,
    onEnd?: (finished?: boolean) => void,
) {
    'worklet'
    value.set(withSpring(to, { ...KEYBOARD_SHEET_SPRING, velocity }, onEnd))
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
    const height = useSharedValue(0)
    const closingFrom = useSharedValue(0)
    // Memoised for identity: the context value.
    return useMemo(
        () => ({
            height,
            closingFrom,
            min,
            max,
            close,
            expand: () => animateTo(height, max),
            collapse: () => animateTo(height, min),
        }),
        [height, closingFrom, min, max, close],
    )
}
