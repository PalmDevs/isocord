import { VoiceCloseCode } from '../../core/discord/voiceCloseCodes'
import { logger } from '../../core/log'
import { t } from '../../i18n'
import native from '../../native/IsocordVoice'
import { hideToast, showToast } from '../toasts'
import {
    armJoinTimer,
    disconnect,
    sendVoiceState,
    setSelfDeaf,
    setSelfMute,
    setVideo,
} from './actions'
import { onCameraEvent } from './cameras'
import { startPreviewUploads } from './goLive/streamPreviewUpload'
import { rtcStore } from './rtc'
import { setStreamConnected } from './sinkWants'
import { endStream, screenConsent, setStreamPaused } from './streamActions'
import { streamsStore } from './streams'
import type { Session } from '../../core/session'
import type { MessageKey } from '../../i18n'
import type { VoiceEvent } from '../../native/voiceTypes'

const log = logger('Voice')

/** Returns `list` with `userId` added or removed, or `list` itself when nothing changes. */
function toggled(
    list: readonly string[],
    userId: string,
    present: boolean,
): readonly string[] {
    if (list.includes(userId) === present) return list
    return present ? [...list, userId] : list.filter(id => id !== userId)
}

/** Rejoins after a dropped connection before the call shows `disconnected`. */
const MAX_REJOINS = 3

/** Close codes a rejoin cannot fix. */
const FATAL_CLOSE_CODES: readonly number[] = [
    VoiceCloseCode.AUTHENTICATION_FAILED,
    VoiceCloseCode.SERVER_NOT_FOUND,
]

/**
 * The voice connection ended. A repeated op 4 asks for a new VOICE_SERVER_UPDATE, up to `MAX_REJOINS` times. After a
 * server crash (4015) Discord sends one by itself. Fatal codes and exhausted rejoins end in `disconnected`.
 */
function onDisconnected(session: Session, code: number | undefined): void {
    const rtc = session.get(rtcStore)
    const { guildId, channelId, rejoins } = rtc.getState()
    if (code === VoiceCloseCode.VOICE_SERVER_CRASHED) {
        rtc.setState({ connection: 'joining', server: null })
        armJoinTimer(session)
        return
    }
    if (
        (code !== undefined && FATAL_CLOSE_CODES.includes(code)) ||
        rejoins >= MAX_REJOINS
    ) {
        rtc.setState({ connection: 'disconnected' })
        return
    }
    rtc.setState({
        connection: 'joining',
        server: null,
        rejoins: rejoins + 1,
    })
    sendVoiceState(session, guildId, channelId)
    armJoinTimer(session)
}

/**
 * The stream connection ended on its own. Ours is over. A watched one forgets its server, so the next
 * STREAM_SERVER_UPDATE connects again.
 */
function onStreamDisconnected(session: Session): void {
    const streams = session.get(streamsStore)
    const { streamKey, own } = streams.getState()
    // No stream means we closed the connection ourselves.
    if (!streamKey) return
    if (own) endStream(session, true)
    else streams.setState({ server: null })
}

function onState(
    session: Session,
    event: Extract<VoiceEvent, { type: 'state' }>,
): void {
    if (event.context === 'stream') {
        setStreamConnected(session, event.state === 'connected')
        const { streamKey, own } = session.get(streamsStore).getState()
        if (event.state === 'connected' && own && streamKey)
            startPreviewUploads(session, streamKey)
        // The stream tile appears with its video, so only the loss of the connection matters.
        if (event.state === 'disconnected') onStreamDisconnected(session)
        return
    }
    if (event.context !== 'default') return
    // Events of a connection we closed ourselves, when leaving or moving, say nothing about the call we are in.
    const rtc = session.get(rtcStore)
    const { connection } = rtc.getState()
    if (connection === 'idle' || connection === 'joining') return
    if (event.state === 'disconnected') {
        onDisconnected(session, event.code)
        return
    }
    rtc.setState(
        event.state === 'connected'
            ? { connection: event.state, rejoins: 0 }
            : { connection: event.state },
    )
}

/** What a native error shows. A kind without a Discord string only logs. */
const ERROR_TOASTS: Partial<
    Record<Extract<VoiceEvent, { type: 'error' }>['kind'], MessageKey>
> = {
    microphone: 'voice.noMicrophone',
    camera: 'voice.noCamera',
    screen: 'voice.streamFailed',
}

function onError(
    session: Session,
    event: Extract<VoiceEvent, { type: 'error' }>,
): void {
    log.warn(`${event.kind}: ${event.message}`)
    const toast = ERROR_TOASTS[event.kind]
    if (toast) showToast({ content: t(toast), variant: 'critical' })
    const rtc = session.get(rtcStore)
    // The camera and the screen did not start, so what we told Discord is undone.
    if (event.kind === 'camera' && rtc.getState().selfVideo)
        setVideo(session, false)
    if (event.kind === 'screen') endStream(session, true)
}

