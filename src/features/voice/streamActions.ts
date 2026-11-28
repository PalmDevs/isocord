import { Permission } from '../../core/discord/permissions'
import {
    streamKey as encodeStreamKey,
    streamRtcChannelId,
    streamType,
} from '../../core/discord/streams'
import { Opcode } from '../../core/gateway/opcodes'
import native from '../../native/IsocordVoice'
import { can } from '../../stores/permissions'
import { stopPreviewUploads } from './goLive/streamPreviewUpload'
import {
    streamEntitlements,
    streamSettingForPreset,
} from './goLive/streamQuality'
import { rtcStore } from './rtc'
import { voiceSettingsStore } from './settings/voiceSettings'
import { NO_STREAM, streamsStore } from './streams'
import type { StreamCreate } from '../../core/discord/streams'
import type { Session } from '../../core/session'
import type { ConnectRequest } from '../../native/voiceTypes'
import type { StreamServerUpdate } from './streams'

/** StreamActionCreators.stopStream, and a watched stream's teardown: closes the connection and forgets the stream. */
export function endStream(session: Session, notifyServer: boolean): void {
    const streams = session.get(streamsStore)
    const { streamKey } = streams.getState()
    if (streamKey && notifyServer)
        session.gateway.send(Opcode.STREAM_DELETE, { stream_key: streamKey })
    streams.setState(NO_STREAM)
    stopPreviewUploads(session)
    if (streamKey) native?.disconnect('stream')
}

/** StreamActionCreators.setStreamPaused: op 22 when our screen turns off or the captured app hides. */
export function setStreamPaused(session: Session, paused: boolean): void {
    const { streamKey, own } = session.get(streamsStore).getState()
    if (!streamKey || !own) return
    session.gateway.send(Opcode.STREAM_SET_PAUSED, {
        stream_key: streamKey,
        paused,
    })
}

/**
 * Our stream's quality: the stored preset's best allowed setting, and app audio (MobileGoLiveActionSheet).
 * Native falls back to 720p30 without one.
 */
function ownStreamQuality(
    session: Session,
): Pick<ConnectRequest, 'streamResolution' | 'streamFramerate' | 'soundshare'> {
    const { streamPreset, soundshare } = voiceSettingsStore.getState()
    const { guildId } = session.get(rtcStore).getState()
    const { premiumType, guildPremiumTier } = streamEntitlements(
        session,
        guildId,
    )
    const setting = streamSettingForPreset(
        streamPreset,
        premiumType,
        guildPremiumTier,
    )
    return {
        streamResolution: setting?.resolution,
        streamFramerate: setting?.fps,
        soundshare,
    }
}

/** Starts Go Live: asks for screen capture consent first, then creates the stream (`startGoLive`). */
export function goLive(session: Session): void {
    const { channelId } = session.get(rtcStore).getState()
    if (!native || !channelId) return
    if (!can(session, channelId, Permission.STREAM)) return
    endStream(session, true)
    session.get(streamsStore).setState({ ...NO_STREAM, starting: true })
    native.requestScreen()
}

/** The answer to `requestScreen`: STREAM_CREATE (op 18) when granted. */
export function screenConsent(session: Session, granted: boolean): void {
    const streams = session.get(streamsStore)
    if (!streams.getState().starting) return
    const { guildId, channelId } = session.get(rtcStore).getState()
    if (!granted || !channelId) {
        streams.setState(NO_STREAM)
        return
    }
    streams.setState({
        ...NO_STREAM,
        own: true,
        streamKey: encodeStreamKey(guildId, channelId, session.userId),
    })
    session.gateway.send(Opcode.STREAM_CREATE, {
        type: streamType(guildId),
        guild_id: guildId,
        channel_id: channelId,
        preferred_region: null,
    })
}

/** StreamActionCreators.watchStream: asks the gateway for the server of a user's stream (op 20). */
export function watchStream(session: Session, ownerId: string): void {
    const { guildId, channelId } = session.get(rtcStore).getState()
    if (!channelId) return
    endStream(session, true)
    const streamKey = encodeStreamKey(guildId, channelId, ownerId)
    session.get(streamsStore).setState({ ...NO_STREAM, streamKey })
    session.gateway.send(Opcode.STREAM_WATCH, { stream_key: streamKey })
}

export function stopStream(session: Session): void {
    endStream(session, true)
}

/** Opens the stream connection once its server and our voice state are known. A repeated update is ignored. */
export function connectStream(
    session: Session,
    update: StreamServerUpdate,
): void {
    const streams = session.get(streamsStore)
    const { streamKey, own, create, server } = streams.getState()
    const { voiceSessionId } = session.get(rtcStore).getState()
    if (update.stream_key !== streamKey || !create || !voiceSessionId) return
    if (!update.endpoint) return
    const connection = `${update.endpoint} ${update.token}`
    if (connection === server) return
    streams.setState({ server: connection })
    const request: ConnectRequest = {
        context: 'stream',
        endpoint: update.endpoint,
        token: update.token,
        serverId: create.rtc_server_id,
        channelId: streamRtcChannelId(create),
        userId: session.userId,
        sessionId: voiceSessionId,
        owner: own,
        ...(own ? ownStreamQuality(session) : {}),
    }
    native?.connect(JSON.stringify(request))
}

/** STREAM_CREATE of the stream we asked for: its RTC server, needed by the connection. */
export function streamCreated(session: Session, create: StreamCreate): void {
    const streams = session.get(streamsStore)
    if (create.stream_key === streams.getState().streamKey)
        streams.setState({ create })
}

/**
 * STREAM_DELETE of the stream we asked for. Ours is over. A watched one only drops its connection, as the streamer
 * restarting sends a DELETE and then a new STREAM_CREATE and STREAM_SERVER_UPDATE for the same key.
 */
export function streamDeleted(session: Session, streamKey: string): void {
    const streams = session.get(streamsStore)
    const state = streams.getState()
    if (streamKey !== state.streamKey) return
    if (state.own) {
        endStream(session, false)
        return
    }
    streams.setState({ create: null, server: null })
    native?.disconnect('stream')
}
