import type { RawVoiceState } from './voiceStates'

/**
 * CALL_CREATE: a call in a DM or group DM. docs.discord.food lists `ringing`. The reference reads the ringing users
 * from the keys of `ongoing_rings` (dispatchSocketMessage), so both are taken.
 */
export interface CallCreate {
    channel_id: string
    message_id?: string | null
    region?: string | null
    ringing?: string[]
    ongoing_rings?: Record<string, unknown>
    /** Who is in the call. */
    voice_states?: RawVoiceState[]
}

/** CALL_UPDATE: docs.discord.food lists no voice states. */
export type CallUpdate = CallCreate

/** CALL_DELETE: the call ended, or is unavailable because of an outage. */
export interface CallDelete {
    channel_id: string
    unavailable?: boolean
}

declare module '../core/gateway/events' {
    interface GatewayEvents {
        CALL_CREATE: CallCreate
        CALL_UPDATE: CallUpdate
        CALL_DELETE: CallDelete
    }
}

/** The users a call rings. An `ongoing_rings` entry without a value is not ringing (TelecomManager.processIncomingRing). */
export function ringingUsers(call: CallUpdate): readonly string[] {
    const users = new Set(call.ringing)
    for (const [userId, ring] of Object.entries(call.ongoing_rings ?? {}))
        if (ring != null) users.add(userId)
    return [...users]
}
