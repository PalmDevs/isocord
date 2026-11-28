import { Endpoint } from '../../core/api/paths'
import { CALLABLE_CHANNEL_TYPES } from '../../core/discord/channelType'
import { RelationshipType } from '../../core/discord/relationships'
import { Opcode } from '../../core/gateway/opcodes'
import { logger } from '../../core/log'
import { t } from '../../i18n'
import { channelsStore } from '../../stores/channels/channels'
import { relationshipsStore } from '../../stores/relationships'
import { displayName, usersStore } from '../../stores/users'
import { showToast } from '../toasts'
import { selectVoiceChannel, setVideo } from '../voice/actions'
import { requestCamera } from '../voice/joinChecks'
import { rtcStore } from '../voice/rtc'
import {
    callsStore,
    canRingCall,
    isCallActive,
    takeEnqueuedRing,
} from './calls'
import type { Session } from '../../core/session'

const log = logger('Calls')

/** How long an answered call waits for the gateway and for the call to be known before it gives up. */
const ANSWER_TIMEOUT_MS = 15_000

/** CallActionCreators.stopRinging: stops the ring for `recipients`, or for us when none are given. */
export function stopRinging(
    session: Session,
    channelId: string,
    recipients?: readonly string[],
): Promise<unknown> {
    return session.rest.post(Endpoint.channelCallStopRinging(channelId), {
        body: { recipients },
    })
}

function postRing(
    session: Session,
    channelId: string,
    recipients: readonly string[] | null,
): void {
    session.rest
        .post(Endpoint.channelCallRing(channelId), { body: { recipients } })
        .catch(error => log.warn('Ring failed', error))
}

/**
 * CallActionCreators.ring: rings `recipients`, or everyone. Before the call exists (CALL_CREATE not heard yet) the ring
 * waits for it (CALL_ENQUEUE_RING).
 */
export function ring(
    session: Session,
    channelId: string,
    recipients: readonly string[] | null = null,
): void {
    const channel = session.get(channelsStore).getState().channels[channelId]
    if (!channel || !CALLABLE_CHANNEL_TYPES.has(channel.type)) return
    const calls = session.get(callsStore)
    if (canRingCall(calls.getState(), channelId)) {
        postRing(session, channelId, recipients)
        return
    }
    calls.setState(state => {
        const held = state.enqueuedRings[channelId]
        // A ring for everyone covers every other (CallStore handleCallEnqueueRing's union with "all").
        const next =
            held === null || recipients === null
                ? null
                : [...new Set([...(held ?? []), ...recipients])]
        return { enqueuedRings: { ...state.enqueuedRings, [channelId]: next } }
    })
}

/** CallStore CALL_CREATE: sends the ring that waited for the call. */
export function flushEnqueuedRing(session: Session, channelId: string): void {
    const calls = session.get(callsStore)
    const [ring, rest] = takeEnqueuedRing(calls.getState(), channelId)
    if (ring === undefined) return
    calls.setState({ enqueuedRings: rest })
    postRing(session, channelId, ring)
}

/**
 * SelectedChannelActionCreators.selectVoiceChannel with `video`: joins the call, then turns the camera on once the
 * call is ours.
 */
async function joinWithVideo(
    session: Session,
    channelId: string,
    video: boolean,
): Promise<void> {
    await selectVoiceChannel(session, null, channelId)
    if (video && session.get(rtcStore).getState().channelId === channelId)
        setVideo(session, true)
}

/** PrivateChannelCallUtils.handleJoinCall: joins a running call. A video join asks for the camera first. */
export async function joinCall(
    session: Session,
    channelId: string,
    video = false,
): Promise<void> {
    if (video && !(await requestCamera())) return
    await joinWithVideo(session, channelId, video)
}

/**
 * CallActionCreators.call: starts a call in a DM or group DM. A friend or a group is joined and rung. A DM user who is
 * not a friend is only joined once Discord says the call may start (GET call), as the reference does. A video call
 * asks for the camera first (PrivateChannelCallUtils.handleStartCall). A silent call joins without ringing (ours, from ConfirmStartCall's checkbox).
 */
export async function startCall(
    session: Session,
    channelId: string,
    video = false,
    silent = false,
): Promise<void> {
    const channel = session.get(channelsStore).getState().channels[channelId]
    if (!channel || !CALLABLE_CHANNEL_TYPES.has(channel.type)) return
    if (video && !(await requestCamera())) return
    const recipientId =
        channel.recipient_ids?.length === 1
            ? channel.recipient_ids[0]
            : undefined
    const friend =
        recipientId === undefined ||
        session.get(relationshipsStore).getState().byId[recipientId]?.type ===
            RelationshipType.FRIEND
    if (!friend) {
        try {
            await session.rest.get(Endpoint.channelCall(channelId))
        } catch {
            const user = session.get(usersStore).getState().users[recipientId]
            showToast({
                content: t('calls.needFriend', {
                    username: displayName(user),
                }),
                variant: 'critical',
            })
            return
        }
    }
    await joinWithVideo(session, channelId, video)
    if (friend && !silent) ring(session, channelId)
}

/** Resolves once the gateway is connected, or false after the timeout. */
function whenConnected(session: Session): Promise<boolean> {
    const { gateway } = session
    if (gateway.state === 'connected' && gateway.currentSessionId)
        return Promise.resolve(true)
    return new Promise(resolve => {
        const timer = setTimeout(() => finish(false), ANSWER_TIMEOUT_MS)
        const off = gateway.events.on('state', state => {
            if (state === 'connected' && gateway.currentSessionId) finish(true)
        })
        function finish(connected: boolean) {
            clearTimeout(timer)
            off()
            resolve(connected)
        }
    })
}

/** Resolves once the call is known to be active, or false after the timeout. */
function whenActive(session: Session, channelId: string): Promise<boolean> {
    const calls = session.get(callsStore)
    if (isCallActive(calls.getState(), channelId)) return Promise.resolve(true)
    return new Promise(resolve => {
        const timer = setTimeout(() => finish(false), ANSWER_TIMEOUT_MS)
        const off = calls.subscribe(state => {
            if (isCallActive(state, channelId)) finish(true)
        })
        function finish(active: boolean) {
            clearTimeout(timer)
            off()
            resolve(active)
        }
    })
}

/** CALL_CONNECT: asks the gateway for a call it has not sent us, as the reference does when a DM is selected. */
export function requestCallConnect(session: Session, channelId: string): void {
    session.gateway.send(Opcode.CALL_CONNECT, { channel_id: channelId })
}

/**
 * TelecomManager handleIncomingCallAnswered: joins the call the user answered on the call screen. Native opens the app
 * on `isocord://call/<channel>`. The app's session may still be resuming, so it waits for the gateway, asks for the
 * call and joins only a call that exists: joining a DM that has no call would start one.
 */
export async function answerCall(
    session: Session,
    channelId: string,
): Promise<void> {
    if (!(await whenConnected(session))) {
        log.warn('Answered a call without a gateway connection')
        return
    }
    requestCallConnect(session, channelId)
    if (!(await whenActive(session, channelId))) {
        log.warn('Answered a call that is over')
        return
    }
    await selectVoiceChannel(session, null, channelId, true)
}
