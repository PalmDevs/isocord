import { t } from '../../i18n'
import native from '../../native/IsocordVoice'
import { channelsStore } from '../../stores/channels/channels'
import { showToast } from '../toasts'
import { callDetails, clearJoinTimer, leave, rejoinAfterReady } from './actions'
import { isStageChannel } from './joinChecks'
import { rtcStore } from './rtc'
import { connectStream, streamCreated, streamDeleted } from './streamActions'
import type { Session } from '../../core/session'
import type { ConnectRequest } from '../../native/voiceTypes'
import type { RawVoiceState } from '../../stores/voiceStates'
import type { VoiceServerUpdate } from './rtc'

/**
 * Opens the voice connection once our voice state, which gives the session id, and the voice server are both known.
 * A VOICE_SERVER_UPDATE without an endpoint means the server is still allocated, so it waits for the next one.
 */
function maybeConnect(session: Session): void {
    const rtc = session.get(rtcStore)
    const { channelId, voiceSessionId, server } = rtc.getState()
    if (!channelId || !voiceSessionId || !server?.endpoint) return
    const request: ConnectRequest = {
        context: 'default',
        endpoint: server.endpoint,
        token: server.token,
        serverId: server.guild_id ?? channelId,
        channelId,
        userId: session.userId,
        sessionId: voiceSessionId,
        owner: false,
        videoQualityMode: session.get(channelsStore).getState().channels[
            channelId
        ]?.video_quality_mode,
    }
    clearJoinTimer(session)
    native?.connect(JSON.stringify(request))
    rtc.setState({ server: null, connection: 'connecting' })
}

/**
 * RTCConnectionStore VOICE_STATE_UPDATES for our own user. Our session's state keeps the call: a new channel is a
 * move by a moderator, none is a disconnect. Another session's state in the guild means we joined elsewhere.
 */
function onOwnVoiceState(session: Session, update: RawVoiceState): void {
    const rtc = session.get(rtcStore)
    const state = rtc.getState()
    if (!state.channelId) return
    if (update.session_id !== session.gateway.currentSessionId) {
        // The reference leaves for any other session's update in the guild. A leaving one must not end our call.
        if (update.channel_id && (update.guild_id ?? null) === state.guildId)
            leave(session, false)
        return
    }
    if (!update.channel_id) {
        // Before our first state of this call, a null one is the echo of our last leave.
        if (state.voiceSessionId !== null) leave(session, false)
        return
    }
    // A moderator moved us to a stage: leave rather than join a call we can't show.
    if (isStageChannel(session, update.channel_id)) {
        leave(session, true)
        showToast({ content: t('voice.stageUnsupported'), variant: 'critical' })
        return
    }
    const serverMute = (update.mute ?? false) || (update.suppress ?? false)
    const serverDeaf = update.deaf ?? false
    rtc.setState({
        voiceSessionId: update.session_id,
        channelId: update.channel_id,
        serverMute,
        serverDeaf,
    })
    if (serverMute !== state.serverMute) native?.setServerMute(serverMute)
    if (serverDeaf !== state.serverDeaf) native?.setServerDeaf(serverDeaf)
    // The call moved: the notification names the new channel.
    if (update.channel_id !== state.channelId)
        native?.beginCall(JSON.stringify(callDetails(session)))
    maybeConnect(session)
}

/** RTCConnectionStore VOICE_SERVER_UPDATE: for our guild and the channel we are in or moving to. */
function onVoiceServer(session: Session, update: VoiceServerUpdate): void {
    const rtc = session.get(rtcStore)
    const { guildId, channelId } = rtc.getState()
    if (!channelId) return
    if (update.guild_id && update.guild_id !== guildId) return
    if (update.channel_id && update.channel_id !== channelId) return
    rtc.setState({ server: update })
    maybeConnect(session)
}

/** Handles the gateway events of a call. Returns the cleanup. */
export function registerGatewayHandlers(session: Session): () => void {
    const { dispatch } = session.gateway
    const rtc = session.get(rtcStore)
    const offs = [
        // A fresh IDENTIFY: the old session's voice state is gone. The call stays, as in GatewayConnectionStore.
        dispatch.on('READY', () => rejoinAfterReady(session)),
        dispatch.on('VOICE_STATE_UPDATE', update => {
            if (update.user_id === session.userId)
                onOwnVoiceState(session, update)
        }),
        dispatch.on('VOICE_SERVER_UPDATE', update =>
            onVoiceServer(session, update),
        ),
        dispatch.on('GUILD_DELETE', ({ id }) => {
            if (rtc.getState().guildId === id) leave(session, false)
        }),
        dispatch.on('CHANNEL_DELETE', channel => {
            if (rtc.getState().channelId === channel.id) leave(session, false)
        }),
        // CallStore CALL_DELETE: the call we are in is over. An outage (unavailable) leaves the voice connection alone.
        dispatch.on('CALL_DELETE', ({ channel_id, unavailable }) => {
            const { guildId, channelId } = rtc.getState()
            if (!unavailable && guildId === null && channelId === channel_id)
                leave(session, false)
        }),
        dispatch.on('STREAM_CREATE', create => streamCreated(session, create)),
        dispatch.on('STREAM_SERVER_UPDATE', update =>
            connectStream(session, update),
        ),
        dispatch.on('STREAM_DELETE', ({ stream_key }) =>
            streamDeleted(session, stream_key),
        ),
    ]
    return () => {
        for (const off of offs) off()
    }
}
