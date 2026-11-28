import { Permission } from '../../core/discord/permissions'
import { Opcode } from '../../core/gateway/opcodes'
import { logger } from '../../core/log'
import { t } from '../../i18n'
import native from '../../native/IsocordVoice'
import { guildsStore } from '../../stores/guilds'
import { can } from '../../stores/permissions'
import { showToast } from '../toasts'
import { callChannelName } from './channelTitle'
import { joinBlocker, requestMicrophone } from './joinChecks'
import { clearPreJoin } from './prejoin/preJoinStore'
import { idleRtc, rtcStore } from './rtc'
import { voiceSettingsStore } from './settings/voiceSettings'
import { endStream } from './streamActions'
import type { Session } from '../../core/session'
import type { CallDetails } from '../../native/voiceTypes'
import type { RtcState } from './rtc'

const log = logger('Voice')

/** RTCConnectionStore VOICE_CHANNEL_SELECT: how long we wait for the voice server before giving up. */
const JOIN_TIMEOUT_MS = 30_000

const joinTimers = new WeakMap<Session, ReturnType<typeof setTimeout>>()

type Flags = Pick<RtcState, 'selfMute' | 'selfDeaf' | 'selfVideo'>

/** Stops waiting for the voice server, once the connection opens or the call ends. */
export function clearJoinTimer(session: Session): void {
    clearTimeout(joinTimers.get(session))
    joinTimers.delete(session)
}

/** Gives up the call when our voice state or the server does not arrive in time. */
export function armJoinTimer(session: Session): void {
    clearJoinTimer(session)
    joinTimers.set(
        session,
        setTimeout(() => {
            log.warn('No voice server within the join timeout')
            leave(session, true)
        }, JOIN_TIMEOUT_MS),
    )
}

/** LocalVoiceState: our flags and channel, op 4. A deafened user is muted too. */
export function sendVoiceState(
    session: Session,
    guildId: string | null,
    channelId: string | null,
): void {
    const { selfMute, selfDeaf, selfVideo } = session.get(rtcStore).getState()
    session.gateway.send(Opcode.VOICE_STATE_UPDATE, {
        guild_id: guildId,
        channel_id: channelId,
        self_mute: selfMute || selfDeaf,
        self_deaf: selfDeaf,
        self_video: channelId !== null && selfVideo,
    })
}

/** What the Telecom call and its notification show. */
export function callDetails(session: Session): CallDetails {
    const { guildId, channelId } = session.get(rtcStore).getState()
    const guild = guildId
        ? session.get(guildsStore).getState().guilds[guildId]
        : undefined
    return {
        title: channelId ? callChannelName(session, channelId) : '',
        subtitle: guild?.name ?? '',
        strings: {
            channel: t('voice.notificationChannel'),
            disconnect: t('voice.disconnect'),
            mute: t('voice.mute'),
            unmute: t('voice.unmute'),
            deafen: t('voice.deafen'),
            undeafen: t('voice.undeafen'),
        },
        telecom: voiceSettingsStore.getState().telecom,
    }
}

function applyFlags(session: Session): void {
    const { selfMute, selfDeaf } = session.get(rtcStore).getState()
    native?.setSelfMute(selfMute || selfDeaf)
    native?.setSelfDeaf(selfDeaf)
}

/** Sets our flags. Before a call they wait for the join, as MediaEngineStore's do (the pre-join mic toggle). */
function setFlags(session: Session, flags: Partial<Flags>): void {
    const { guildId, channelId } = session.get(rtcStore).getState()
    session.get(rtcStore).setState(flags)
    if (!channelId) return
    applyFlags(session)
    sendVoiceState(session, guildId, channelId)
}

/** The local teardown of a call. `notifyServer` also leaves on Discord's side: op 19 for a stream, op 4 for the call. */
export function leave(session: Session, notifyServer: boolean): void {
    const rtc = session.get(rtcStore)
    const state = rtc.getState()
    if (!state.channelId) return
    clearJoinTimer(session)
    endStream(session, notifyServer)
    native?.endCall()
    if (notifyServer) sendVoiceState(session, state.guildId, null)
    rtc.setState(idleRtc(state))
    session.gateway.setInCall(false)
}

/**
 * A fresh gateway session (READY) while in a call: the old session's voice state is dead. As GatewayConnectionStore's
 * `_handleConnectionOpen` does, sends our voice state again with the same channel. The call stays in `joining`
 * until the new VOICE_STATE_UPDATE and VOICE_SERVER_UPDATE connect native, which replaces its connection.
 */
