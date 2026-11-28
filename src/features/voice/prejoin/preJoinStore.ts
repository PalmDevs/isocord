import { createStore } from 'zustand/vanilla'
import { defineStore } from '../../../core/session'
import type { Session } from '../../../core/session'

export interface PreJoinState {
    /** The voice channel the pre-join card shows. Both null while it is closed. */
    guildId: string | null
    channelId: string | null
    /** The card is leaving: it clears the state once its exit ends. */
    closing: boolean
}

const NO_PRE_JOIN: PreJoinState = {
    guildId: null,
    channelId: null,
    closing: false,
}

/** The voice panel's pre-join state (VoicePanelPreJoinWrapper): the channel it shows before we join. */
export const preJoinStore = defineStore('voicePreJoin', () =>
    createStore<PreJoinState>(() => NO_PRE_JOIN),
)

/** Shows the pre-join card for a voice channel, or switches it to that channel. */
export function openPreJoin(
    session: Session,
    guildId: string,
    channelId: string,
): void {
    session.get(preJoinStore).setState({ guildId, channelId, closing: false })
}

/** Starts the card's exit. It clears the state when the exit ends (`preJoinClosed`). */
export function dismissPreJoin(session: Session): void {
    const store = session.get(preJoinStore)
    if (store.getState().channelId) store.setState({ closing: true })
}

/** Ends a dismissal once the exit has played. A tap that reopened the card meanwhile keeps it. */
export function preJoinClosed(session: Session): void {
    const store = session.get(preJoinStore)
    if (store.getState().closing) store.setState(NO_PRE_JOIN)
}

/** Drops the pre-join without an exit: its card turns into the call's that replaces it. */
export function clearPreJoin(session: Session): void {
    session.get(preJoinStore).setState(NO_PRE_JOIN)
}
