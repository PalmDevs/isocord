import { AppState } from 'react-native'
import { gateway } from '../../native/IsocordConstants'
import nativeGateway from '../../native/IsocordGateway'
import {
    API_VERSION,
    DEFAULT_GATEWAY_URL,
    GATEWAY_CAPABILITIES,
    WEBSOCKET_ORIGIN,
} from '../constants'
import { Emitter } from '../events'
import { logger } from '../log'
import { isRecording, recordSpan } from '../trace'
import { CloseCode, Opcode } from './opcodes'
import { buildQosToken } from './qos'
import type { ClientIdentity } from '../api/identity'
import type { GatewayEvents, RawDispatch } from './events'

export type ConnectionState =
    | 'disconnected'
    | 'connecting'
    | 'identifying'
    | 'resuming'
    | 'connected'

/**
 * What the client already holds, sent with IDENTIFY so the server can leave it out of READY.
 * A plain `{ guild_versions: {} }` asks for everything.
 */
export interface ClientState {
    /** Newest entity version held, by guild id. */
    guild_versions: Record<string, number>
    /** Highest last message id across the guild channels held. */
    highest_last_message_id?: string
    read_state_version?: number
    user_guild_settings_version?: number
    /** READY's `api_code_version` from the session the cache came from. */
    api_code_version?: number
}

/**
 * A dispatch frame, discriminated by its event name. Trusted: the server sends the payload its name
 * promises. Events without a `GatewayEvents` entry arrive too, for the `raw` listeners.
 */
type DispatchFrame = {
    [K in keyof GatewayEvents]: {
        op: typeof Opcode.DISPATCH
        s: number
        t: K
        d: GatewayEvents[K]
    }
}[keyof GatewayEvents]

/** A frame the client receives, discriminated by its opcode. */
type GatewayPayload =
    | DispatchFrame
    | {
          op: typeof Opcode.HELLO
          s: null
          t: null
          d: { heartbeat_interval: number }
      }
    /** `d` says whether the session can still be resumed. */
    | { op: typeof Opcode.INVALID_SESSION; s: null; t: null; d: boolean }
    | {
          op:
              | typeof Opcode.HEARTBEAT
              | typeof Opcode.HEARTBEAT_ACK
              | typeof Opcode.RECONNECT
          s: null
          t: null
          d: unknown
      }

interface SocketEvents {
    state: ConnectionState
    /** The token was rejected. The socket stops reconnecting. */
    authenticationFailed: undefined
    raw: RawDispatch
}

const {
    minBackoffMs: MIN_BACKOFF_MS,
    maxBackoffMs: MAX_BACKOFF_MS,
    qosVersion: QOS_VERSION,
} = gateway
/** GatewaySocket `expeditedHeartbeat`: how long the ack to a heartbeat sent out of turn may take before reconnecting. */
const EXPEDITED_ACK_MS = 5_000

/** Time budget checked after each frame. */
const DISPATCH_BUDGET_MS = 8
/** DispatcherWorkScheduler._queueIdleCallback: a timer gives rendering and input a turn. */
const DISPATCH_YIELD_MS = 1

/**
 * SessionHeartbeatScheduler: the session is active while the app is in the foreground ("foregrounded"). The
 * reference also counts a voice call, which Isocord does not have.
 */
const qosPayload = () => {
    const active = AppState.currentState === 'active'
    return { ver: QOS_VERSION, active, reasons: active ? ['foregrounded'] : [] }
}

/** The reference's GatewaySocket logger. Payload sizes, timings and codes only, never contents. */
const log = logger('GatewaySocket')

/** How big READY was and how many guilds the server sent in full, partially or not at all. */
function logReadySize(
    ready: { guilds?: Array<{ data_mode?: string; unavailable?: boolean }> },
    chars: number,
): void {
    const counts = { full: 0, partial: 0, unavailable: 0 }
    for (const guild of ready.guilds ?? []) {
        if (guild.data_mode === 'partial') counts.partial++
        else if (guild.data_mode === 'unavailable' || guild.unavailable)
            counts.unavailable++
        else counts.full++
    }
    log.info(
        `READY payload: ${chars} chars (${Math.round(chars / 1024)} KB), ` +
            `guilds full ${counts.full}, ` +
            `partial ${counts.partial}, unavailable ${counts.unavailable}`,
    )
}

