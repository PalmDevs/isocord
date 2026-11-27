/// <reference types="bun" />
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { stubNativeModules } from '../../features/chat/rows/nativeStubs'
import { Opcode } from './opcodes'
import type { GatewaySocket as Socket } from './socket'

await stubNativeModules()

/** IDENTIFY payloads handed to native code, and whether it takes them. */
const prepared: Array<{ socketId: number; payload: string }> = []
let nativeTakes = true
mock.module('../../native/IsocordGateway', () => ({
    default: {
        supportsZstd: true,
        enableZstdStreamSupport: () => {},
        disableZstdStreamSupport: () => {},
        prepareIdentify: (socketId: number, payload: string) => {
            prepared.push({ socketId, payload })
            return nativeTakes
        },
    },
}))

/** Records what the client sends. Frames arrive through `receive`. */
class FakeWebSocket {
    static readonly OPEN = 1
    static last: FakeWebSocket
    static nextId = 0
    readonly _socketId = FakeWebSocket.nextId++
    readyState = FakeWebSocket.OPEN
    sent: Array<{ op: number; d: Record<string, unknown> }> = []
    onmessage: ((event: { data: string }) => void) | null = null
    onclose: unknown = null
    onerror: unknown = null
    constructor() {
        FakeWebSocket.last = this
    }
    send(text: string) {
        this.sent.push(JSON.parse(text))
    }
    close() {}
    receive(op: number, d: unknown, t: string | null = null, s = 0) {
        this.onmessage?.({ data: JSON.stringify({ op, d, t, s }) })
    }
}
Object.assign(globalThis, { WebSocket: FakeWebSocket })

const { GatewaySocket } = await import('./socket')

const HELLO = { heartbeat_interval: 41_250 }
/** Lets the drain timer handle the frames received so far. */
const drained = () => Bun.sleep(10)
const ops = (ws: FakeWebSocket) => ws.sent.map(frame => frame.op)

let socket: Socket

beforeEach(() => {
    prepared.length = 0
    nativeTakes = true
    socket = new GatewaySocket(
        'token',
        { superProperties: () => ({}) } as never,
        () => ({ guild_versions: { '1': 5 } }),
        () => undefined,
        slice => slice(),
    )
    socket.connect()
})

afterEach(() => socket.close())

describe('fast connect', () => {
    test('native sends IDENTIFY, so JS skips its own', async () => {
        socket.prepareIdentify()
        socket.prepareIdentify()
        const ws = FakeWebSocket.last
        expect(prepared).toHaveLength(1)
        expect(prepared[0]?.socketId).toBe(ws._socketId)
        const identify = JSON.parse(prepared[0]?.payload ?? '')
        expect(identify.op).toBe(Opcode.IDENTIFY)
        expect(identify.d.properties.is_fast_connect).toBe(true)
        expect(identify.d.client_state).toEqual({ guild_versions: { '1': 5 } })

        ws.receive(Opcode.HELLO, HELLO)
        await drained()
        expect(ops(ws)).not.toContain(Opcode.IDENTIFY)
        expect(socket.state).toBe('identifying')
    })

    test('JS identifies when native did not take the payload', async () => {
        nativeTakes = false
        socket.prepareIdentify()
        const ws = FakeWebSocket.last
        ws.receive(Opcode.HELLO, HELLO)
        await drained()
        expect(ops(ws)).toEqual([Opcode.IDENTIFY])
        expect(ws.sent[0]?.d.properties).toMatchObject({
            is_fast_connect: false,
        })
    })

    test('too late once JS handled HELLO', async () => {
        const ws = FakeWebSocket.last
        ws.receive(Opcode.HELLO, HELLO)
        await drained()
        socket.prepareIdentify()
        expect(prepared).toHaveLength(0)
        expect(ops(ws)).toEqual([Opcode.IDENTIFY])
    })

    test('RESUME is never pre-sent', async () => {
        socket.prepareIdentify()
        const first = FakeWebSocket.last
        first.receive(Opcode.HELLO, HELLO)
        first.receive(
            Opcode.DISPATCH,
            { session_id: 'abc', resume_gateway_url: 'wss://resume' },
            'READY',
            1,
        )
        first.receive(Opcode.RECONNECT, null)
        await drained()
        const second = FakeWebSocket.last
        expect(second).not.toBe(first)

        socket.prepareIdentify()
        expect(prepared).toHaveLength(1)
        second.receive(Opcode.HELLO, HELLO)
        await drained()
        expect(ops(second)).toEqual([Opcode.RESUME])
    })
})
