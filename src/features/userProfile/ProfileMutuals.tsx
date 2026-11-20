import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { useSessionStore } from '../../core/react'
import { GuildIcon } from '../../design/components/avatars/GuildIcon'
import { RipplePressable } from '../../design/components/buttons/RipplePressable'
import { AvatarPile, Pile } from '../../design/components/layout/Pile'
import { Text } from '../../design/components/Text'
import { t } from '../../i18n'
import { guildsStore } from '../../stores/guilds'
import { openMutualsSheet } from './MutualsSheet'
import { useProfileMutuals } from './useProfileMutuals'

const PILE_SIZE = 16
const PILE_GUILDS = 3
/** Separates the friends and servers counts, as UserProfileMutuals. */
const BULLET = '•'

/**
 * UserProfileMutuals: one line under the username, with a small avatar pile and count of mutual friends, and the same
 * for mutual servers. A tap opens both lists in a sheet.
 */
export function ProfileMutuals({
    userId,
    guildId,
}: {
    userId: string
    guildId: string | undefined
}) {
    const { friends, guilds } = useProfileMutuals(userId, guildId)
    const known = useSessionStore(guildsStore, state => state.guilds)
    const shownGuilds = guilds.flatMap(({ id }) => known[id] ?? [])
    return (
        <View style={styles.rows}>
            {friends.length > 0 && (
                <MutualsRow
                    label={`${friends.length} ${t('userProfile.mutualFriends')}`}
                    onPress={() => openMutualsSheet(userId, guildId, 'friends')}
                >
                    <AvatarPile
                        users={friends}
                        size={PILE_SIZE}
                        cutoutColor="MOBILE_ACTIONSHEET_BACKGROUND"
                    />
                </MutualsRow>
            )}
            {friends.length > 0 && guilds.length > 0 && (
                <Text variant="text-xs/medium" color="TEXT_DEFAULT">
                    {BULLET}
                </Text>
            )}
            {guilds.length > 0 && (
                <MutualsRow
                    label={`${guilds.length} ${t('userProfile.mutualServers')}`}
                    onPress={() => openMutualsSheet(userId, guildId, 'servers')}
                >
                    <Pile
                        size={PILE_SIZE}
                        depthX={0.4}
                        shape="rounded-rect"
                        cutoutColor="MOBILE_ACTIONSHEET_BACKGROUND"
                    >
                        {shownGuilds.slice(0, PILE_GUILDS).map(guild => (
                            <GuildIcon
                                key={guild.id}
                                guild={guild}
                                size={PILE_SIZE}
                            />
                        ))}
                    </Pile>
                </MutualsRow>
            )}
        </View>
    )
}

function MutualsRow({
    label,
    onPress,
    children,
}: {
    label: string
    onPress: () => void
    children: React.ReactNode
}) {
    return (
        <RipplePressable
            accessibilityRole="button"
            onPress={onPress}
            style={styles.row}
        >
            {children}
            <Text variant="text-sm/medium" color="TEXT_DEFAULT">
                {label}
            </Text>
        </RipplePressable>
    )
}

const styles = StyleSheet.create(theme => ({
    rows: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: theme.space.PX_8,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.PX_8,
        paddingVertical: theme.space.PX_4,
        borderRadius: theme.radii.sm,
    },
}))
