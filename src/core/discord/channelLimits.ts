import { DAY, HOUR, MINUTE, SECOND } from '../time'

/** MAX_CHANNEL_NAME_LENGTH. */
export const MAX_CHANNEL_NAME_LENGTH = 100
/** ChannelConstants.MAX_CHANNEL_TOPIC_LENGTH. */
export const MAX_CHANNEL_TOPIC_LENGTH = 1024
/** ChannelConstants.MAX_FORUM_CHANNEL_TOPIC_LENGTH. */
export const MAX_FORUM_CHANNEL_TOPIC_LENGTH = 4096

/** BITRATE_DEFAULT, in bits per second. A voice channel at this bitrate is created without one. */
export const BITRATE_DEFAULT = 64_000

/** Seconds in a minute, an hour and a day, the units of the slowmode label. */
export const SECONDS_PER_MINUTE = MINUTE / SECOND
export const SECONDS_PER_HOUR = HOUR / SECOND
export const SECONDS_PER_DAY = DAY / SECOND

/** SLOWMODE_VALUES: the slowmode cooldowns the slider steps through, in seconds. */
export const SLOWMODE_VALUES = [
    0,
    5,
    10,
    15,
    30,
    SECONDS_PER_MINUTE,
    2 * SECONDS_PER_MINUTE,
    5 * SECONDS_PER_MINUTE,
    10 * SECONDS_PER_MINUTE,
    15 * SECONDS_PER_MINUTE,
    30 * SECONDS_PER_MINUTE,
    SECONDS_PER_HOUR,
    2 * SECONDS_PER_HOUR,
    6 * SECONDS_PER_HOUR,
] as const
