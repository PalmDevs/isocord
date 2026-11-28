/** StreamTypes.GUILD: the Go Live stream of a guild voice channel. */
const GUILD_STREAM_TYPE = 'guild'
/** StreamTypes.CALL: the Go Live stream of a DM or group DM call. */
const CALL_STREAM_TYPE = 'call'

/** The StreamTypes value of a stream in a guild's channel, or in a call when `guildId` is null. */
export const streamType = (guildId: string | null) =>
    guildId === null ? CALL_STREAM_TYPE : GUILD_STREAM_TYPE

/** StreamKeyUtils.encodeStreamKey: `guild:<guild>:<channel>:<owner>`, or `call:<channel>:<owner>` without a guild. */
export const streamKey = (
    guildId: string | null,
    channelId: string,
    ownerId: string,
) =>
    guildId === null
        ? `${CALL_STREAM_TYPE}:${channelId}:${ownerId}`
        : `${GUILD_STREAM_TYPE}:${guildId}:${channelId}:${ownerId}`

/** The owner of a stream key, the last part of either kind (StreamKeyUtils.decodeStreamKey). */
export const streamOwnerId = (streamKey: string) =>
    streamKey.slice(streamKey.lastIndexOf(':') + 1)

/** A STREAM_CREATE payload, the fields the client reads. */
export interface StreamCreate {
    stream_key: string
    rtc_server_id: string
    rtc_channel_id?: string | null
}

/** RTCConnection.trueChannelId: a stream's channel, else the id before its RTC server's. */
export const streamRtcChannelId = (create: StreamCreate) =>
    create.rtc_channel_id ?? (BigInt(create.rtc_server_id) - 1n).toString()

/** Constants.Base64JPEGPrefix: a stream preview is posted as a data URI. */
export const BASE64_JPEG_PREFIX = 'data:image/jpeg;base64,'

/** StreamSettingsConstants.ApplicationStreamPresets: the mobile Go Live sheet's stream modes. */
export const StreamPreset = {
    MOBILE_DEFAULT: 5,
    MOBILE_PERFORMANCE: 6,
    MOBILE_HIGH_QUALITY: 7,
} as const

/** PremiumConstants.StreamQualities: the Nitro level a Go Live quality needs. */
export const StreamQuality = {
    HIGH: 'high_streaming_quality',
    MID: 'mid_streaming_quality',
} as const
