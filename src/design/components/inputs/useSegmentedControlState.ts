import { useMemo } from 'react'
import { useSharedValue } from 'react-native-reanimated'
import { usePagerState } from '../layout/usePagerState'
import type { ReactNode } from 'react'
import type { SharedValue } from 'react-native-reanimated'
import type { PagerState } from '../layout/usePagerState'

export interface SegmentedControlItemData {
    id: string
    label: string
    /** Shown above the label. */
    icon?: ReactNode
    /** Content shown by `SegmentedControlPages` when this segment is selected. */
    page?: ReactNode
}

export interface SegmentedControlState extends PagerState {
    items: SegmentedControlItemData[]
    /** Index under the finger, or -1. */
    pressedIndex: SharedValue<number>
}

/** State for a SegmentedControl, created by the parent so other views (a pager, say) can follow it. */
export function useSegmentedControlState({
    items,
    defaultIndex = 0,
    onSetActiveIndex,
}: {
    items: SegmentedControlItemData[]
    defaultIndex?: number
    onSetActiveIndex?: (index: number) => void
}): SegmentedControlState {
    const pager = usePagerState({ defaultIndex, onSetActiveIndex })
    const pressedIndex = useSharedValue(-1)
    // State object keeps its identity: it feeds contexts and native props.
    return useMemo(
        () => ({ ...pager, items, pressedIndex }),
        [pager, items, pressedIndex],
    )
}
