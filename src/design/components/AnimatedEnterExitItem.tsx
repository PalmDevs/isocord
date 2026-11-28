import { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import Animated, {
    FadeIn,
    FadeOut,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated'
import { StyleSheet } from 'react-native-unistyles'
import { scheduleOnRN } from 'react-native-worklets'
import { ROW_ENTER_EXIT_TIMING } from '../tokens/motion'
import type { ComponentProps, ReactNode } from 'react'
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native'

type Entering = ComponentProps<typeof Animated.View>['entering']
type Exiting = ComponentProps<typeof Animated.View>['exiting']

export interface AnimatedEnterExitItemProps {
    children?: ReactNode
    /** Animation on mount; defaults to a fade in. Pass `null` to skip. */
    entering?: Entering | null
    /** Animation on unmount; defaults to a fade out. Pass `null` to skip. */
    exiting?: Exiting | null
    style?: StyleProp<ViewStyle>
    /**
     * Grows the height from 0 while fading in, so the rows below slide. `entering={null}` skips it. The exit runs
     * while `leaving`, then `onExited` fires: keep the item mounted until then (`useEnterExitItems`).
     */
    animateHeight?: boolean
    leaving?: boolean
    onExited?: () => void
}

/**
 * Wraps a list item so it animates in on mount and out on unmount. The reference tracks transition
 * states in a store and calls cleanUp after the exit; Reanimated's layout animations do that natively.
 */
export function AnimatedEnterExitItem({
    children,
    entering = FadeIn,
    exiting = FadeOut,
    style,
    animateHeight,
    leaving = false,
    onExited,
}: AnimatedEnterExitItemProps) {
    if (animateHeight)
        return (
            <HeightItem
                enter={entering !== null}
                leaving={leaving}
                onExited={onExited}
                style={style}
            >
                {children}
            </HeightItem>
        )
    return (
        <Animated.View
            entering={entering ?? undefined}
            exiting={exiting ?? undefined}
            style={style}
        >
            {children}
        </Animated.View>
    )
}

/** Not measured yet. */
const UNMEASURED = -1

/** Clips its child to `progress` of its measured height, fading with it. */
function HeightItem({
    children,
    enter,
    leaving,
    onExited,
    style,
}: {
    children?: ReactNode
    enter: boolean
    leaving: boolean
    onExited?: () => void
    style?: StyleProp<ViewStyle>
}) {
    const progress = useSharedValue(enter ? 0 : 1)
    const height = useSharedValue(UNMEASURED)
    const measured = useRef(false)

    /** Grows in, or shrinks away and reports the exit. */
    const run = () =>
        progress.set(
            withTiming(leaving ? 0 : 1, ROW_ENTER_EXIT_TIMING, finished => {
                if (finished && leaving && onExited) scheduleOnRN(onExited)
            }),
        )

    // A leaving item shrinks away; one that comes back before it is gone grows again.
    // biome-ignore lint/correctness/useExhaustiveDependencies: runs when `leaving` flips, after the first measure.
    useEffect(() => {
        if (measured.current) run()
    }, [leaving])

    const onLayout = (event: LayoutChangeEvent) => {
        height.set(event.nativeEvent.layout.height)
        if (measured.current) return
        measured.current = true
        if (enter || leaving) run()
    }

    const animated = useAnimatedStyle(() => {
        const natural = height.get()
        // Unmeasured: an entering item starts collapsed, any other keeps its own height.
        if (natural === UNMEASURED)
            return progress.get() === 0
                ? { opacity: 0, height: 0 }
                : { opacity: 1 }
        return { opacity: progress.get(), height: natural * progress.get() }
    })

    return (
        <Animated.View style={[styles.clip, style, animated]}>
            {/* Lays out at its natural height inside the clipped box, which is what gets measured. */}
            <View onLayout={onLayout}>{children}</View>
        </Animated.View>
    )
}

const styles = StyleSheet.create({ clip: { overflow: 'hidden' } })

interface EnterExitEntry<T> {
    key: string
    item: T
    /** Gone from `items`, still shown while it animates out. */
    leaving: boolean
    /** Added after the first render, so it animates in. */
    enter: boolean
}

interface EnterExitState<T> {
    items: readonly T[]
    resetKey: string
    entries: EnterExitEntry<T>[]
}

const settled = <T,>(items: readonly T[], keyOf: (item: T) => string) =>
    items.map(item => ({
        key: keyOf(item),
        item,
        leaving: false,
        enter: false,
    }))

/** Returns `items` in their new order, with removed entries kept as leaving at their old index. */
function merge<T>(
    entries: EnterExitEntry<T>[],
    items: readonly T[],
    keyOf: (item: T) => string,
): EnterExitEntry<T>[] {
    const old = new Map(entries.map(entry => [entry.key, entry]))
    const next = items.map(item => {
        const key = keyOf(item)
        const entry = old.get(key)
        return { key, item, leaving: false, enter: entry?.enter ?? true }
    })
    const present = new Set(next.map(entry => entry.key))
    entries.forEach((entry, index) => {
        if (present.has(entry.key)) return
        next.splice(Math.min(index, next.length), 0, {
            ...entry,
            leaving: true,
        })
    })
    return next
}

/**
 * Keeps removed items rendered, marked `leaving`, until `onExited` drops them, for `AnimatedEnterExitItem`'s height
 * animation. Items of the first render, or after `resetKey` changes (a recycled list cell), don't animate in.
 * `items` must keep its identity until it changes, like a store selector's result.
 */
export function useEnterExitItems<T>(
    items: readonly T[],
    keyOf: (item: T) => string,
    resetKey: string,
) {
    const [state, setState] = useState<EnterExitState<T>>(() => ({
        items,
        resetKey,
        entries: settled(items, keyOf),
    }))
    let current = state
    if (state.items !== items || state.resetKey !== resetKey) {
        current = {
            items,
            resetKey,
            entries:
                state.resetKey === resetKey
                    ? merge(state.entries, items, keyOf)
                    : settled(items, keyOf),
        }
        setState(current)
    }
    const onExited = (key: string) =>
        setState(previous => ({
            ...previous,
            entries: previous.entries.filter(
                entry => entry.key !== key || !entry.leaving,
            ),
        }))
    return { entries: current.entries, onExited }
}
