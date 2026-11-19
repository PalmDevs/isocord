import { useEffect, useState } from 'react'
import { View } from 'react-native'
import PagerView from 'react-native-pager-view'
import Animated, { useEvent } from 'react-native-reanimated'
import { StyleSheet } from 'react-native-unistyles'
import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import type { PagerState } from './usePagerState'

const AnimatedPagerView = Animated.createAnimatedComponent(PagerView)

/** How long the pages beside the selected one wait after it, so it mounts in a commit of its own (SearchTabsPage). */
const NEIGHBOURS_DELAY_MS = 10

export interface PageData {
    id: string
    page?: ReactNode
}

export interface PagesProps {
    state: PagerState
    pages: PageData[]
    /** Pages within this distance of the selected one are mounted ahead of time. */
    preload?: number
    /** Keep a page mounted after it has been visited. */
    keepMounted?: boolean
    /** Builds only the selected page, as while the screen slides in: the others would drop its frames. */
    holdNeighbours?: boolean
    /** The page selected at first is laid out (a screen slides in after it). */
    onSelectedLayout?: () => void
    scrollEnabled?: boolean
    style?: StyleProp<ViewStyle>
}

/** Natively swipeable pages that follow and drive a `PagerState`. Pages mount lazily, as the selection nears them. */
export function Pages({
    state,
    pages,
    preload = 1,
    keepMounted = true,
    holdNeighbours = false,
    onSelectedLayout,
    scrollEnabled = true,
    style,
}: PagesProps) {
    const {
        activeIndex,
        selectedIndex,
        paged,
        pagerRef,
        onPageSelected,
        onDragStart,
    } = state
    const [initialPage] = useState(selectedIndex)
    const [visited, setVisited] = useState<ReadonlySet<number>>(() => new Set())
    const [previousIndex, setPreviousIndex] = useState(selectedIndex)
    // The selected page mounts first; the others follow in a commit of their own.
    const [first, setFirst] = useState(true)
    useEffect(() => {
        const timer = setTimeout(() => setFirst(false), NEIGHBOURS_DELAY_MS)
        return () => clearTimeout(timer)
    }, [])
    const held = first || holdNeighbours

    // Programmatic jumps scroll through every page in between, so those must be mounted
    // for the whole trip or they flash blank. Mount the full span between old and new selection.
    const low = Math.min(previousIndex, selectedIndex)
    const high = Math.max(previousIndex, selectedIndex)
    const shown = pages.map(
        (_, index) =>
            index === selectedIndex ||
            (!held &&
                (Math.abs(index - selectedIndex) <= preload ||
                    (index >= low && index <= high) ||
                    (keepMounted && visited.has(index)))),
    )
    if (
        keepMounted &&
        shown.some((show, index) => show && !visited.has(index))
    ) {
        setVisited(
            new Set(shown.flatMap((show, index) => (show ? [index] : []))),
        )
    }
    // Once the pager settles, the span collapses back to the selected page.
    useEffect(() => {
        if (previousIndex === selectedIndex) return
        const timeout = setTimeout(() => setPreviousIndex(selectedIndex), 600)
        return () => clearTimeout(timeout)
    }, [previousIndex, selectedIndex])

    useEffect(() => {
        paged.set(true)
        return () => paged.set(false)
    }, [paged])

    const onPageScroll = useEvent(
        (event: { position: number; offset: number }) => {
            'worklet'
            activeIndex.set(event.position + event.offset)
        },
        ['onPageScroll'],
    )

    return (
        <AnimatedPagerView
            ref={pagerRef}
            style={[styles.pager, style]}
            initialPage={initialPage}
            scrollEnabled={scrollEnabled}
            onPageScroll={onPageScroll as never}
            onPageSelected={event => onPageSelected(event.nativeEvent.position)}
            onPageScrollStateChanged={event => {
                if (event.nativeEvent.pageScrollState === 'dragging')
                    onDragStart()
            }}
        >
            {pages.map((page, index) => (
                <View
                    key={page.id}
                    collapsable={false}
                    onLayout={
                        index === initialPage ? onSelectedLayout : undefined
                    }
                >
                    {shown[index] ? page.page : null}
                </View>
            ))}
        </AnimatedPagerView>
    )
}

const styles = StyleSheet.create({
    pager: { flex: 1 },
})
