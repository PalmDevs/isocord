import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withTiming,
} from 'react-native-reanimated'
import { StyleSheet } from 'react-native-unistyles'
import { ELLIPSIS_STAGGER_MS, ELLIPSIS_TIMING } from '../../tokens/motion'
import type { SemanticColor } from '../../tokens'

export type EllipsisSize = 'xs' | 'sm' | 'md' | 'lg'

function Dot({
    index,
    size,
    color,
}: {
    index: number
    size: EllipsisSize
    color: SemanticColor
}) {
    const progress = useSharedValue(0)
    useEffect(() => {
        progress.value = withDelay(
            ELLIPSIS_STAGGER_MS * index,
            withRepeat(withTiming(1, ELLIPSIS_TIMING), -1, true),
        )
    }, [index, progress])
    const animated = useAnimatedStyle(() => ({
        opacity: 0.4 + 0.6 * progress.value,
        transform: [{ scale: 0.75 + 0.25 * progress.value }],
    }))
    return (
        <Animated.View
            style={[styles.dot(size, color, index === 2), animated]}
        />
    )
}

/** Three pulsing dots shown in place of a button label while it loads (ButtonEllipsis). */
export function ButtonEllipsis({
    size = 'md',
    color,
}: {
    size?: EllipsisSize
    color: SemanticColor
}) {
    return (
        <View style={styles.row}>
            {[0, 1, 2].map(index => (
                <Dot key={index} index={index} size={size} color={color} />
            ))}
        </View>
    )
}

const DOT_SIZES = { xs: 5, sm: 6, md: 6, lg: 8 } as const
const DOT_GAPS = { xs: 3, sm: 4, md: 4, lg: 4 } as const

const styles = StyleSheet.create(theme => ({
    row: { flexDirection: 'row', alignItems: 'center' },
    dot: (size: EllipsisSize, color: SemanticColor, last: boolean) => ({
        width: DOT_SIZES[size],
        height: DOT_SIZES[size],
        borderRadius: theme.radii.round,
        marginEnd: last ? 0 : DOT_GAPS[size],
        backgroundColor: theme.colors[color],
    }),
}))