/**
 * RequestGatewaySocket `describeConnectionReasons`: in the foreground the app container holds the socket
 * open ("AppContainer:" + its app entry key); in the background nothing does.
 */
const connectionReasons = () =>
    AppState.currentState === 'active' ? 'AppContainer:main' : 'NO_REASONS'

/**
 * One gateway connection for one account: JSON over zstd-stream, with
 * heartbeating, resume and reconnect backoff.
 */
export class GatewaySocket {
    /** Typed dispatch events (`MESSAGE_CREATE`, ...). */
    readonly dispatch = new Emitter<GatewayEvents>()
    /** Connection lifecycle and untyped dispatches. */
    readonly events = new Emitter<SocketEvents>()

    state: ConnectionState = 'disconnected'

    private ws: WebSocket | null = null
    private seq = 0
    private sessionId: string | null = null
    private resumeUrl: string | null = null
    private heartbeatTimer: ReturnType<typeof setTimeout> | null = null
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null
    private expeditedTimer: ReturnType<typeof setTimeout> | null = null
    private heartbeatInterval = 0
    private heartbeatAcked = true
    private appState: { remove(): void } | null = null
    private backoffMs = MIN_BACKOFF_MS
    private closed = true
    /** Received payloads waiting for the drain, already decompressed by native code. */
    private queue: string[] = []
    /** Index of the next payload to handle. Avoids `shift()`, which copies the queue. */
    private head = 0
    private draining = false
    private drainTimer: ReturnType<typeof setTimeout> | null = null
    /** The socket whose zstd frames native code decompresses, or null when compression is off. */
    private socketId: number | null = null
    /** `performance.now()` when the current socket was created. */
    private openedAt = 0
    /** Native code sends this socket's IDENTIFY (FastConnect `state.identify`), so HELLO must not. */
    private preIdentified = false
    /** In the background with `pauseInBackground` on: closed, the session kept to resume. */
    private paused = false
    /**
     * Close the socket in the background, keeping the session to resume when the app returns. Set while system
     * notifications are on, as their own session (GatewayService.kt) takes over then, so only one connection is open.
     */
    pauseInBackground = false

    /** `getClientState` is asked for the cache state at every IDENTIFY, so it always describes the stores as they are then. */
    constructor(
        private readonly token: string,
        private readonly identity: ClientIdentity,
        private readonly getClientState: () => ClientState,
        /** READY's last `qos_token` for this account (DerivedQosDataStore). */
        private readonly getDerivedQos: () => string | undefined,
        /** Runs one drain slice. GatewaySocketDispatcher `dispatchMultiple` batches store changes here. */
        private readonly runSlice: (slice: () => void) => void,
    ) {}

    /** READY's session id (AuthenticationStore.getSessionId), sent with interactions. Null before READY. */
    get currentSessionId(): string | null {
        return this.sessionId
    }

    connect(): void {
        this.closed = false
        this.appState ??= AppState.addEventListener('change', state => {
            if (state === 'active') this.becameActive()
            else if (state === 'background') this.becameInactive()
        })
        this.open()
    }

    /** Closes for good and ends the session on Discord's side. */
    close(): void {
        this.closed = true
        this.appState?.remove()
        this.appState = null
        this.teardown(1000)
        this.sessionId = null
        this.setState('disconnected')
    }

    /** Returns false when the socket is not open and the payload was dropped. */
    send(op: number, d: unknown): boolean {
        if (this.ws?.readyState !== WebSocket.OPEN) return false
        this.ws.send(JSON.stringify({ op, d }))
        return true
    }

    private setState(state: ConnectionState): void {
        if (this.state === state) return
        this.state = state
        log.info(`State: ${state}`)
        this.events.emit('state', state)
    }

