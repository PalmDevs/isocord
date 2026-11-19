import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { Text } from './Text'
import type { SemanticColor } from '../tokens'

/** Mention count pill. `ring` is the colour of the surface behind it, drawn as a cut-out border: a token or a `#rrggbb` blend. */
export function Badge({
    count,
    ring,
    lowImportance = false,
}: {
    count: number
    ring?: SemanticColor | `#${string}`
    /** A mention that is not for the user directly (isMentionLowImportance): gray, not red. */
    lowImportance?: boolean
}) {
    if (count <= 0) return null
    return (
        <View
            style={[
                styles.badge,
                lowImportance && styles.lowImportance,
                ring && styles.ring(ring),
            ]}
        >
            <Text variant="text-xxs/bold" color="WHITE" style={styles.text}>
                {count > 999 ? `${Math.floor(count / 1000)}k+` : count}
            </Text>
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    // design/void/Badge: BADGE_SIZE (16) tall and wide at least, BADGE_PADDING (3) at the sides, radius PX_8.
    badge: {
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        backgroundColor: theme.colors.BACKGROUND_FEEDBACK_NOTIFICATION,
    },
    // design/void/Badge `lowImportanceMention`.
    lowImportance: { backgroundColor: theme.colors.BACKGROUND_MOD_STRONG },
    // Reference badge text: ggsans-Bold 12px on a 12px line (Android), at least BADGE_SIZE - 2 * BADGE_PADDING (10) wide.
    text: {
        fontFamily: 'ggsans-Bold',
        fontSize: 12,
        lineHeight: 12,
        minWidth: 10,
        textAlign: 'center',
        textAlignVertical: 'center',
    },
    // computeGuildsBarCutout: the badge size plus BADGE_PADDING on every side, fully rounded.
    ring: (color: SemanticColor | `#${string}`) => ({
        boxSizing: 'content-box',
        borderWidth: 3,
        borderRadius: 11,
        borderColor: color.startsWith('#')
            ? color
            : theme.colors[color as SemanticColor],
    }),
}))
