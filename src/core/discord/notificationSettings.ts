// Discord's notification setting values, as user_guild_settings and read states use them.

/** user_settings/UserSettingsConstants UserNotificationSettings. */
export const UserNotificationSettings = {
    ALL_MESSAGES: 0,
    ONLY_MENTIONS: 1,
    NO_MESSAGES: 2,
    /** Inherits the parent's or the guild's level. */
    NULL: 3,
} as const

/** read_states/ReadStateConstants UnreadSetting. */
export const UnreadSetting = {
    UNSET: 0,
    ALL_MESSAGES: 1,
    ONLY_MENTIONS: 2,
} as const
export type UnreadSetting = (typeof UnreadSetting)[keyof typeof UnreadSetting]

/** notifications/NotificationConstants AccountNotificationFlags: user-wide notification settings. */
export const AccountNotificationFlags = {
    /** Unread settings apply apart from the notification level ("New Unreads"). */
    USE_NEW_NOTIFICATIONS: 1 << 4,
    /** Messages in all-messages channels count as low importance mentions. */
    MENTION_ON_ALL_MESSAGES: 1 << 5,
} as const

/** user_settings/UserSettingsConstants GuildNotificationSettingsFlags. */
export const GuildNotificationSettingsFlags = {
    UNREADS_ALL_MESSAGES: 2048,
    UNREADS_ONLY_MENTIONS: 4096,
    /** The channel list shows only the channels the user picked ("Browse Channels"). */
    OPT_IN_CHANNELS_ON: 16384,
} as const

/** user_settings/UserSettingsConstants ChannelNotificationSettingsFlags. */
export const ChannelNotificationSettingsFlags = {
    UNREADS_ONLY_MENTIONS: 512,
    UNREADS_ALL_MESSAGES: 1024,
    FAVORITED: 2048,
    /** The channel or category is on the user's channel list in an opt-in guild. */
    OPT_IN_ENABLED: 4096,
} as const

/** user_settings/UserSettingsConstants MuteUntilSeconds: how long a mute lasts. ALWAYS lasts until it is turned off. */
export const MuteUntilSeconds = {
    MINUTES_15: 900,
    HOURS_1: 3600,
    HOURS_3: 10800,
    HOURS_8: 28800,
    HOURS_24: 86400,
    ALWAYS: -1,
} as const

/** Constants MAX_MEMBERS_NOTIFY_ALL_MESSAGES: servers this big send push notifications for mentions only. */
export const MAX_MEMBERS_NOTIFY_ALL_MESSAGES = 2500
