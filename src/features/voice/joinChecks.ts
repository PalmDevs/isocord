// biome-ignore lint/correctness/useReactNativePlatformComponents: Isocord only runs on Android.
import { PermissionsAndroid } from 'react-native'
import { ChannelType } from '../../core/discord/channelType'
import { Permission } from '../../core/discord/permissions'
import { channelsStore } from '../../stores/channels/channels'
import { guildsStore } from '../../stores/guilds'
import { can } from '../../stores/permissions'
import {
    channelVoiceStates,
    guildVoiceState,
    voiceStatesStore,
} from '../../stores/voiceStates'
import type { Session } from '../../core/session'
import type { MessageKey } from '../../i18n'
import type { Guild } from '../../stores/guilds'

/** getChannelVideoLimit's limit when the guild is unknown. */
export const NO_VIDEO_LIMIT = -1

/** getChannelVideoLimit: the most users while video is on, by the channel's type. */
export function channelVideoLimit(
    guild: Guild | undefined,
    channelType: number,
): number {
    if (!guild) return NO_VIDEO_LIMIT
    const limit =
        channelType === ChannelType.GUILD_STAGE_VOICE
            ? guild.maxStageVideoChannelUsers
            : guild.maxVideoChannelUsers
    return limit ?? NO_VIDEO_LIMIT
}

/**
 * ChannelUtils.isChannelFull, returning the limit that is reached, or null. With video on, a voice channel holds the
 * guild's video limit, one more for those who can move members. A stage counts video and streams. A reached user
 * limit keeps out all but those moderators.
 */
export function reachedChannelLimit(
    session: Session,
    channelId: string,
): number | null {
    const channel = session.get(channelsStore).getState().channels[channelId]
    if (!channel) return null
    const guild = channel.guild_id
        ? session.get(guildsStore).getState().guilds[channel.guild_id]
        : undefined
    const states = channelVoiceStates(
        session.get(voiceStatesStore).getState(),
        channelId,
    )
    const users = states.length
    // VoiceStateStore.hasVideo
    const hasVideo = states.some(state => state.selfVideo)
    const moderator =
        can(session, channelId, Permission.MOVE_MEMBERS) &&
        can(session, channelId, Permission.CONNECT)
    const videoLimit = channelVideoLimit(guild, channel.type)
    const videoFull =
        channel.type === ChannelType.GUILD_STAGE_VOICE
            ? // ChannelListUtils.hasStream
              (hasVideo || states.some(state => state.selfStream)) &&
              videoLimit > 0 &&
              users >= videoLimit
            : hasVideo &&
              videoLimit > 0 &&
              users >= videoLimit + (moderator ? 1 : 0)
    const userLimit = channel.user_limit ?? 0
    if (userLimit > 0 && users >= userLimit && !moderator) return userLimit
    return videoFull ? videoLimit : null
}

/** ChannelUtils.isChannelFull. */
export const isChannelFull = (session: Session, channelId: string): boolean =>
    reachedChannelLimit(session, channelId) !== null

/** VoiceStateStore.isInChannel: our voice state is in the channel, as after a dropped call. */
function holdsSeat(session: Session, channelId: string): boolean {
    const guildId =
        session.get(channelsStore).getState().channels[channelId]?.guild_id ??
        null
    return (
        guildVoiceState(
            session.get(voiceStatesStore).getState(),
            guildId,
            session.userId,
        )?.channelId === channelId
    )
}

/** Stage channels need suppress and request to speak, which Isocord lacks (TODO.md). */
export function isStageChannel(session: Session, channelId: string): boolean {
    return (
        session.get(channelsStore).getState().channels[channelId]?.type ===
        ChannelType.GUILD_STAGE_VOICE
    )
}

/** Returns the message that says why the user cannot join, or null when they can. */
export function joinBlocker(
    session: Session,
    channelId: string,
): MessageKey | null {
    if (isStageChannel(session, channelId)) return 'voice.stageUnsupported'
    if (!can(session, channelId, Permission.CONNECT))
        return 'voice.noJoinPermission'
    // StreamActionCreators.watchStream: a seat we hold is not checked against the limits.
    if (!holdsSeat(session, channelId) && isChannelFull(session, channelId))
        return 'voice.channelFull'
    return null
}

/** MediaEngineStore AUDIO_TOGGLE_SELF_MUTE asks for the microphone before joining: RECORD_AUDIO at runtime. */
export async function requestMicrophone(): Promise<boolean> {
    const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    )
    return result === PermissionsAndroid.RESULTS.GRANTED
}

/** PrivateChannelCallUtils handleStartCall asks for the camera before a video call: CAMERA at runtime. */
export async function requestCamera(): Promise<boolean> {
    const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
    )
    return result === PermissionsAndroid.RESULTS.GRANTED
}
