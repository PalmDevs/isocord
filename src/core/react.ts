import { createContext, use } from 'react'
import { useStore } from 'zustand'
import { accountsStore, currentAccount } from './accounts'
import { Session } from './session'
import { traced } from './trace'
import type { StoreApi } from 'zustand/vanilla'
import type { StoreDefinition } from './session'

export const SessionContext = createContext<Session | null>(null)

let active: Session | null = null

/**
 * The session for an account, created on first use. Built synchronously so the very first render
 * already has the cached state, and so the gateway connects while React is still rendering.
 */
export function sessionFor(
    id: string | undefined,
    token: string | undefined,
): Session | null {
    if (active && active.userId === id && active.token === token) return active
    active?.dispose()
    active =
        id && token ? traced('js:session', () => new Session(id, token)) : null
    return active
}

/** Starts the current account's session before React renders. */
export function startCurrentSession(): void {
    const account = currentAccount(accountsStore.getState())
    sessionFor(account?.id, account?.token)
}

export function useSession(): Session {
    const session = use(SessionContext)
    if (!session)
        throw new Error('useSession must be used inside SessionProvider')
    return session
}

/** Whether the gateway's READY has arrived this launch; false while stores hold only the cache (or nothing). */
export function useSessionReady(): boolean {
    return useStore(useSession().connection, state => state.ready)
}

/** Subscribes to a slice of a per-session zustand store. */
export function useSessionStore<State, Slice>(
    definition: StoreDefinition<StoreApi<State>>,
    selector: (state: State) => Slice,
): Slice {
    return useStore(useSession().get(definition), selector)
}