    private open(): void {
        this.disableCompression()
        const base = (this.sessionId && this.resumeUrl) || DEFAULT_GATEWAY_URL
        const supportsZstd = nativeGateway.supportsZstd
        // React Native's WebSocket takes an options argument its typings don't declare.
        const NativeWebSocket = WebSocket as unknown as new (
            url: string,
            protocols: null,
            options: { headers: Record<string, string> },
        ) => WebSocket
        const ws = new NativeWebSocket(
            // The official client asks for zstd whenever its native decompressor supports it, which on Android it does.
            // The background session uses zlib-stream (COMPRESSION in NotificationGateway.kt).
            `${base}/?encoding=json&v=${API_VERSION}${supportsZstd ? '&compress=zstd-stream' : ''}`,
            null,
            {
                // The gateway rejects the handshake (403) unless the origin is Discord's own,
                // and React Native would otherwise send the gateway host as the origin.
                headers: { Origin: WEBSOCKET_ORIGIN },
            },
        )
        this.ws = ws
        this.openedAt = performance.now()
        this.preIdentified = false
        // The frames are decompressed on the socket's reader thread and reach JS as text, so JS only parses them.
        if (supportsZstd) {
            this.socketId = (ws as WebSocket & { _socketId: number })._socketId
            nativeGateway.enableZstdStreamSupport(this.socketId)
        }
        this.setState('connecting')
        this.queue = []
        this.head = 0

        // The frames are only queued here. Handling them in the drain lets the JS thread yield between
        // payloads, so a resume burst does not freeze React and native events.
        ws.onmessage = event => {
            const data = event.data
            // The server mirrors the requested `compress`, so every frame arrives as text.
            if (typeof data !== 'string') {
                log.warn('Binary frame: zstd support is off')
                return
            }
            this.queue.push(data)
            this.scheduleDrain()
        }
        ws.onclose = event => {
            log.warn(
                `Closed: ${event.code}${event.reason ? ` ${event.reason}` : ''}`,
            )
            if (this.ws === ws) this.handleClose(event.code ?? 1006)
        }
        // onclose always follows an error, so reconnecting is handled there.
        ws.onerror = event => {
            log.warn(`Error: ${(event as { message?: string }).message}`)
        }
    }

    /** Queues a drain, unless one is already scheduled. */
    private scheduleDrain(): void {
        if (this.draining) return
        this.draining = true
        // BasicWorkScheduler.requestWorkTimeout skips idle scheduling in the background.
        if (AppState.currentState === 'background') setImmediate(this.drain)
        else this.drainTimer = setTimeout(this.drain, DISPATCH_YIELD_MS)
    }

    private cancelDrainTimer(): void {
        if (this.drainTimer === null) return
        clearTimeout(this.drainTimer)
        this.drainTimer = null
        this.draining = false
    }

    /**
     * Handles queued payloads in order. Yields after the first frame that reaches the time budget.
     */
    private drain = (): void => {
        this.drainTimer = null
        const started = performance.now()
        try {
            this.runSlice(() => {
                // A handler can reconnect, which swaps the queue. Read it fresh each time.
                while (this.head < this.queue.length) {
                    const text = this.queue[this.head] as string
                    // Frees a handled payload (READY is megabytes) while the rest of a burst drains.
                    this.queue[this.head++] = ''
                    this.handleText(text)
                    if (performance.now() - started >= DISPATCH_BUDGET_MS) break
                }
            })
        } finally {
            // A payload that fails to parse still lets the ones behind it through.
            this.draining = false
            if (this.head < this.queue.length) this.scheduleDrain()
            else {
                this.queue = []
                this.head = 0
            }
        }
    }

    /** Parses a payload and hands it to the store listeners. */
    private handleText(text: string): void {
        // Where a large payload (READY) spends its time on the JS thread.
        const t0 = performance.now()
        const payload: GatewayPayload = JSON.parse(text)
        const t1 = performance.now()
        this.handlePayload(payload)
        const t2 = performance.now()
        if (text.length > 100_000) {
            const ms = (value: number) => Math.round(value)
            log.info(
                `${payload.t}: ${ms(text.length / 1024)} KB, ` +
                    `parse ${ms(t1 - t0)} ms, handlers ${ms(t2 - t1)} ms`,
            )
        }
        if (payload.t === 'READY') logReadySize(payload.d, text.length)
    }

    /** Stops native decompression for the current socket and frees its zstd stream. */
    private disableCompression(): void {
        if (this.socketId === null) return
        nativeGateway.disableZstdStreamSupport(this.socketId)
        this.socketId = null
    }

