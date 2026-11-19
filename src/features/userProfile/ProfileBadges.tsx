import { Image } from 'expo-image'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { badgeIconUrl } from '../../core/discord/cdn'
import { RipplePressable } from '../../design/components/buttons/RipplePressable'
import { showToast } from '../../design/components/overlays/toastStore'
import { BADGE_SIZE } from './constants'
import type { ProfileBadge } from '../../stores/userProfiles'

/** UserProfileBadges: a row of badge icons. A tap shows the badge's description in a toast. */
export function ProfileBadges({ badges }: { badges: ProfileBadge[] }) {
    if (badges.length === 0) return null
    return (
        <View style={styles.row}>
            {badges.map(badge => (
                <RipplePressable
                    key={badge.id}
                    accessibilityRole="button"
                    accessibilityLabel={badge.description}
                    borderless
                    onPress={() =>
                        showToast({
                            key: 'profile-badge',
                            content: badge.description,
                            iconUrl: badgeIconUrl(badge.icon),
                        })
                    }
                >
                    <Image
                        source={badgeIconUrl(badge.icon)}
                        style={styles.badge}
                    />
                </RipplePressable>
            ))}
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    // The badges sit in one chip after the username, as the server tag does.
    row: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.space.PX_4,
        paddingVertical: theme.space.PX_4,
        paddingHorizontal: theme.space.PX_4,
        borderRadius: theme.radii.sm,
        backgroundColor: theme.colors.BACKGROUND_MOD_STRONG,
    },
    badge: { width: BADGE_SIZE, height: BADGE_SIZE },
}))
