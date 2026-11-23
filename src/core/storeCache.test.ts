/// <reference types="bun" />
import { beforeEach, describe, expect, test } from 'bun:test'
import { createStore } from 'zustand/vanilla'
import { stubNativeModules } from '../features/chat/rows/nativeStubs'
import type { CacheReferences, Session, StoreDefinition } from './session'

// Stubs only the native packages, so every test file gets the real core modules.
await stubNativeModules()
const { StoreCache } = await import('./storeCache')

type Definition = StoreDefinition<unknown>

/** Map-backed storage that records each write. */
function memoryStorage() {
    const values = new Map<string, string>()
    const writes: string[] = []
    return {
        values,
        writes,
        getString: (key: string) => values.get(key),
        set: (key: string, value: string | number | boolean | ArrayBuffer) => {
            writes.push(key)
            values.set(key, String(value))
        },
        remove: (key: string) => values.delete(key),
    }
}

/** Idle callbacks run only when a test calls `runIdle`. */
let idle: Array<() => void> = []
const runIdle = () => idle.shift()?.()
globalThis.requestIdleCallback = ((callback: () => void) =>
    idle.push(callback)) as typeof requestIdleCallback
globalThis.cancelIdleCallback = () => {
    idle = []
}

const session = { userId: 'me' } as Session
const define = (name: string, options: object): Definition =>
    ({ name, create: () => undefined, ...options }) as Definition
const cacheOf = (storage = memoryStorage()) =>
    new StoreCache(session, storage, () => '1', true)

beforeEach(() => {
    idle = []
})

describe('restore', () => {
    test('waits for idle time or a forced restore when deferred', () => {
        const storage = memoryStorage()
        storage.set(
            'cache.a',
            JSON.stringify({ version: '1', state: { n: 1 } }),
        )
        storage.set(
            'cache.b',
            JSON.stringify({ version: '1', state: { n: 2 } }),
        )
        const cache = cacheOf(storage)
        const a = define('a', { cache: ['n'] })
        const b = define('b', { cache: ['n'] })
        const storeA = createStore(() => ({ n: 0 }))
        const storeB = createStore(() => ({ n: 0 }))
        cache.add(a, storeA, true)
        cache.add(b, storeB, true)
        expect(storeA.getState().n).toBe(0)

        cache.restorePending(b)
        expect(storeB.getState().n).toBe(2)
        expect(storeA.getState().n).toBe(0)

        cache.restoreWhenIdle()
        runIdle()
        expect(storeA.getState().n).toBe(1)
        expect(idle).toEqual([])
        expect(cache.restored).toBe(2)
    })

    test('restores at once when not deferred, and ignores another version', () => {
        const storage = memoryStorage()
        storage.set(
            'cache.a',
            JSON.stringify({ version: '0', state: { n: 1 } }),
        )
        const store = createStore(() => ({ n: 0 }))
        const cache = cacheOf(storage)
        cache.add(define('a', { cache: ['n'] }), store, false)
        expect(store.getState().n).toBe(0)
        expect(cache.restored).toBe(0)
    })
})

