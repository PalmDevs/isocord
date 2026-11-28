import { createStore } from 'zustand/vanilla'
import { defineStore } from '../../core/session'
import type { AudioEndpoint } from '../../native/voiceTypes'

declare module '../../core/gateway/events' {
    interface GatewayEvents {
        VOICE_SERVER_UPDATE: VoiceServerUpdate
    }
}

/** VOICE_SERVER_UPDATE: the voice server for our voice state. `endpoint` is null while the server is allocated. */
export interface VoiceServerUpdate {
    token: string
    guild_id: string | null
    channel_id?: string
    endpoint: string | null
}

/**
 * RTCConnectionStore's states, as the UI tells them. `joining` is the voice state sent and the server awaited,
 * `disconnected` a connection that ended while the call stays selected.
 */
export type VoiceConnection =
    | 'idle'
    | 'joining'
    | 'connecting'
    | 'connected'
    | 'reconnecting'
    | 'disconnected'

export interface RtcState {
    /** SelectedChannelStore's voice channel. Both null when not in a call. */
    guildId: string | null
    channelId: string | null
    connection: VoiceConnection
    /** MediaEngineStore's flags: what we asked for. They outlive a call, except `selfVideo`. */
    selfMute: boolean
    selfDeaf: boolean
    selfVideo: boolean
    /** Our voice state's `mute` or `suppress`, and `deaf`: set by a moderator. */
    serverMute: boolean
    serverDeaf: boolean
    /** The session id of our voice state. The voice server identifies us by it. */
    voiceSessionId: string | null
    /** A VOICE_SERVER_UPDATE held until our voice state arrives. */
    server: VoiceServerUpdate | null
    /** DAVE protocol version in use, 0 for none. */
    daveVersion: number
    /** Users speaking now. */
    speaking: readonly string[]
    /** The last user who started speaking, us included, for the PIP's avatar. Null until someone speaks. */
    lastSpeaker: string | null
    /** Users sending camera video. */
    video: readonly string[]
    endpoints: readonly AudioEndpoint[]
    currentEndpoint: string | null
    /** Rejoins since the call last connected, capped by `MAX_REJOINS`. */
    rejoins: number
}

/** The state of a session that is not in a call, keeping the flags. */
export const idleRtc = (
    flags: Pick<RtcState, 'selfMute' | 'selfDeaf'>,
): RtcState => ({
    guildId: null,
    channelId: null,
    connection: 'idle',
    selfMute: flags.selfMute,
    selfDeaf: flags.selfDeaf,
    selfVideo: false,
    serverMute: false,
    serverDeaf: false,
    voiceSessionId: null,
    server: null,
    daveVersion: 0,
    speaking: [],
    lastSpeaker: null,
    video: [],
    endpoints: [],
    currentEndpoint: null,
    rejoins: 0,
})

/** RTCConnectionStore and SelectedChannelStore's voice part: the call we are in and how it is going. */
export const rtcStore = defineStore('rtc', () =>
    createStore<RtcState>(() => idleRtc({ selfMute: false, selfDeaf: false })),
)
