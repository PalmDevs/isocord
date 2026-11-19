import { useEffect } from 'react'
import { useStore } from 'zustand'
import { accountsStore, currentAccount } from './accounts'
import { SessionContext, sessionFor } from './react'
import type { ReactNode } from 'react'

/** Mounted SessionProviders. A recreated activity mounts its new one before the old one unmounts. */
let providers = 0

/** Provides the session for the current account and replaces it when the account changes. */
export function SessionProvider({
    children,
    fallback,
}: {
    children: ReactNode
    fallback: ReactNode
}) {
    const account = useStore(accountsStore, currentAccount)
    // A session is tied to the account's identity and token, not its profile fields.
    const session = sessionFor(account?.id, account?.token)

    // Unmounting the last provider (not an account switch, which sessionFor handles) ends the session.
    useEffect(() => {
        providers++
        return () => {
            providers--
            if (providers === 0) sessionFor(undefined, undefined)
        }
    }, [])

    if (!session) return fallback
    return <SessionContext value={session}>{children}</SessionContext>
}
