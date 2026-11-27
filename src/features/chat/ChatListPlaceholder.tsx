import { View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { Skeleton } from '../../design/components/Skeleton'
import { ThemedGradient } from '../../design/components/ThemedGradient'
import { avatarSize } from '../../native/IsocordConstants'

const MESSAGE_WIDTHS = [
    '75%',
    '88%',
    '61%',
    '91%',
    '69%',
    '79%',
    '70%',
    '90%',
    '55%',
    '85%',
    '65%',
    '80%',
] as const

/** ChatPlaceholder while the native list is deferred. */
export function ChatListPlaceholder({
    showSkeleton,
    top,
}: {
    showSkeleton: boolean
    /** Its offset from the panel's top, so its gradient lines up with the panel's. */
    top: number
}) {
    const { theme } = useUnistyles()
    const { PX_16: lineHeight } = theme.space
    return (
        <View style={styles.messages} pointerEvents="none">
            {/* Hides the native list drawing below on a gradient theme. */}
            <ThemedGradient
                overlays={[theme.colors.BACKGROUND_BASE_LOWER]}
                offset={{ x: 0, y: top }}
            />
            {showSkeleton &&
                MESSAGE_WIDTHS.map(width => (
                    <View key={width} style={styles.message}>
                        <Skeleton
                            width={avatarSize}
                            height={avatarSize}
                            radius={avatarSize / 2}
                        />
                        <View style={styles.lines}>
                            <Skeleton width="40%" height={lineHeight} />
                            <Skeleton width={width} height={lineHeight} />
                        </View>
                    </View>
                ))}
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    messages: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'flex-end',
        overflow: 'hidden',
        paddingHorizontal: theme.space.PX_12,
        paddingBottom: theme.space.PX_48,
        gap: theme.space.PX_24,
        // Not `undefined`: a theme change restyles in place, and an absent value keeps the old colour.
        backgroundColor: theme.background
            ? 'transparent'
            : theme.colors.BACKGROUND_BASE_LOWER,
    },
    message: { flexDirection: 'row', gap: theme.space.PX_12, opacity: 0.5 },
    lines: { flex: 1, gap: theme.space.PX_12 },
}))
