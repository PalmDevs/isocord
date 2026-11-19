/** Discord channel types. */
export const ChannelType = {
    GUILD_TEXT: 0,
    DM: 1,
    GUILD_VOICE: 2,
    GROUP_DM: 3,
    GUILD_CATEGORY: 4,
    GUILD_ANNOUNCEMENT: 5,
    ANNOUNCEMENT_THREAD: 10,
    PUBLIC_THREAD: 11,
    PRIVATE_THREAD: 12,
    GUILD_STAGE_VOICE: 13,
    GUILD_DIRECTORY: 14,
    GUILD_FORUM: 15,
    GUILD_MEDIA: 16,
} as const

const types = (...values: number[]): ReadonlySet<number> => new Set(values)

/** SLOWMODE_CHANNEL_TYPES: the channels that take a slowmode. */
export const SLOWMODE_CHANNEL_TYPES = types(
    ChannelType.GUILD_TEXT,
    ChannelType.GUILD_FORUM,
    ChannelType.GUILD_MEDIA,
    ChannelType.ANNOUNCEMENT_THREAD,
    ChannelType.PUBLIC_THREAD,
    ChannelType.PRIVATE_THREAD,
    ChannelType.GUILD_VOICE,
    ChannelType.GUILD_STAGE_VOICE,
)

/** NSFW_CHANNEL_TYPES: the channels that can be age-restricted. */
export const NSFW_CHANNEL_TYPES = types(
    ChannelType.GUILD_TEXT,
    ChannelType.GUILD_ANNOUNCEMENT,
    ChannelType.GUILD_FORUM,
    ChannelType.GUILD_MEDIA,
    ChannelType.GUILD_VOICE,
    ChannelType.GUILD_STAGE_VOICE,
)

/** ChannelTypes.LIMITED_CHANNEL_NAME: names are lowercase, without spaces or punctuation. */
export const LIMITED_CHANNEL_NAME_TYPES = types(
    ChannelType.GUILD_TEXT,
    ChannelType.GUILD_ANNOUNCEMENT,
    ChannelType.ANNOUNCEMENT_THREAD,
    ChannelType.GUILD_FORUM,
    ChannelType.GUILD_MEDIA,
)

/** ChannelTypes.GUILD_THREADS_ONLY: channels that hold posts instead of messages. */
export const THREADS_ONLY_CHANNEL_TYPES = types(
    ChannelType.GUILD_FORUM,
    ChannelType.GUILD_MEDIA,
)

/** ChannelTypes.APPLICATION_MANAGEABLE (without guild apps): a group DM can be run by an application. */
export const APPLICATION_MANAGEABLE_TYPES = types(ChannelType.GROUP_DM)

/** isReadableType: the channels that have a read state. */
export const READABLE_CHANNEL_TYPES = types(
    ChannelType.DM,
    ChannelType.GROUP_DM,
    ChannelType.GUILD_TEXT,
    ChannelType.GUILD_ANNOUNCEMENT,
    ChannelType.ANNOUNCEMENT_THREAD,
    ChannelType.PUBLIC_THREAD,
    ChannelType.PRIVATE_THREAD,
    ChannelType.GUILD_FORUM,
    ChannelType.GUILD_MEDIA,
    ChannelType.GUILD_VOICE,
    ChannelType.GUILD_STAGE_VOICE,
)

/** TOGGLE_ANNOUNCEMENT_CHANNEL_TYPES: the channels that can switch between text and announcement. */
export const TOGGLE_ANNOUNCEMENT_CHANNEL_TYPES = types(
    ChannelType.GUILD_TEXT,
    ChannelType.GUILD_ANNOUNCEMENT,
)

/** renderDefaultAutoArchiveDuration's channels: the ones that set how long their threads stay shown. */
export const DEFAULT_AUTO_ARCHIVE_CHANNEL_TYPES = types(
    ChannelType.GUILD_TEXT,
    ChannelType.GUILD_ANNOUNCEMENT,
    ChannelType.GUILD_FORUM,
    ChannelType.GUILD_MEDIA,
)