    private handlePayload(payload: GatewayPayload): void {
        switch (payload.op) {
            case Opcode.HELLO:
                this.logHello()
                this.startHeartbeat(payload.d.heartbeat_interval)
                if (this.sessionId) this.resume()
                else if (this.preIdentified) {
                    // GatewaySocket `_doFastConnectIdentify`: native code already sent IDENTIFY.
                    this.seq = 0
                    this.setState('identifying')
                } else this.identify()
                break
            case Opcode.DISPATCH:
                this.seq = payload.s
                this.handleDispatch(payload)
                break
            case Opcode.HEARTBEAT:
                this.sendHeartbeat()
                break
            case Opcode.HEARTBEAT_ACK:
                this.heartbeatAcked = true
                break
            case Opcode.RECONNECT:
                log.info('Server asked to reconnect')
                this.reconnect()
                break
            case Opcode.INVALID_SESSION:
                log.warn(`Invalid session, resumable: ${payload.d}`)
                if (!payload.d) this.sessionId = null
                this.reconnect()
                break
        }
    }

    private handleDispatch(frame: DispatchFrame): void {
        if (frame.t === 'READY') {
            this.sessionId = frame.d.session_id
            this.resumeUrl = frame.d.resume_gateway_url
        }
        if (frame.t === 'READY' || frame.t === 'RESUMED') {
            this.backoffMs = MIN_BACKOFF_MS
            this.setState('connected')
        }
        this.dispatch.emit(frame.t, frame.d)
        this.events.emit('raw', { type: frame.t, data: frame.d })
    }

    /**
     * Hands this socket's IDENTIFY to native code, which sends it on HELLO (fast_connect `identifyWebSocket`).
     * Only before the first HELLO of a new session. RESUME and reconnects stay in JS.
     */
    prepareIdentify(): void {
        if (
            this.preIdentified ||
            this.sessionId ||
            this.socketId === null ||
            this.state !== 'connecting'
        )
            return
        this.preIdentified = nativeGateway.prepareIdentify(
            this.socketId,
            JSON.stringify({
                op: Opcode.IDENTIFY,
                d: this.identifyPayload(true),
            }),
        )
        log.info(`IDENTIFY prepared for native code: ${this.preIdentified}`)
    }

    /** Logs how long HELLO took since opening. Network plus any wait for the JS thread. */
    private logHello(): void {
        const waited = performance.now() - this.openedAt
        log.info(`HELLO handled ${Math.round(waited)} ms after opening`)
        if (isRecording())
            recordSpan({
                name: 'gateway:hello handled',
                start: this.openedAt,
                duration: waited,
                thread: 'js',
            })
    }

    private identify(): void {
        this.seq = 0
        this.setState('identifying')
        this.send(Opcode.IDENTIFY, this.identifyPayload(false))
    }

    /** Returns IDENTIFY's `d`, with `client_state` as the stores are now. */
    private identifyPayload(isFastConnect: boolean) {
        const clientState = this.getClientState()
        log.debug(
            `client_state: ${Object.keys(clientState.guild_versions).length} guild versions, ` +
                `read_state ${clientState.read_state_version !== undefined}, ` +
                `highest_last_message_id ${clientState.highest_last_message_id !== undefined}, ` +
                `user_guild_settings ${clientState.user_guild_settings_version !== undefined}, ` +
                `api_code_version ${clientState.api_code_version ?? 'none'}`,
        )
        // GatewaySocketSingleton `handleIdentify` and GatewaySocket's IDENTIFY, in their key order. The
        // installation id is left out: the reference sends it only with analytics consent.
        const active = AppState.currentState === 'active'
        return {
            token: this.token,
            capabilities: GATEWAY_CAPABILITIES,
            properties: {
                ...this.identity.superProperties(),
                is_fast_connect: isFastConnect,
                gateway_connect_reasons: connectionReasons(),
            },
            presence: {
                status: 'unknown',
                since: 0,
                activities: [],
                // The background session sends true (IDENTIFY_AFK in NotificationGateway.kt).
                afk: false,
            },
            compress: false,
            client_state: clientState,
            qos_token: buildQosToken(this.getDerivedQos(), active),
        }
    }

    private resume(): void {
        this.setState('resuming')
        this.send(Opcode.RESUME, {
            token: this.token,
            session_id: this.sessionId,
            seq: this.seq,
        })
    }

