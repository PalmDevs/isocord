import { useMemo } from 'react'
import { scheduleOnRN } from 'react-native-worklets'
import { SheetDragContext } from '../../../../design/components/sheets/sheetDragContext'
import { animateTo, PanelSheetContext } from './usePanelSheet'
import type { ReactNode } from 'react'
import type { PanelSheet } from './usePanelSheet'

/** Release speed (px/s) above which a drag flings to the next snap point instead of the nearest. */
const FLING_VELOCITY = 600

/** Where a drag released at `current` should settle: closed (0), `min` or `max`. */
function pickSnap(current: number, velocity: number, min: number, max: number) {
    'worklet'
    if (velocity > FLING_VELOCITY) return current > min + 1 ? min : 0
    if (velocity < -FLING_VELOCITY) return current < min - 1 ? min : max
    const toClosed = current
    const toMin = Math.abs(current - min)
    const toMax = Math.abs(current - max)
    const nearest = Math.min(toClosed, toMin, toMax)
    if (nearest === toClosed) return 0
    return nearest === toMin ? min : max
}

/**
 * Provides the panel's sheet to its content: `usePanelSheet` for the panel's own needs, and the drag API the
 * shared `SheetDrag` moves the sheet with.
 */
export function PanelSheetProvider({
    value,
    children,
}: {
    value: PanelSheet
    children?: ReactNode
}) {
    const { height, min, max, close } = value
    // Memoised for identity: the context value.
    const drag = useMemo(
        () => ({
            height,
            max,
            release: (velocityY: number) => {
                'worklet'
                const target = pickSnap(height.get(), velocityY, min, max)
                if (target === 0) {
                    scheduleOnRN(close)
                    return
                }
                // The spring carries the finger's speed (positive is down, the sheet grows up).
                animateTo(height, target, -velocityY)
            },
        }),
        [height, min, max, close],
    )
    return (
        <PanelSheetContext value={value}>
            <SheetDragContext value={drag}>{children}</SheetDragContext>
        </PanelSheetContext>
    )
}