describe('parts', () => {
    type Guilds = { guilds: Record<string, { name: string }> }
    const parted = define('g', {
        cache: ['guilds'],
        cacheParts: {
            split: ({ guilds = {} }: Partial<Guilds>) => guilds,
            join: (parts: Record<string, object>) => ({ guilds: parts }),
        },
    })

    test('rewrites only the changed part', () => {
        const storage = memoryStorage()
        const cache = cacheOf(storage)
        const store = createStore<Guilds>(() => ({ guilds: {} }))
        cache.add(parted, store, false)
        store.setState({ guilds: { 1: { name: 'one' }, 2: { name: 'two' } } })
        cache.save()
        expect(storage.writes.sort()).toEqual([
            'cache.g',
            'cache.g.1',
            'cache.g.2',
        ])

        storage.writes.length = 0
        store.setState(state => ({
            guilds: { ...state.guilds, 2: { name: 'deux' } },
        }))
        cache.save()
        expect(storage.writes.sort()).toEqual(['cache.g', 'cache.g.2'])

        store.setState({ guilds: { 2: { name: 'deux' } } })
        cache.save()
        expect(storage.values.has('cache.g.1')).toBe(false)
    })

    test('restores the parts and leaves them unwritten until they change', () => {
        const storage = memoryStorage()
        const first = cacheOf(storage)
        const before = createStore<Guilds>(() => ({ guilds: {} }))
        first.add(parted, before, false)
        before.setState({ guilds: { 1: { name: 'one' }, 2: { name: 'two' } } })
        first.save()

        const cache = cacheOf(storage)
        const store = createStore<Guilds>(() => ({ guilds: {} }))
        cache.add(parted, store, false)
        expect(store.getState().guilds).toEqual({
            1: { name: 'one' },
            2: { name: 'two' },
        })
        storage.writes.length = 0
        store.setState(state => ({
            guilds: { ...state.guilds, 1: { name: 'uno' } },
        }))
        cache.save()
        expect(storage.writes.sort()).toEqual(['cache.g', 'cache.g.1'])
    })
})

describe('save', () => {
    /** A store whose saved ids are referenced users, and a users store that keeps only those. */
    function referencing() {
        let picks = 0
        const ids = define('ids', {
            cache: (state: { ids: string[] }) => {
                picks++
                return state
            },
            references: (
                saved: { ids?: string[] },
                references: CacheReferences,
            ) => {
                for (const id of saved.ids ?? []) references.users.add(id)
            },
        })
        const users = define('users', {
            cache: (
                state: { users: Record<string, string> },
                references: () => CacheReferences,
            ) => ({
                users: Object.fromEntries(
                    [...references().users].map(id => [id, state.users[id]]),
                ),
            }),
        })
        return { ids, users, picks: () => picks }
    }

    test('picks a clean store once for its references', () => {
        const storage = memoryStorage()
        const cache = cacheOf(storage)
        const { ids, users, picks } = referencing()
        const idsStore = createStore(() => ({ ids: ['a'] }))
        const usersStore = createStore(() => ({
            users: { me: 'Me', a: 'A', b: 'B' } as Record<string, string>,
        }))
        cache.add(ids, idsStore, false)
        cache.add(users, usersStore, false)

        usersStore.setState(state => ({ users: { ...state.users } }))
        cache.save()
        usersStore.setState(state => ({ users: { ...state.users } }))
        cache.save()
        expect(picks()).toBe(1)
        expect(JSON.parse(storage.values.get('cache.users') ?? '')).toEqual({
            version: '1',
            state: { users: { me: 'Me', a: 'A' } },
        })

        idsStore.setState({ ids: ['b'] })
        usersStore.setState(state => ({ users: { ...state.users } }))
        cache.save()
        expect(
            JSON.parse(storage.values.get('cache.users') ?? '').state,
        ).toEqual({ users: { me: 'Me', b: 'B' } })
    })

    test('writes one store per idle callback, referencing stores first', () => {
        const storage = memoryStorage()
        const cache = cacheOf(storage)
        const { ids, users } = referencing()
        const idsStore = createStore(() => ({ ids: [] as string[] }))
        const usersStore = createStore(() => ({
            users: { me: 'Me', b: 'B' } as Record<string, string>,
        }))
        cache.add(users, usersStore, false)
        cache.add(ids, idsStore, false)
        usersStore.setState(state => ({ users: { ...state.users } }))
        idsStore.setState({ ids: ['b'] })

        cache.saveWhenIdle()
        runIdle()
        expect(storage.writes).toEqual(['cache.ids'])
        runIdle()
        expect(storage.writes).toEqual(['cache.ids', 'cache.users'])
        expect(
            JSON.parse(storage.values.get('cache.users') ?? '').state,
        ).toEqual({ users: { me: 'Me', b: 'B' } })
        expect(idle).toEqual([])
    })
})