export function rejoinAfterReady(session: Session): void {
    const rtc = session.get(rtcStore)
    const { guildId, channelId } = rtc.getState()
    if (!channelId) return
    // Our stream belonged to the old session too.
    endStream(session, false)
    rtc.setState({
        connection: 'joining',
        voiceSessionId: null,
        server: null,
        rejoins: 0,
    })
    sendVoiceState(session, guildId, channelId)
    armJoinTimer(session)
}

/** Leaves the call (SelectedChannelActionCreators.disconnect). */
export function disconnect(session: Session): void {
    leave(session, true)
}

/** Starts the call to `channelId`, replacing the one we are in. Op 4, then our voice state and server arrive. */
function join(
    session: Session,
    guildId: string | null,
    channelId: string,
): void {
    const rtc = session.get(rtcStore)
    const previous = rtc.getState()
    if (previous.channelId) {
        endStream(session, true)
        native?.disconnect('default')
        // `idleRtc` resets these below, so native must agree.
        native?.setServerMute(false)
        native?.setServerDeaf(false)
        native?.setVideo(false)
    }
    // Without SPEAK the user joins muted and cannot unmute (the reference's PermissionVADStore).
    const muted = !can(session, channelId, Permission.SPEAK)
    rtc.setState({
        ...idleRtc({
            selfMute: previous.selfMute || muted,
            selfDeaf: previous.selfDeaf,
        }),
        // The Telecom call carries over a move and reports its audio outputs only when they change.
        endpoints: previous.endpoints,
        currentEndpoint: previous.currentEndpoint,
        guildId,
        channelId,
        connection: 'joining',
    })
    // Telecom needs the app in front, which a tap on the channel list guarantees.
    native?.beginCall(JSON.stringify(callDetails(session)))
    applyFlags(session)
    session.gateway.setInCall(true)
    sendVoiceState(session, guildId, channelId)
    armJoinTimer(session)
}

/** Whether a tap on `channelId` has nothing to do. A dropped call there rejoins instead. */
function inCall(session: Session, channelId: string): boolean {
    const { channelId: current, connection } = session.get(rtcStore).getState()
    return current === channelId && connection !== 'disconnected'
}

/**
 * SelectedChannelActionCreators.selectVoiceChannel: joins a guild voice channel, or a DM or group DM call with a null
 * guild. The pre-join card, if any, turns into the call's dock in place. `answering` joins before asking for the
 * microphone, so a ring is picked up at once; a refusal then leaves us in the call, muted.
 */
export async function selectVoiceChannel(
    session: Session,
    guildId: string | null,
    channelId: string,
    answering = false,
): Promise<void> {
    if (!native || inCall(session, channelId)) return
    const blocker = joinBlocker(session, channelId)
    if (blocker) {
        showToast({ content: t(blocker), variant: 'critical' })
        return
    }
    if (answering) {
        join(session, guildId, channelId)
        clearPreJoin(session)
        if (!(await requestMicrophone())) {
            setSelfMute(session, true)
            showToast({ content: t('voice.noMicrophone'), variant: 'critical' })
        }
        return
    }
    if (!(await requestMicrophone())) {
        showToast({ content: t('voice.noMicrophone'), variant: 'critical' })
        return
    }
    if (inCall(session, channelId)) return
    // The call first: the overlay then hands the pre-join's card to it, never dropping it for a render.
    join(session, guildId, channelId)
    clearPreJoin(session)
}

/** MediaEngineStore AUDIO_TOGGLE_SELF_MUTE: unmuting also undeafens, and needs SPEAK. */
export function setSelfMute(session: Session, mute: boolean): void {
    const { channelId } = session.get(rtcStore).getState()
    if (!mute && channelId && !can(session, channelId, Permission.SPEAK)) {
        showToast({ content: t('voice.noSpeakPermission') })
        return
    }
    setFlags(
        session,
        mute ? { selfMute: true } : { selfMute: false, selfDeaf: false },
    )
}

export function toggleSelfMute(session: Session): void {
    const { selfMute, selfDeaf } = session.get(rtcStore).getState()
    setSelfMute(session, !(selfMute || selfDeaf))
}

/** MediaEngineStore AUDIO_TOGGLE_SELF_DEAF. */
export function setSelfDeaf(session: Session, deaf: boolean): void {
    setFlags(session, { selfDeaf: deaf })
}

export function toggleSelfDeaf(session: Session): void {
    setSelfDeaf(session, !session.get(rtcStore).getState().selfDeaf)
}

/** Camera on or off. Native asks for the CAMERA permission and answers a refusal with an error event. */
export function setVideo(session: Session, on: boolean): void {
    const { channelId } = session.get(rtcStore).getState()
    if (!channelId) return
    if (on && !can(session, channelId, Permission.STREAM)) return
    native?.setVideo(on)
    setFlags(session, { selfVideo: on })
}
