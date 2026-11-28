import { useEffect } from 'react'
import { useSharedValue, withSpring } from 'react-native-reanimated'
import { create } from 'zustand'
import { OVERLAY_INSET_SPRING } from '../../tokens/motion'
import type { SharedValue } from 'react-native-reanimated'

interface OverlayInsetsState {
    /** Height of the bottom bar that is on screen (the tab bar), 0 while none shows. */
    bar: number
    /** Screens that slide over the bar and hide it: an open chat. */
    covers: number
    /** Bottom space taken above the bar, by the key of the overlay that takes it. */
    overlays: Readonly<Record<string, number>>
}

const overlayInsetsStore = create<OverlayInsetsState>(() => ({
    bar: 0,
    covers: 0,
    overlays: {},
}))

/**
 * Returns the bottom space that overlays float over a page: the voice dock, and whatever docks above the tab bar
 * later. Pages end their scrolling content with `OverlaySpacer`, which animates it. This number is for what can
 * only take one, such as a native list's padding prop.
 */
export function useOverlayInset(): number {
    return overlayInsetsStore(state => {
        let total = 0
        for (const key in state.overlays) total += state.overlays[key] ?? 0
        return total
    })
}

/**
 * Returns the overlay inset as a shared value that springs to each new inset, for views that follow the overlays
 * on the UI thread. It starts at the current inset without animating.
 */
export function useAnimatedOverlayInset(): SharedValue<number> {
    const inset = useOverlayInset()
    const animated = useSharedValue(inset)
    useEffect(() => {
        animated.set(withSpring(inset, OVERLAY_INSET_SPRING))
    }, [animated, inset])
    return animated
}

/** Returns the height of the bottom bar while its screen is shown, covered or not. 0 under a pushed screen. */
export function useTabBarHeight(): number {
    return overlayInsetsStore(state => state.bar)
}

/** Returns whether a panel covers the bottom bar or is on its way in, such as a chat. */
export function useBottomBarCovered(): boolean {
    return overlayInsetsStore(state => state.covers > 0)
}

/** Reports the bottom bar's height while it is the screen shown. Pass 0 when it is not. */
export function useReportBottomBar(height: number): void {
    useEffect(() => {
        overlayInsetsStore.setState({ bar: height })
        return () => overlayInsetsStore.setState({ bar: 0 })
    }, [height])
}

/** Marks the bottom bar as covered while `covered` is true, for a panel that slides over it. */
export function useCoverBottomBar(covered: boolean): void {
    useEffect(() => {
        if (!covered) return
        overlayInsetsStore.setState(state => ({ covers: state.covers + 1 }))
        return () =>
            overlayInsetsStore.setState(state => ({ covers: state.covers - 1 }))
    }, [covered])
}

/** Registers the bottom space an overlay takes above the bar, under a key of its own. Pass 0 to release it. */
export function useReportOverlayInset(key: string, size: number): void {
    useEffect(() => {
        if (size <= 0) return
        overlayInsetsStore.setState(state => ({
            overlays: { ...state.overlays, [key]: size },
        }))
        return () =>
            overlayInsetsStore.setState(state => {
                const { [key]: _released, ...rest } = state.overlays
                return { overlays: rest }
            })
    }, [key, size])
}
