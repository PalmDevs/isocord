import { useMemo } from 'react'
import { usePagerState } from './usePagerState'
import type { ReactNode } from 'react'
import type { PagerState } from './usePagerState'

export interface TabItem {
    key: string
    label: string
    /** Badge shown after the label. */
    count?: number
    /** Content shown by `TabsPages` when this tab is selected. */
    page?: ReactNode
}

export interface TabsState extends PagerState {
    items: TabItem[]
}

/** State for a Tabs strip, created by the parent so `TabsPages` can follow it. */
export function useTabsState({
    items,
    defaultIndex,
    onSetActiveIndex,
}: {
    items: TabItem[]
    defaultIndex?: number
    onSetActiveIndex?: (index: number) => void
}): TabsState {
    const pager = usePagerState({ defaultIndex, onSetActiveIndex })
    // State object keeps its identity: it feeds contexts.
    return useMemo(() => ({ ...pager, items }), [pager, items])
}
