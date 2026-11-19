import { createStore } from 'zustand/vanilla'
import { defineStore } from '../../../core/session'
import type { Session } from '../../../core/session'

/**
 * What the user is doing with one poll before it reaches the server (PollsInteractionStore's poll state).
 * The reference's `editing` is left out: nothing in the mobile client turns it on.
 */
export interface PollState {
    /** Answers picked but not sent yet. */
    selected: number[]
    /** The vote request is on its way. */
    submitting: boolean
    /** Show results: counts and bars drawn before voting. */
    showResults: boolean
}

interface PollStates {
    /** By message id. */
    polls: Record<string, PollState>
    /** Bumped when a shown poll's time-left label changes or it ends: the rows rebuild on it. */
    clock: number
    /** When the next bump is due. */
    refreshAt?: number
}

export const NO_POLL_STATE: PollState = {
    selected: [],
    submitting: false,
    showResults: false,
}

/**
 * The session's poll states (PollsInteractionStore). Not cached: a restart forgets picks not sent.
 * Holds the session's one poll timer, which bumps `clock` at `refreshAt`.
 */
export const pollStateStore = defineStore('pollState', () => {
    const store = createStore<PollStates>(() => ({ polls: {}, clock: 0 }))
    let timer: ReturnType<typeof setTimeout> | undefined
    store.subscribe((state, previous) => {
        if (state.refreshAt === previous.refreshAt) return
        clearTimeout(timer)
        if (state.refreshAt === undefined) return
        timer = setTimeout(
            () => store.setState({ clock: Date.now(), refreshAt: undefined }),
            Math.max(0, state.refreshAt - Date.now()),
        )
    })
    return store
})

/** Asks for the poll rows to rebuild at `at`, unless an earlier rebuild is already due. */
export function refreshPollsAt(session: Session, at: number): void {
    const store = session.get(pollStateStore)
    const due = store.getState().refreshAt
    if (due === undefined || at < due) store.setState({ refreshAt: at })
}

/** Returns a poll's state, the empty one when it has none. */
export const getPollState = (session: Session, messageId: string) =>
    session.get(pollStateStore).getState().polls[messageId] ?? NO_POLL_STATE

/** updatePollState: changes one poll's state. */
export function updatePollState(
    session: Session,
    messageId: string,
    change: (state: PollState) => PollState,
): void {
    session.get(pollStateStore).setState(state => ({
        polls: {
            ...state.polls,
            [messageId]: change(state.polls[messageId] ?? NO_POLL_STATE),
        },
    }))
}
