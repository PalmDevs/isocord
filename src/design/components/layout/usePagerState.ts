import { useCallback, useMemo, useRef, useState } from 'react'
import { useSharedValue, withSpring } from 'react-native-reanimated'
import { INDICATOR_SPRING } from '../../tokens/motion'
import type { RefObject } from 'react'
import type { PagerViewRef } from 'react-native-pager-view'
import type { SharedValue } from 'react-native-reanimated'

export interface PagerState {
    /** Fractional while pages are being swiped, otherwise the selected index. */
    activeIndex: SharedValue<number>
    /** The selected index as React state. */
    selectedIndex: number
    /** Selects a page: scrolls the pager when one is attached, otherwise just moves the indicator. */
    setActiveIndex: (index: number) => void
    /** True while a `Pages` view is attached. */
    paged: SharedValue<boolean>
    /** Target index while animating to a tapped page, or -1. */
    targetIndex: SharedValue<number>
    pagerRef: RefObject<PagerViewRef | null>
    onPageSelected: (index: number) => void
    onDragStart: () => void
}

/** Selection state shared between a control (SegmentedControl, Tabs) and the `Pages` it drives. */
export function usePagerState({
    defaultIndex = 0,
    onSetActiveIndex,
}: {
    defaultIndex?: number
    onSetActiveIndex?: (index: number) => void
}): PagerState {
    const activeIndex = useSharedValue(defaultIndex)
    const paged = useSharedValue(false)
    const targetIndex = useSharedValue(-1)
    const pagerRef = useRef<PagerViewRef>(null)
    const [selectedIndex, setSelectedIndex] = useState(defaultIndex)
    const selected = useRef(defaultIndex)
    const target = useRef<number | null>(null)

    const commit = useCallback(
        (index: number) => {
            if (selected.current === index) return
            selected.current = index
            setSelectedIndex(index)
            onSetActiveIndex?.(index)
        },
        [onSetActiveIndex],
    )

    const setActiveIndex = useCallback(
        (index: number) => {
            if (selected.current === index && targetIndex.get() < 0) return
            target.current = index
            targetIndex.set(index)
            activeIndex.set(
                withSpring(index, INDICATOR_SPRING, finished => {
                    'worklet'
                    if (finished && targetIndex.get() === index) {
                        targetIndex.set(-1)
                    }
                }),
            )
            if (paged.get()) {
                pagerRef.current?.setPage(index)
            }
            commit(index)
        },
        [activeIndex, paged, targetIndex, commit],
    )

    // While animating to a tapped page the pager reports every page it passes; only the target counts.
    const onPageSelected = useCallback(
        (index: number) => {
            if (target.current != null && target.current !== index) return
            target.current = null
            targetIndex.set(-1)
            commit(index)
        },
        [targetIndex, commit],
    )

    const onDragStart = useCallback(() => {
        target.current = null
        targetIndex.set(-1)
    }, [targetIndex])

    // State object keeps its identity: it feeds contexts and native props.
    return useMemo(
        () => ({
            activeIndex,
            selectedIndex,
            setActiveIndex,
            paged,
            targetIndex,
            pagerRef,
            onPageSelected,
            onDragStart,
        }),
        [
            activeIndex,
            selectedIndex,
            setActiveIndex,
            paged,
            targetIndex,
            onPageSelected,
            onDragStart,
        ],
    )
}
