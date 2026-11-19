// The user's per-guild notification settings (`user_guild_settings`), as UserGuildSettingsStore holds them.

import {
    ChannelNotificationSettingsFlags,
    GuildNotificationSettingsFlags,
    UnreadSetting,
    UserNotificationSettings,
} from '../../core/discord/notificationSettings'

/** The key of the settings of private channels, where a server's id would be. */
export const PRIVATE_SETTINGS_KEY = '@me'

interface MuteConfig {
    end_time: string | null
}

interface RawChannelOverride {
    channel_id: string
    muted?: boolean
    mute_config?: MuteConfig | null
    collapsed?: boolean
    message_notifications?: number
    flags?: number
}

export interface RawGuildSettings {
    /** null for the settings that apply to private channels. */
    guild_id: string | null
    /** Server-side version, newer on every change. */
    version?: number
    muted?: boolean
    mute_config?: MuteConfig | null
    suppress_everyone?: boolean
    suppress_roles?: boolean
    message_notifications?: number
    flags?: number
    channel_overrides?:
        | RawChannelOverride[]
        | Record<string, RawChannelOverride>
}

/** A mute: true until unmuted, or the time in ms it ends (`mute_config.end_time`). */
export type Mute = true | number

export interface GuildSettings {
    /** The guild's own mute, false when not muted. */
    muted: Mute | false
    suppressEveryone: boolean
    suppressRoles: boolean
    /** Muted channels and categories. */
    mutedChannels: Record<string, Mute>
    collapsedCategories: Record<string, true>
    /** UserNotificationSettings. Absent in entries cached by older versions. */
    messageNotifications?: number
    /** The guild's own unread setting, from its UNREADS_* flags. */
    unreadSetting?: UnreadSetting
    /** Channel and category overrides of `message_notifications`, where not unset. */
    channelMessageNotifications?: Record<string, number>
    /** Channel and category overrides of the unread setting, where set. */
    channelUnreadSettings?: Record<string, UnreadSetting>
    /** GuildNotificationSettingsFlags. */
    flags?: number
    /** ChannelNotificationSettingsFlags of the channels and categories that have any. */
    channelFlags?: Record<string, number>
}

/** Returns the UnreadSetting that a flags field holds, given its two unread bits. */
export function unreadSettingOf(
    flags: number | undefined,
    all: number,
    mentions: number,
): UnreadSetting {
    if (flags == null) return UnreadSetting.UNSET
    if (flags & all) return UnreadSetting.ALL_MESSAGES
    if (flags & mentions) return UnreadSetting.ONLY_MENTIONS
    return UnreadSetting.UNSET
}

/** Returns the mute a `muted` flag and its config describe. The end is compared later, when read. */
export function muteOf(
    muted: boolean | undefined,
    config: MuteConfig | null | undefined,
): Mute | undefined {
    if (!muted) return undefined
    return config?.end_time == null ? true : Date.parse(config.end_time)
}

/** Parses one `user_guild_settings` entry. */
export function parseGuildSettings(raw: RawGuildSettings): GuildSettings {
    const settings: GuildSettings = {
        muted: muteOf(raw.muted, raw.mute_config) ?? false,
        suppressEveryone: Boolean(raw.suppress_everyone),
        suppressRoles: Boolean(raw.suppress_roles),
        mutedChannels: {},
        collapsedCategories: {},
        messageNotifications: raw.message_notifications,
        unreadSetting: unreadSettingOf(
            raw.flags,
            GuildNotificationSettingsFlags.UNREADS_ALL_MESSAGES,
            GuildNotificationSettingsFlags.UNREADS_ONLY_MENTIONS,
        ),
        channelMessageNotifications: {},
        channelUnreadSettings: {},
        flags: raw.flags ?? 0,
        channelFlags: {},
    }
    const overrides = Array.isArray(raw.channel_overrides)
        ? raw.channel_overrides
        : Object.entries(raw.channel_overrides ?? {}).map(
              ([channel_id, override]) => ({ ...override, channel_id }),
          )
    for (const override of overrides) {
        const mute = muteOf(override.muted, override.mute_config)
        if (mute !== undefined)
            settings.mutedChannels[override.channel_id] = mute
        if (override.collapsed)
            settings.collapsedCategories[override.channel_id] = true
        if (
            override.message_notifications != null &&
            override.message_notifications !== UserNotificationSettings.NULL
        )
            settings.channelMessageNotifications![override.channel_id] =
                override.message_notifications
        const unread = unreadSettingOf(
            override.flags,
            ChannelNotificationSettingsFlags.UNREADS_ALL_MESSAGES,
            ChannelNotificationSettingsFlags.UNREADS_ONLY_MENTIONS,
        )
        if (unread !== UnreadSetting.UNSET)
            settings.channelUnreadSettings![override.channel_id] = unread
        if (override.flags)
            settings.channelFlags![override.channel_id] = override.flags
    }
    return settings
}

/** UserGuildSettingsStore.isFavorite: the channel is pinned to the top of its server's channel list. */
export function isFavorite(
    settings: GuildSettings | undefined,
    channelId: string,
): boolean {
    return Boolean(
        (settings?.channelFlags?.[channelId] ?? 0) &
            ChannelNotificationSettingsFlags.FAVORITED,
    )
}
