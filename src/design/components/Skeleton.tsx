import { use, useEffect } from 'react'
import Animated, {
    cancelAnimation,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withRepeat,
    withTiming,
} from 'react-native-reanimated'
import { useUnistyles } from 'react-native-unistyles'
import { SkeletonPausedContext } from './skeletonUtils'
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native'
import type { SemanticColor } from '../tokens'

/**
 * Pulses everything inside between `from` and `to` opacity, so a whole skeleton shares one animation.
 * Defaults to UserPlaceholderRow's pulse (1 to 0.3, 2 x 600ms, reversing); the chat placeholder uses 0.3 to 0.7.
 * Still while a `SkeletonPausedContext` above says so.
 */
export function SkeletonPulse({
    children,
    from = 1,
    to = 0.3,
    duration = 1200,
    style,
}: {
    children: React.ReactNode
    from?: number
    to?: number
    duration?: number
    style?: StyleProp<ViewStyle>
}) {
    const reduced = useReducedMotion()
    const paused = use(SkeletonPausedContext)
    const opacity = useSharedValue(from)
    useEffect(() => {
        if (reduced || paused) return
        opacity.set(withRepeat(withTiming(to, { duration }), -1, true))
        return () => cancelAnimation(opacity)
    }, [reduced, paused, to, duration, opacity])
    const animated = useAnimatedStyle(() => ({ opacity: opacity.get() }))
    return (
        <Animated.View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[style, animated]}
        >
            {children}
        </Animated.View>
    )
}

/** A flat placeholder block; wrap a group of them in a `SkeletonPulse`. */
export function Skeleton({
    width,
    height,
    radius = 8,
    color = 'BORDER_SUBTLE',
    style,
}: {
    width?: DimensionValue
    height: number
    radius?: number
    color?: SemanticColor
    style?: StyleProp<ViewStyle>
}) {
    const { theme } = useUnistyles()
    return (
        <Animated.View
            style={[
                {
                    width,
                    height,
                    borderRadius: radius,
                    backgroundColor: theme.colors[color],
                },
                style,
            ]}
        />
    )
}
