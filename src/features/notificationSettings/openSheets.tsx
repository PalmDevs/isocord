import { openActionSheet } from '../../design/components/sheets/sheetStore'
import { GuildMuteSheet } from './GuildMuteSheet'
import { GuildNotificationSettingsSheet } from './GuildNotificationSettingsSheet'
import { MuteSheet } from './MuteSheet'
import { NotificationSettingsSheet } from './NotificationSettingsSheet'

const MUTE_SHEET_KEY = 'mute-settings'
const NOTIFICATION_SETTINGS_SHEET_KEY = 'channel-notification-settings'
const GUILD_MUTE_SHEET_KEY = 'guild-mute-settings'
const GUILD_NOTIFICATION_SETTINGS_SHEET_KEY = 'guild-notification-settings'

/**
 * The two sheets open each other, so one module opens both and hands each the other's opener. They would
 * otherwise import each other, which breaks Fast Refresh.
 */

/** Opens the mute sheet of a channel, category, private channel or thread (MuteSettingsActionSheet). */
export function openMuteSheet(channelId: string): void {
    openActionSheet(
        MUTE_SHEET_KEY,
        <MuteSheet
            channelId={channelId}
            onOpenSettings={openNotificationSettings}
        />,
    )
}

/** Opens the notification settings of a channel, category or thread (ChannelSettingsNotifications). */
export function openNotificationSettings(channelId: string): void {
    openActionSheet(
        NOTIFICATION_SETTINGS_SHEET_KEY,
        <NotificationSettingsSheet
            channelId={channelId}
            onOpenMute={openMuteSheet}
        />,
    )
}

/** Opens the mute sheet of a server (MuteSettingsActionSheet). */
export function openGuildMuteSheet(guildId: string): void {
    openActionSheet(
        GUILD_MUTE_SHEET_KEY,
        <GuildMuteSheet
            guildId={guildId}
            onOpenSettings={openGuildNotificationSettings}
        />,
    )
}

/** Opens the notification settings of a server (NotificationSettingsModal). */
export function openGuildNotificationSettings(guildId: string): void {
    openActionSheet(
        GUILD_NOTIFICATION_SETTINGS_SHEET_KEY,
        <GuildNotificationSettingsSheet
            guildId={guildId}
            onOpenMute={openGuildMuteSheet}
        />,
    )
}
