/// <reference types="bun" />
import { describe, expect, test } from 'bun:test'
import { stubNativeModules } from '../features/chat/rows/nativeStubs'
import type { Session } from '../core/session'

// Stubs only the native packages, so every test file gets the real core modules.
await stubNativeModules()
const { Emitter } = await import('../core/events')
const { NotifyBatch } = await import('../core/notifyBatch')
const { presencesStore } = await import('./presences')

const ME = '1'

/** Returns the store on a session that has only a gateway dispatcher. */
function setup() {
    const dispatch = new Emitter<Record<string, unknown>>()
    const session = { userId: ME, gateway: { dispatch } } as unknown as Session
    return { dispatch, store: presencesStore.create(session) }
}

describe('presences', () => {
    test('an update replaces the entry and keeps the map', () => {
        const { dispatch, store } = setup()
        dispatch.emit('PRESENCE_UPDATE', { user: { id: '2' }, status: 'idle' })
        const map = store.getState().presences
        const before = map['2']
        dispatch.emit('PRESENCE_UPDATE', { user: { id: '2' }, status: 'dnd' })
        expect(store.getState().presences['2']).toEqual({ status: 'dnd' })
        expect(store.getState().presences['2']).not.toBe(before)
        expect(store.getState().presences).toBe(map)
    })

    test('a view selecting one entry sees its change once per slice', () => {
        const { dispatch, store } = setup()
        const batch = new NotifyBatch()
        const view = batch.view(store)
        // What useStore does: re-run the selector on each notification and compare the result.
        const select = () => view.getState().presences['2']?.status
        let selected = select()
        const seen: Array<string | undefined> = []
        view.subscribe(() => {
            const next = select()
            if (next !== selected) seen.push((selected = next))
        })
        batch.batched(() => {
            dispatch.emit('PRESENCE_UPDATE', {
                user: { id: '2' },
                status: 'idle',
            })
            dispatch.emit('PRESENCE_UPDATE', {
                user: { id: '3' },
                status: 'online',
            })
        })
        expect(seen).toEqual(['idle'])
        batch.batched(() =>
            dispatch.emit('PRESENCE_UPDATE', {
                user: { id: '2' },
                status: 'dnd',
            }),
        )
        expect(seen).toEqual(['idle', 'dnd'])
    })

    test('ignores PRESENCE_UPDATE for the current user', () => {
        const { dispatch, store } = setup()
        dispatch.emit('PRESENCE_UPDATE', { user: { id: ME }, status: 'idle' })
        expect(store.getState().presences[ME]).toBeUndefined()
    })

    test('READY starts a new map', () => {
        const { dispatch, store } = setup()
        dispatch.emit('PRESENCE_UPDATE', { user: { id: '2' }, status: 'idle' })
        const map = store.getState().presences
        dispatch.emit('READY', {})
        expect(store.getState().presences).not.toBe(map)
        expect(store.getState().presences).toEqual({})
    })

    test('friends from READY_SUPPLEMENTAL are added', () => {
        const { dispatch, store } = setup()
        dispatch.emit('READY_SUPPLEMENTAL', {
            merged_presences: {
                friends: [
                    {
                        user_id: '2',
                        status: 'online',
                        client_status: { mobile: 'online' },
                    },
                ],
            },
        })
        expect(store.getState().presences['2']).toEqual({
            status: 'online',
            mobile: true,
        })
    })
})
