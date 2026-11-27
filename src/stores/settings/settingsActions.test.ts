import { afterEach, describe, expect, it, mock } from 'bun:test'
import { stubNativeModules } from '../../features/chat/rows/nativeStubs'
import type { Session } from '../../core/session'

await stubNativeModules()
const { ApiError } = await import('../../core/api/rest')
const { setCategoryCollapsed } = await import('./settingsActions')
const { settingsStore } = await import('./settingsStore')
const { updateGuildSettings } = await import('./notificationActions')

type Listener = (payload: unknown) => void

function createTestSession(
    patchImpl: (path: string, opts: unknown) => Promise<unknown>,
) {
    const listeners = new Map<string, Listener[]>()
    const stores = new Map<unknown, unknown>()
    const session = {
        gateway: {
            dispatch: {
                on(event: string, fn: Listener) {
                    const list = listeners.get(event) ?? []
                    list.push(fn)
                    listeners.set(event, list)
                },
            },
        },
        rest: {
            identity: { accountLocale: 'en-US' },
            patch: mock(patchImpl),
        },
        registerClientState: () => {},
        get(factory: { create?: (s: Session) => unknown }) {
            let existing = stores.get(factory)
            if (!existing && factory.create) {
                existing = factory.create(session as unknown as Session)
                stores.set(factory, existing)
            }
            return existing
        },
    }
    return {
        session: session as unknown as Session,
        emit(event: string, payload: unknown) {
            for (const fn of listeners.get(event) ?? []) fn(payload)
        },
    }
}

describe('setCategoryCollapsed', () => {
    afterEach(() => {
        mock.restore()
    })

    it('applies optimistically and coalesces rapid toggles into one PATCH', async () => {
        const { session } = createTestSession(async () => ({}))
        const store = session.get(settingsStore)

        setCategoryCollapsed(session, 'g1', 'c1', true)
        setCategoryCollapsed(session, 'g1', 'c1', false)
        setCategoryCollapsed(session, 'g1', 'c2', true)

        expect(store.getState().guildSettings.g1?.collapsedCategories).toEqual({
            c2: true,
        })
        expect(store.getState().pendingCollapsedCategories?.g1).toEqual({
            c1: false,
            c2: true,
        })
        expect(session.rest.patch).toHaveBeenCalledTimes(0)

        await new Promise(resolve => setTimeout(resolve, 600))

        expect(session.rest.patch).toHaveBeenCalledTimes(1)
        expect(session.rest.patch).toHaveBeenCalledWith(
            '/users/@me/guilds/g1/settings',
            {
                body: {
                    channel_overrides: {
                        c1: { collapsed: false },
                        c2: { collapsed: true },
                    },
                },
                retries: 2,
            },
        )
        expect(store.getState().pendingCollapsedCategories?.g1).toEqual({})
    })

    it('keeps pending collapse state when stale USER_GUILD_SETTINGS_UPDATE arrives', async () => {
        const { session, emit } = createTestSession(async () => ({}))
        const store = session.get(settingsStore)

        setCategoryCollapsed(session, 'g1', 'c1', true)
        emit('USER_GUILD_SETTINGS_UPDATE', {
            guild_id: 'g1',
            channel_overrides: [{ channel_id: 'c1', collapsed: false }],
        })

        expect(store.getState().guildSettings.g1?.collapsedCategories).toEqual({
            c1: true,
        })

        await new Promise(resolve => setTimeout(resolve, 600))
    })

    it('retries failed requests while keeping optimistic state', async () => {
        let calls = 0
        const { session } = createTestSession(async () => {
            calls++
            if (calls === 1)
                throw new ApiError(429, { message: 'rate limited' }, 0)
            return {}
        })
        const store = session.get(settingsStore)

        setCategoryCollapsed(session, 'g1', 'c1', true)
        await new Promise(resolve => setTimeout(resolve, 600))

        expect(calls).toBe(1)
        expect(store.getState().guildSettings.g1?.collapsedCategories).toEqual({
            c1: true,
        })
        expect(store.getState().pendingCollapsedCategories?.g1).toEqual({
            c1: true,
        })

        await new Promise(resolve => setTimeout(resolve, 600))

        expect(calls).toBe(2)
        expect(store.getState().pendingCollapsedCategories?.g1).toEqual({})
    })
})

describe('updateGuildSettings', () => {
    it('keeps a pending change over a stale update until the save settles', async () => {
        let settle = () => {}
        const { session, emit } = createTestSession(
            () => new Promise(resolve => (settle = () => resolve({}))),
        )
        const store = session.get(settingsStore)

        updateGuildSettings(session, 'g1', { suppress_roles: true })
        emit('USER_GUILD_SETTINGS_UPDATE', {
            guild_id: 'g1',
            suppress_roles: false,
        })

        expect(store.getState().guildSettings.g1?.suppressRoles).toBe(true)

        settle()
        await new Promise(resolve => setTimeout(resolve, 0))

        expect(store.getState().pendingGuildSettings?.g1).toEqual({})
    })
})
