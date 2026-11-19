import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
    cancelAnimation,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated'
import { StyleSheet } from 'react-native-unistyles'
import {
    TYPING_ELLIPSIS_MS,
    TYPING_ELLIPSIS_STAGGER_MS,
    TYPING_ELLIPSIS_START_DELAY_MS,
} from '../tokens/motion'
import type { SharedValue } from 'react-native-reanimated'

const FROM_OPACITY = 0.4
const FROM_SCALE = 0.75
const DOTS = [0, 1, 2]

/** animateValue: one rise and fall per cycle, at the dot's turn; every dot's cycle is the same length. */
function pulse(value: SharedValue<number>, from: number, index: number) {
    const endDelay =
        TYPING_ELLIPSIS_START_DELAY_MS +
        TYPING_ELLIPSIS_STAGGER_MS * (DOTS.length - 1 - index)
    value.set(
        withRepeat(
            withSequence(
                withDelay(
                    TYPING_ELLIPSIS_START_DELAY_MS,
                    withTiming(from, { duration: 0 }),
                ),
                withDelay(
                    TYPING_ELLIPSIS_STAGGER_MS * index,
                    withSequence(
                        withTiming(1, { duration: TYPING_ELLIPSIS_MS }),
                        withTiming(from, { duration: TYPING_ELLIPSIS_MS }),
                    ),
                ),
                withDelay(endDelay, withTiming(from, { duration: 0 })),
            ),
            -1,
        ),
    )
}

/** AnimatedEllipsisDot. */
function Dot({ index }: { index: number }) {
    const opacity = useSharedValue(FROM_OPACITY)
    const scale = useSharedValue(FROM_SCALE)
    useEffect(() => {
        pulse(opacity, FROM_OPACITY, index)
        pulse(scale, FROM_SCALE, index)
        return () => {
            cancelAnimation(opacity)
            cancelAnimation(scale)
        }
    }, [index, opacity, scale])
    const animated = useAnimatedStyle(() => ({
        opacity: opacity.get(),
        transform: [{ scale: scale.get() }],
    }))
    return <Animated.View style={[styles.dot, animated]} />
}

/** design/void Ellipsis: the typing indicator's three dots, pulsing one after another; still with reduced motion. */
export function Ellipsis() {
    const reducedMotion = useReducedMotion()
    return (
        <View style={styles.row}>
            {DOTS.map(index =>
                reducedMotion ? (
                    <View key={index} style={[styles.dot, styles.still]} />
                ) : (
                    <Dot key={index} index={index} />
                ),
            )}
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: theme.space.PX_4,
    },
    dot: {
        width: 6,
        height: 6,
        marginRight: 2,
        borderRadius: theme.radii.round,
        backgroundColor: theme.colors.TEXT_DEFAULT,
    },
    still: { opacity: FROM_OPACITY },
}))
