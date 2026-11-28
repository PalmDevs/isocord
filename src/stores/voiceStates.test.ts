/// <reference types="bun" />
import { describe, expect, test } from 'bun:test'
import { stubNativeModules } from '../features/chat/rows/nativeStubs'
import type { Session } from '../core/session'

await stubNativeModules()
const { Emitter } = await import('../core/events')
const { channelVoiceStates, voiceStatesStore } = await import('./voiceStates')

const GUILD = '10'
const CHANNEL = '20'

/** Returns the store on a session that has only a gateway dispatcher. */
function setup() {
    const dispatch = new Emitter<Record<string, unknown>>()
    const session = { userId: '1', gateway: { dispatch } } as unknown as Session
    return { dispatch, store: voiceStatesStore.create(session) }
}

const raw = (userId: string) => ({
    user_id: userId,
    channel_id: CHANNEL,
    session_id: `s${userId}`,
})

describe('voiceStates', () => {
    test('READY_SUPPLEMENTAL brings the guilds voice states', () => {
        const { dispatch, store } = setup()
        dispatch.emit('READY', { guilds: [{ id: GUILD }] })
        dispatch.emit('READY_SUPPLEMENTAL', {
            guilds: [
                { id: GUILD, voice_states: [raw('2'), raw('3')] },
                { id: '11', unavailable: true },
            ],
        })
        const users = channelVoiceStates(store.getState(), CHANNEL).map(
            voice => voice.userId,
        )
        expect(users).toEqual(['2', '3'])
    })

    test('READY_SUPPLEMENTAL replaces what was held', () => {
        const { dispatch, store } = setup()
        dispatch.emit('VOICE_STATE_UPDATE', { ...raw('4'), guild_id: GUILD })
        dispatch.emit('READY_SUPPLEMENTAL', {
            guilds: [{ id: GUILD, voice_states: [raw('2')] }],
        })
        const users = channelVoiceStates(store.getState(), CHANNEL).map(
            voice => voice.userId,
        )
        expect(users).toEqual(['2'])
    })

    test('VOICE_STATE_UPDATE_BATCH applies each update', () => {
        const { dispatch, store } = setup()
        dispatch.emit('VOICE_STATE_UPDATE_BATCH', {
            voice_states: [
                { ...raw('2'), guild_id: GUILD },
                { ...raw('3'), guild_id: GUILD },
            ],
        })
        expect(channelVoiceStates(store.getState(), CHANNEL)).toHaveLength(2)
    })
})
