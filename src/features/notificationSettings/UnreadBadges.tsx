import {
    UnreadSetting,
    UserNotificationSettings,
} from '../../core/discord/notificationSettings'
import { useSession, useSessionStore } from '../../core/react'
import {
    TableRadioGroup,
    TableRadioRow,
} from '../../design/components/table/TableControlRows'
import { t } from '../../i18n'
import { guildsStore } from '../../stores/guilds'
import { setChannelUnreadSetting } from '../../stores/settings/notificationActions'
import { settingsStore } from '../../stores/settings/settingsStore'
import {
    resolvedMessageNotifications,
    resolveUnreadSetting,
} from '../../stores/unreadPolicy'
import type { Channel } from '../../stores/channels/channels'

/**
 * NotificationSettingsMessageUnreadChannelActionSheet: whether a server channel's unreads show in full or dimmed
 * unless mentioned. Only with the new notification system (USE_NEW_NOTIFICATIONS), which the setting needs. Mention
 * Only is disabled while the channel notifies of all messages. The reference's mock channel preview is left out.
 */
export function UnreadBadges({
    channel,
}: {
    channel: Channel & { guild_id: string }
}) {
    const session = useSession()
    const guildDefault = useSessionStore(
        guildsStore,
        state => state.guilds[channel.guild_id]?.defaultMessageNotifications,
    )
    const enabled = useSessionStore(
        settingsStore,
        state => state.newNotifications === true,
    )
    // useChannelPresetSettings: the resolved unread setting and notification level.
    const unread = useSessionStore(settingsStore, state =>
        resolveUnreadSetting(state, channel, guildDefault),
    )
    const notifiesAll = useSessionStore(
        settingsStore,
        state =>
            resolvedMessageNotifications(state, channel, guildDefault) ===
            UserNotificationSettings.ALL_MESSAGES,
    )
    if (!enabled) return null
    return (
        <TableRadioGroup
            title={t('unreadSettings.title')}
            value={String(unread)}
            onChange={value =>
                setChannelUnreadSetting(
                    session,
                    channel,
                    Number(value) as UnreadSetting,
                )
            }
        >
            <TableRadioRow
                value={String(UnreadSetting.ALL_MESSAGES)}
                label={t('muteSettings.allMessages')}
                subLabel={t('unreadSettings.allMessagesDescription')}
            />
            <TableRadioRow
                value={String(UnreadSetting.ONLY_MENTIONS)}
                label={t('unreadSettings.mentionOnly')}
                subLabel={
                    notifiesAll
                        ? t('unreadSettings.mentionOnlyDisabled')
                        : undefined
                }
                disabled={notifiesAll}
            />
        </TableRadioGroup>
    )
}
