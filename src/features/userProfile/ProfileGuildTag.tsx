import { Image } from 'expo-image'
import { StyleSheet } from 'react-native-unistyles'
import { useSession } from '../../core/react'
import { RipplePressable } from '../../design/components/buttons/RipplePressable'
import { Text } from '../../design/components/Text'
import { clanTag } from '../chat/author'
import { openGuildTagSheet } from '../chat/headerActions'
import type { User } from '../../stores/users'

/** GuildTagBadgeSize.SIZE_16 of the profile's primary info. */
const BADGE_SIZE = 16

/** GuildTag in UserProfilePrimaryInfo: the server tag chip after the username. A tap opens its server. */
export function ProfileGuildTag({ user }: { user: User }) {
    const session = useSession()
    const tag = clanTag(user)
    if (!tag) return null
    return (
        <RipplePressable
            accessibilityRole="button"
            accessibilityLabel={tag.tag}
            onPress={() => openGuildTagSheet(session, user)}
            style={styles.chip}
        >
            {tag.badgeUrl && (
                <Image source={tag.badgeUrl} style={styles.badge} />
            )}
            <Text variant="text-sm/medium" color="TEXT_DEFAULT">
                {tag.tag}
            </Text>
        </RipplePressable>
    )
}

const styles = StyleSheet.create(theme => ({
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: theme.space.PX_4,
        paddingVertical: theme.space.PX_4,
        paddingHorizontal: theme.space.PX_8,
        borderRadius: theme.radii.sm,
        backgroundColor: theme.colors.BACKGROUND_MOD_STRONG,
    },
    badge: { width: BADGE_SIZE, height: BADGE_SIZE },
}))
