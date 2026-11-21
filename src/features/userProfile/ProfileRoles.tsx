import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { useSessionStore } from '../../core/react'
import { Emoji } from '../../design/components/Emoji'
import { TagGroup } from '../../design/components/TagGroup'
import { t } from '../../i18n'
import { guildsStore } from '../../stores/guilds'
import { roleIcon } from '../chat/author'
import { hexColor } from '../chat/color'
import { ProfileSection } from './ProfileSection'

const ROLE_DOT_SIZE = 12
/** RoleIcon after the role's name. */
const ROLE_ICON_SIZE = 16

/** UserProfileRolesCard: the member's roles as tags, each with a dot in the role's colour and its icon after the name. */
export function ProfileRoles({
    guildId,
    roleIds,
}: {
    guildId: string
    roleIds: string[]
}) {
    const guild = useSessionStore(guildsStore, state => state.guilds[guildId])
    // @everyone has the guild's id and is not shown.
    const items = roleIds.flatMap(id => {
        const role = guild?.roles[id]
        if (!role?.name || id === guildId) return []
        const icon = roleIcon(role)
        return [
            {
                id,
                label: role.name,
                icon: <View style={styles.dot(role.color)} />,
                trailing: icon && (
                    <Emoji
                        source={icon.url}
                        accessibilityLabel={icon.emoji}
                        style={styles.icon}
                    />
                ),
            },
        ]
    })
    if (items.length === 0) return null
    return (
        <ProfileSection title={t('userProfile.roles')}>
            <TagGroup size="sm" label={t('userProfile.roles')} items={items} />
        </ProfileSection>
    )
}

const styles = StyleSheet.create(theme => ({
    dot: (color: number | undefined) => ({
        width: ROLE_DOT_SIZE,
        height: ROLE_DOT_SIZE,
        borderRadius: ROLE_DOT_SIZE / 2,
        backgroundColor: color ? hexColor(color) : theme.colors.TEXT_MUTED,
    }),
    icon: { width: ROLE_ICON_SIZE, height: ROLE_ICON_SIZE },
}))
