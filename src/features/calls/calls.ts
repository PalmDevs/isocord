import { createStore } from 'zustand/vanilla'
import { defineStore } from '../../core/session'
import { ringingUsers } from '../../stores/callEvents'
import type { CallUpdate } from '../../stores/callEvents'

/** CallStore's call: a DM or group DM call we know of. */
export interface Call {
    channelId: string
    messageId: string | null
    /** The voice region. A call without one has not started. */
    region: string | null
    /** The users it rings. */
    ringing: readonly string[]
    /** CALL_DELETE with `unavailable`: an outage hides the call. */
    unavailable: boolean
}

/** Who a ring asked for before the call existed: null for everyone (CallStore `enqueuedRings`). */
type EnqueuedRing = readonly string[] | null

interface CallsState {
    calls: Record<string, Call>
    /** Rings waiting for CALL_CREATE, by channel. */
    enqueuedRings: Record<string, EnqueuedRing>
}

/** CallStore.isCallActive: the call exists and has a region. */
export const isCallActive = (state: CallsState, channelId: string): boolean => {
    const call = state.calls[channelId]
    return call !== undefined && !call.unavailable && call.region !== null
}

/** useCanRing.canRingUsersInChannel: the call exists and has its message. */
export const canRingCall = (state: CallsState, channelId: string): boolean => {
    const call = state.calls[channelId]
    return call?.messageId != null && !call.unavailable
}

const toCall = (update: CallUpdate): Call => ({
    channelId: update.channel_id,
    messageId: update.message_id ?? null,
    region: update.region ?? null,
    ringing: ringingUsers(update),
    unavailable: false,
})

/** The ring a call update is waiting on, and the others kept. */
export function takeEnqueuedRing(
    state: CallsState,
    channelId: string,
): [ring: EnqueuedRing | undefined, rest: CallsState['enqueuedRings']] {
    const { [channelId]: ring, ...rest } = state.enqueuedRings
    return [ring, rest]
}

/** CallStore: the calls in DMs and group DMs. Live state, so it is not cached. Their voice states are in `voiceStates`. */
export const callsStore = defineStore('calls', session => {
    const store = createStore<CallsState>(() => ({
        calls: {},
        enqueuedRings: {},
    }))
    const { dispatch } = session.gateway
    const remove = (channelId: string) =>
        store.setState(state => {
            const { [channelId]: _call, ...calls } = state.calls
            const { [channelId]: _ring, ...enqueuedRings } = state.enqueuedRings
            return { calls, enqueuedRings }
        })

    // CONNECTION_CLOSED: what a closed connection held is gone. READY lists no calls.
    dispatch.on('READY', () => store.setState({ calls: {}, enqueuedRings: {} }))
    dispatch.on('CALL_CREATE', call =>
        store.setState(state => ({
            calls: { ...state.calls, [call.channel_id]: toCall(call) },
        })),
    )
    dispatch.on('CALL_UPDATE', call =>
        store.setState(state => ({
            calls: { ...state.calls, [call.channel_id]: toCall(call) },
        })),
    )
    dispatch.on('CALL_DELETE', ({ channel_id, unavailable }) => {
        if (!unavailable) return remove(channel_id)
        store.setState(state => ({
            calls: {
                ...state.calls,
                [channel_id]: {
                    channelId: channel_id,
                    messageId: null,
                    region: null,
                    ringing: [],
                    unavailable: true,
                },
            },
        }))
    })
    dispatch.on('CHANNEL_DELETE', channel => remove(channel.id))

    return store
})