/** Our camera stopped on its own: native already stopped it, so only our state and Discord's need to follow. */
function onCameraStopped(
    session: Session,
    event: Extract<VoiceEvent, { type: 'cameraStopped' }>,
): void {
    log.warn(`Camera stopped: ${event.reason}`)
    const rtc = session.get(rtcStore)
    const { channelId, guildId, selfVideo } = rtc.getState()
    if (!channelId || !selfVideo) return
    rtc.setState({ selfVideo: false })
    sendVoiceState(session, guildId, channelId)
}

/** One toast for our mic, so `microphoneResumed` can take it down. */
const MICROPHONE_TOAST = 'voice.microphoneStopped'

/**
 * Our mic stopped. `permission` and `error` already toast through their `error` event. Busy silence has no
 * error and no Discord string, so it gets Isocord's own.
 */
function onMicrophoneStopped(
    event: Extract<VoiceEvent, { type: 'microphoneStopped' }>,
): void {
    log.warn(`Microphone stopped: ${event.reason} ${event.message}`)
    if (event.reason !== 'busy') return
    showToast({
        key: MICROPHONE_TOAST,
        content: t('voice.microphoneBusy'),
        icon: 'MicrophoneDenyIcon',
    })
}

/**
 * ToastUtils.presentNoiseCancellationError: Krisp stopped on a slow phone. A sample rate RNNoise can't take
 * only logs, as the reference has no such case.
 */
function onNoiseSuppressionTier(
    event: Extract<VoiceEvent, { type: 'noiseSuppressionTier' }>,
): void {
    log.info(`Noise suppression stepped down: ${event.reason}`)
    if (event.reason !== 'slow') return
    showToast({
        key: 'MOBILE_NOISE_CANCELLATION_CPU_OVERUSE',
        content: t('voice.noiseSuppressionDisabled'),
        icon: 'XLargeIcon',
        iconColor: 'ICON_FEEDBACK_CRITICAL',
    })
}

/** Handles one `onVoiceEvent` payload from the native engine. */
export function handleVoiceEvent(session: Session, event: VoiceEvent): void {
    const rtc = session.get(rtcStore)
    switch (event.type) {
        case 'state':
            onState(session, event)
            break
        case 'speaking':
            if (event.context === 'default')
                rtc.setState(state => ({
                    speaking: toggled(
                        state.speaking,
                        event.userId,
                        event.speaking,
                    ),
                    lastSpeaker: event.speaking
                        ? event.userId
                        : state.lastSpeaker,
                }))
            break
        case 'video':
            if (event.context === 'default')
                rtc.setState(state => ({
                    video: toggled(state.video, event.userId, event.active),
                }))
            break
        case 'clientConnect':
            // Who is in the channel comes from voice states. The engine's list is for its own bookkeeping.
            break
        case 'clientDisconnect':
            if (event.context === 'default')
                rtc.setState(state => ({
                    speaking: toggled(state.speaking, event.userId, false),
                    video: toggled(state.video, event.userId, false),
                }))
            break
        case 'secureFrames':
            if (event.context === 'default')
                rtc.setState({ daveVersion: event.version })
            break
        case 'cameraStopped':
            onCameraStopped(session, event)
            break
        case 'screenConsent':
            screenConsent(session, event.granted)
            break
        case 'streamEnded':
            endStream(session, true)
            break
        case 'callAction':
            if (event.action === 'disconnect') disconnect(session)
            else if (event.action === 'mute') setSelfMute(session, event.on)
            else setSelfDeaf(session, event.on)
            break
        case 'endpoints':
            rtc.setState({
                endpoints: event.available,
                currentEndpoint: event.current,
            })
            break
        case 'error':
            onError(session, event)
            break
        case 'streamPaused':
            setStreamPaused(session, event.paused)
            break
        case 'microphoneStopped':
            onMicrophoneStopped(event)
            break
        case 'microphoneResumed':
            hideToast(MICROPHONE_TOAST)
            break
        case 'noiseSuppressionTier':
            onNoiseSuppressionTier(event)
            break
        case 'camera':
        case 'cameras':
            onCameraEvent(event)
            break
        case 'inputLevel':
        case 'audioDevices':
            // The sensitivity meter and the device pickers listen to these themselves.
            break
        case 'networkChanged':
            if (event.context === 'default') session.gateway.networkChanged()
            break
    }
}

/** Subscribes to the native engine's events. Returns the cleanup. */
export function listenToVoiceEvents(session: Session): () => void {
    if (!native) return () => {}
    return native.onVoiceEvent(payload =>
        handleVoiceEvent(session, JSON.parse(payload) as VoiceEvent),
    )
}
