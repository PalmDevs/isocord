import { Endpoint } from '../../core/api/paths'
import { ApiError } from '../../core/api/rest'
import { compareSnowflakes } from '../../core/discord/snowflake'
import { defineStore } from '../../core/session'
import { usersStore } from '../users'
import { messagesStore, PAGE_SIZE } from './messages'
import type { Session } from '../../core/session'
import type { Message } from '../readStates'
import type { ChannelMessages } from './messageTypes'

/** Messages the API returns on each side of an `around` request: half of PAGE_SIZE. */
export const AROUND_HALF = PAGE_SIZE / 2
/** Wait after a failed history request before the scroll position asks again. */
const FAILURE_BACKOFF_MS = 5000

/** A session's history bookkeeping. */
interface WindowState {
    /** Bumped on every READY. A history request that started in an older epoch is discarded. */
    epoch: number
    /** Bumped when a channel's loaded messages are replaced wholesale. A request that started before is discarded. */
    generations: Map<string, number>
    /** When a history request last failed, by channel (`after:` prefixed for newer pages). */
    failures: Map<string, number>
}

const windowStates = new WeakMap<Session, WindowState>()

function windowState(session: Session): WindowState {
    let state = windowStates.get(session)
    if (!state) {
        state = { epoch: 0, generations: new Map(), failures: new Map() }
        windowStates.set(session, state)
    }
    return state
}

/** Starts a new epoch: requests made before it are discarded. */
export function nextEpoch(session: Session): void {
    windowState(session).epoch++
}

const windowGeneration = (session: Session, channelId: string) =>
    windowState(session).generations.get(channelId) ?? 0

const replaceWindow = (session: Session, channelId: string) => {
    const next = windowGeneration(session, channelId) + 1
    windowState(session).generations.set(channelId, next)
    return next
}

const recentlyFailed = (session: Session, key: string) =>
    Date.now() - (windowState(session).failures.get(key) ?? 0) <
    FAILURE_BACKOFF_MS

/**
 * Mirrors ChannelMessages.loadComplete for the newest page: the page replaces what is loaded.
 * Older messages are dropped because nothing says they join up with the page.
 * Kept, as the reference merges them back: gateway messages newer than the page,
 * and messages still sending or failed.
 */
function mergeNewest(
    known: Message[],
    page: Message[],
): Pick<ChannelMessages, 'messages' | 'hasMore'> {
    const newest = page[0]
    const kept = known.filter(
        message =>
            message.state !== undefined ||
            (newest !== undefined &&
                compareSnowflakes(message.id, newest.id) > 0),
    )
    return {
        messages: [...kept, ...page].sort((a, b) =>
            compareSnowflakes(b.id, a.id),
        ),
        hasMore: page.length === PAGE_SIZE,
    }
}

/** History carries full user objects the gateway may never have sent. */
export function upsertUsers(session: Session, page: Message[]): void {
    session
        .get(usersStore)
        .getState()
        .upsert(
            page.flatMap(message => [
                message.author,
                ...(message.mentions ?? []),
                message.referenced_message?.author,
            ]),
        )
}

function patchChannel(
    session: Session,
    channelId: string,
    patch: Partial<ChannelMessages>,
): void {
    session.get(messagesStore).setState(state => ({
        channels: {
            ...state.channels,
            [channelId]: {
                messages: [],
                hasMore: true,
                error: false,
                ...state.channels[channelId],
                loading: false,
                ...patch,
            },
        },
    }))
}

/** Loads the newest page of a channel, or the page before what is already loaded. */
export async function loadMessages(
    session: Session,
    channelId: string,
    older = false,
): Promise<void> {
    const store = session.get(messagesStore)
    const current = store.getState().channels[channelId]
    if (current?.loading || (older && !current?.hasMore)) return
    // After a failed history request, wait before the scroll position asks again.
    if (older && recentlyFailed(session, channelId)) return
    if (!older && current && !current.error && !current.stale) return
    if (!older) {
        store.setState(state => ({
            recent: [channelId, ...state.recent.filter(id => id !== channelId)],
        }))
    }

    const before = older ? current?.messages.at(-1)?.id : undefined
    const set = (patch: Partial<ChannelMessages>) =>
        store.setState(state => ({
            channels: {
                ...state.channels,
                [channelId]: {
                    messages: [],
                    hasMore: true,
                    error: false,
                    ...state.channels[channelId],
                    loading: false,
                    ...patch,
                },
            },
        }))
    const epoch = windowState(session).epoch
    const generation = windowGeneration(session, channelId)
    set({ loading: true, error: false })
    try {
        const page = await session.rest.get<Message[]>(
            Endpoint.channelMessages(channelId),
            {
                // MessageActionCreators `fetchMessages`.
                retries: 2,
                query: { limit: PAGE_SIZE, before },
            },
        )
        // A jump replaced what is loaded while this was in flight, or a READY discarded it (and asked again).
        if (
            windowGeneration(session, channelId) !== generation ||
            windowState(session).epoch !== epoch
        )
            return
        upsertUsers(session, page)
        const known = store.getState().channels[channelId]?.messages ?? []
        if (!older) {
            // A detached window (`jumpToPresent`) is replaced the same way; it never holds newer messages.
            const merged = mergeNewest(known, page)
            set({ ...merged, hasMoreAfter: false, stale: false })
            // Scrolling up is the usual next step: have the second page ready.
            if (merged.hasMore) void loadMessages(session, channelId, true)
            return
        }
        // Messages that arrived over the gateway while the request was in flight are already in `known`.
        const ids = new Set(known.map(message => message.id))
        const merged = [
            ...known,
            ...page.filter(message => !ids.has(message.id)),
        ].sort((a, b) => compareSnowflakes(b.id, a.id))
        set({ messages: merged, hasMore: page.length === PAGE_SIZE })
    } catch {
        if (
            windowGeneration(session, channelId) !== generation ||
            windowState(session).epoch !== epoch
        )
            return
        if (older) windowState(session).failures.set(channelId, Date.now())
        set({ error: true })
    }
}