    private startHeartbeat(intervalMs: number): void {
        this.heartbeatInterval = intervalMs
        this.heartbeatAcked = true
        this.scheduleHeartbeat(intervalMs * Math.random())
    }

    private scheduleHeartbeat(delay: number): void {
        if (this.heartbeatTimer) clearTimeout(this.heartbeatTimer)
        this.heartbeatTimer = setTimeout(() => {
            // A missed ack means the connection is dead even if the socket is open.
            if (!this.heartbeatAcked) {
                log.warn('Heartbeat not acknowledged, reconnecting')
                return this.reconnect()
            }
            this.sendHeartbeat()
            this.scheduleHeartbeat(this.heartbeatInterval)
        }, delay)
    }

    /** GatewaySocket `_sendHeartbeat`: every heartbeat is a QoS heartbeat, telling the server whether the app is in use. */
    private sendHeartbeat(): void {
        this.heartbeatAcked = false
        this.send(Opcode.QOS_HEARTBEAT, {
            seq: this.seq || null,
            qos: qosPayload(),
        })
    }

    /**
     * Handles the app returning to the foreground.
     * GatewayConnectionStore `APP_STATE_UPDATE` calls `resetBackoff`, so a waiting reconnect happens now.
     * SessionHeartbeatScheduler's `handleActiveStateChange` sends a heartbeat at once.
     * Unlike the reference, that heartbeat is expedited (`expeditedHeartbeat`, kept for notification taps).
     * JS timers stop in the background, so a dead socket would go unnoticed for a whole interval.
     */
    private becameActive(): void {
        if (this.closed) return
        this.backoffMs = MIN_BACKOFF_MS
        if (this.paused) {
            this.paused = false
            this.open()
            return
        }
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer)
            this.reconnectTimer = null
            this.open()
            return
        }
        if (this.state !== 'connected' && this.state !== 'resuming') return
        this.sendHeartbeat()
        this.scheduleHeartbeat(this.heartbeatInterval)
        if (this.expeditedTimer) clearTimeout(this.expeditedTimer)
        this.expeditedTimer = setTimeout(() => {
            this.expeditedTimer = null
            if (this.heartbeatAcked) return
            log.warn('Expedited heartbeat not acknowledged, reconnecting')
            this.reconnect()
        }, EXPEDITED_ACK_MS)
    }

    /** Pauses for the background session, which resumes its own session when told the app has left (AppVisibility). */
    private becameInactive(): void {
        if (this.closed || this.paused) return
        if (!this.pauseInBackground) {
            // Android suspends timers while the activity is paused.
            this.cancelDrainTimer()
            if (this.head < this.queue.length) this.scheduleDrain()
            return
        }
        this.paused = true
        this.teardown(CloseCode.RESUMABLE)
        this.setState('disconnected')
    }

    private handleClose(code: number): void {
        this.teardown()
        if (this.closed) return

        if (code === CloseCode.AUTHENTICATION_FAILED) {
            log.error('Token rejected, logging out')
            this.closed = true
            this.setState('disconnected')
            this.events.emit('authenticationFailed', undefined)
            return
        }
        if (
            code === CloseCode.INVALID_SEQ ||
            code === CloseCode.SESSION_TIMED_OUT
        )
            this.sessionId = null

        this.setState('disconnected')
        const delay = this.backoffMs * (0.5 + Math.random() / 2)
        this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS)
        log.info(`Reconnecting in ${Math.round(delay)} ms`)
        // Cleared when it fires, or becameActive would take it as still waiting and open a second socket.
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null
            this.open()
        }, delay)
    }

    /** Drops the connection without ending the session, then reconnects. */
    private reconnect(): void {
        this.teardown(CloseCode.RESUMABLE)
        if (!this.closed) this.open()
    }

    private teardown(closeCode?: number): void {
        this.cancelDrainTimer()
        if (this.heartbeatTimer) clearTimeout(this.heartbeatTimer)
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
        if (this.expeditedTimer) clearTimeout(this.expeditedTimer)
        this.heartbeatTimer = this.reconnectTimer = this.expeditedTimer = null
        const ws = this.ws
        this.ws = null
        this.disableCompression()
        this.queue = []
        this.head = 0
        if (ws && closeCode !== undefined) {
            ws.onmessage = ws.onclose = ws.onerror = null
            ws.close(closeCode)
        }
    }
}
