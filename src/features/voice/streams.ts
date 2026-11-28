import { createStore } from 'zustand/vanilla'
import { defineStore } from '../../core/session'
import type { StreamCreate } from '../../core/discord/streams'

declare module '../../core/gateway/events' {
    interface GatewayEvents {
        STREAM_CREATE: StreamCreate
        STREAM_SERVER_UPDATE: StreamServerUpdate
        STREAM_DELETE: { stream_key: string; reason?: string }
    }
}

/** STREAM_SERVER_UPDATE: the server of a stream we watch or own. `endpoint` is null while it is allocated. */
export interface StreamServerUpdate {
    stream_key: string
    token: string
    endpoint: string | null
}

export interface StreamsState {
    /** The stream we watch or own, at most one at a time (a watch ends the others on mobile). */
    streamKey: string | null
    /** The stream is ours, so its connection sends the screen. */
    own: boolean
    /** Waiting for screen capture consent, after which the stream is created. */
    starting: boolean
    create: StreamCreate | null
    /** Endpoint and token of the open stream connection. Discord can send the same update twice. */
    server: string | null
}

export const NO_STREAM: StreamsState = {
    streamKey: null,
    own: false,
    starting: false,
    create: null,
    server: null,
}

/** ApplicationStreamingStore and StreamRTCConnectionStore: the one stream we watch or own. */
export const streamsStore = defineStore('streams', () =>
    createStore<StreamsState>(() => NO_STREAM),
)