/**
 * Makes sure a message is loaded so the list can scroll to it: when it is not, the window around it replaces what
 * the channel has loaded (the reference's jump: `around`, then `hasMoreBefore`/`hasMoreAfter` from how many messages
 * came back on each side). `missing` when the message does not exist or cannot be read.
 */
export async function jumpToMessage(
    session: Session,
    channelId: string,
    messageId: string,
): Promise<'loaded' | 'missing' | 'failed' | 'cancelled'> {
    const store = session.get(messagesStore)
    const current = store.getState().channels[channelId]
    if (current?.messages.some(message => message.id === messageId))
        return 'loaded'
    const generation = replaceWindow(session, channelId)
    patchChannel(session, channelId, { loading: true, error: false })
    // The jump did not happen: what was shown stays, and an empty channel still has to load its newest page.
    const giveUp = () => {
        patchChannel(session, channelId, {
            ...(current?.messages.length ? {} : { stale: true }),
        })
        void loadMessages(session, channelId)
    }
    try {
        const page = await session.rest.get<Message[]>(
            Endpoint.channelMessages(channelId),
            { query: { limit: PAGE_SIZE, around: messageId }, retries: 2 },
        )
        if (windowGeneration(session, channelId) !== generation)
            return 'cancelled'
        const messages = [...page].sort((a, b) => compareSnowflakes(b.id, a.id))
        // The API answers with the messages near a deleted one as well.
        const index = messages.findIndex(message => message.id === messageId)
        if (index === -1) {
            giveUp()
            return 'missing'
        }
        upsertUsers(session, messages)
        patchChannel(session, channelId, {
            messages,
            hasMore: messages.length - index - 1 >= AROUND_HALF - 1,
            hasMoreAfter: index >= AROUND_HALF - 1,
            stale: false,
        })
        return 'loaded'
    } catch (error) {
        if (windowGeneration(session, channelId) !== generation)
            return 'cancelled'
        giveUp()
        return error instanceof ApiError &&
            error.status >= 400 &&
            error.status < 500 &&
            error.status !== 429
            ? 'missing'
            : 'failed'
    }
}

/** Loads the page after a detached window's newest message. */
export async function loadNewerMessages(
    session: Session,
    channelId: string,
): Promise<void> {
    const store = session.get(messagesStore)
    const current = store.getState().channels[channelId]
    const after = current?.messages[0]?.id
    if (!current?.hasMoreAfter || current.loading || !after) return
    if (recentlyFailed(session, `after:${channelId}`)) return
    const generation = windowGeneration(session, channelId)
    patchChannel(session, channelId, { loading: true })
    try {
        const page = await session.rest.get<Message[]>(
            Endpoint.channelMessages(channelId),
            { query: { limit: PAGE_SIZE, after }, retries: 2 },
        )
        if (windowGeneration(session, channelId) !== generation) return
        upsertUsers(session, page)
        const known = store.getState().channels[channelId]?.messages ?? []
        const ids = new Set(known.map(message => message.id))
        patchChannel(session, channelId, {
            messages: [
                ...page.filter(message => !ids.has(message.id)),
                ...known,
            ].sort((a, b) => compareSnowflakes(b.id, a.id)),
            hasMoreAfter: page.length === PAGE_SIZE,
        })
    } catch {
        if (windowGeneration(session, channelId) !== generation) return
        windowState(session).failures.set(`after:${channelId}`, Date.now())
        patchChannel(session, channelId, {})
    }
}

/** Leaves a detached window: the newest page replaces it (see `loadMessages`). */
export async function jumpToPresent(
    session: Session,
    channelId: string,
): Promise<void> {
    const current = session.get(messagesStore).getState().channels[channelId]
    if (!current?.hasMoreAfter) return
    // Requests for the window are discarded; the window stays on screen until the newest page arrives.
    replaceWindow(session, channelId)
    patchChannel(session, channelId, { stale: true })
    await loadMessages(session, channelId)
}

/**
 * Refreshes history when the connection opens again. A store of its own, next to `messagesStore` in the stores
 * list, so `messages.ts` doesn't import the loaders that import it.
 */
export const messageHistoryStore = defineStore('messageHistory', session => {
    const store = session.get(messagesStore)
    const { dispatch } = session.gateway
    /** Pending history and failed refreshes to retry after reconnecting. */
    const wanted = () =>
        Object.entries(store.getState().channels).flatMap(([id, channel]) =>
            channel.loading || (channel.stale && channel.error) ? [id] : [],
        )
    // MessageStore.handleConnectionOpen: anything loaded before this connection may have gaps. It stays on
    // screen, and an open chat refetches its newest page (see loadMessages). Requests from before READY are
    // discarded (one may never answer on a connection that died in the background), so they are made again.
    dispatch.on('READY', () => {
        const retry = wanted()
        nextEpoch(session)
        store.setState(state => ({
            channels: Object.fromEntries(
                Object.entries(state.channels).map(([id, channel]) => [
                    id,
                    {
                        ...channel,
                        stale: true,
                        loading: false,
                        error: false,
                    },
                ]),
            ),
        }))
        for (const id of retry) void loadMessages(session, id)
    })
    // A resumed session missed nothing, but a refresh that failed while the connection was down is made again.
    dispatch.on('RESUMED', () => {
        for (const id of wanted())
            if (store.getState().channels[id]?.error)
                void loadMessages(session, id)
    })
})
