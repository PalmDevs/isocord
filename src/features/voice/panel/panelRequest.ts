import { useEffect } from 'react'
import { createStore } from 'zustand/vanilla'
import { useSession, useSessionStore } from '../../../core/react'
import { defineStore } from '../../../core/session'
import type { Session } from '../../../core/session'

/**
 * A request from outside the dock to open the full voice panel, such as the call overlay's expand. It waits until
 * the call's card handles it, so a card that mounts later, in a recreated activity, still opens.
 */
export const panelRequestStore = defineStore('voicePanelRequest', () =>
    createStore<{ requested: boolean }>(() => ({ requested: false })),
)

/** Asks the call's card to open the full panel. */
export function requestPanel(session: Session): void {
    session.get(panelRequestStore).setState({ requested: true })
}

/** Opens the panel with `expand` when it is requested. Only the call's own card, not a pre-join, handles it. */
export function usePanelRequest(handles: boolean, expand: () => void): void {
    const session = useSession()
    const requested = useSessionStore(
        panelRequestStore,
        state => state.requested,
    )
    // biome-ignore lint/correctness/useExhaustiveDependencies: the request is the trigger, `expand` changes each render.
    useEffect(() => {
        if (!requested || !handles) return
        session.get(panelRequestStore).setState({ requested: false })
        expand()
    }, [requested, handles, session])
}
