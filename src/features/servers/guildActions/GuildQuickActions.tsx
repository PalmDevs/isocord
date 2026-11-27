import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { Permission } from '../../../core/discord/permissions'
import { useSession, useSessionStore } from '../../../core/react'
import { IconButton } from '../../../design/components/buttons/IconButton'
import { useCloseSheet } from '../../../design/components/sheets/sheetContext'
import { t } from '../../../i18n'
import { channelsStore } from '../../../stores/channels/channels'
import { can } from '../../../stores/permissions'
import { unmuteGuild } from '../../../stores/settings/notificationActions'
import { settingsStore } from '../../../stores/settings/settingsStore'
import { isGuildMuted } from '../../../stores/unreadPolicy'
import {
    openGuildMuteSheet,
    openGuildNotificationSettings,
} from '../../notificationSettings'
import { openInviteSheet } from './invite/InviteSheet'
import type { Guild } from '../../../stores/guilds'

/** GuildActionSheetPrimaryActions row: invite, mute, notification settings and search buttons. */
export function GuildQuickActions({
    guild,
    onOpenSearch,
}: {
    guild: Guild
    onOpenSearch?: () => void
}) {
    const session = useSession()
    const close = useCloseSheet()
    const muted = useSessionStore(settingsStore, state =>
        isGuildMuted(state, guild.id),
    )
    const canInvite = useSessionStore(channelsStore, state =>
        (state.byGuild[guild.id] ?? []).some(id =>
            can(
                session,
                id,
                Permission.VIEW_CHANNEL | Permission.CREATE_INSTANT_INVITE,
            ),
        ),
    )
    return (
        <View style={styles.quickBar}>
            {canInvite && (
                <IconButton
                    variant="secondary"
                    size="md"
                    icon="GroupPlusIcon"
                    label={t('servers.header.invite')}
                    grow
                    onPress={() => openInviteSheet(guild)}
                />
            )}
            <IconButton
                variant="secondary"
                size="md"
                icon={muted ? 'BellIcon' : 'BellSlashIcon'}
                label={t(muted ? 'guildActions.unmute' : 'guildActions.mute')}
                grow
                onPress={() =>
                    muted
                        ? unmuteGuild(session, guild.id)
                        : openGuildMuteSheet(guild.id)
                }
            />
            <IconButton
                variant="secondary"
                size="md"
                icon="ChannelNotificationIcon"
                label={t('settings.notifications')}
                grow
                onPress={() => openGuildNotificationSettings(guild.id)}
            />
            {onOpenSearch && (
                <IconButton
                    variant="secondary"
                    size="md"
                    icon="MagnifyingGlassIcon"
                    label={t('servers.header.search')}
                    grow
                    onPress={() => {
                        close()
                        onOpenSearch()
                    }}
                />
            )}
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    quickBar: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.space.PX_8,
    },
}))
