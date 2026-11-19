import { ApiError } from '../../../core/api/rest'
import { t } from '../../../i18n'
import { holdThread, isThread } from '../../../stores/channels/channels'
import { usersStore } from '../../../stores/users'
import { hasCursor, hitsOf } from '../api'
import type { StoreApi } from 'zustand'
import type { Session } from '../../../core/session'
import type { Channel } from '../../../stores/channels/channels'
import type { Message } from '../../../stores/readStates'
import type { MessageTab, SearchCursor, SearchTabResponse } from '../api'

/** SearchMessageStore's entry of one tab. */
export interface TabState {
    messages: Message[]
    /** Where the next page starts: a search cursor, or for the channel pins the `pinned_at` of the last one. */
    cursor: SearchCursor | string | null
    total: number | null
    /** getIsInitialFetchComplete: the first page has arrived or failed. */
    initialComplete: boolean
    /** getIsFetching: a request for this tab is in flight. */
    fetching: boolean
    error: string | null
    /** 202: the index is not ready yet. */
    indexing: boolean
}

export const EMPTY_TAB: TabState = {
    messages: [],
    cursor: null,
    total: null,
    initialComplete: false,
    fetching: false,
    error: null,
    indexing: false,
}

export interface ResultsState {
    /** The text of the query the tabs hold results for (SearchQueryStore.getSearchResultsQuery), null before the first fetch. */
    query: string | null
    /** queryKey of that query, with its filters. */
    key: string | null
    /** The pins tab lists the channel's pins (usesPinsEndpoint), fetched when it is shown. */
    pinsEndpoint: boolean
    tabs: Partial<Record<MessageTab, TabState>>
    /** Channels and threads that came with the results, for rows of channels the client does not have. */
    channels: Record<string, Channel>
    historicalIndexing: boolean
    documentsIndexed: number
}

const errorText = (error: unknown) =>
    error instanceof ApiError && error.body?.message
        ? String(error.body.message)
        : t('search.loadFailed')

/** The writes of one results store: tab patches, the users and channels that came with results, and a response. */
export function createResultsWriter(
    session: Session,
    store: StoreApi<ResultsState>,
) {
    const patchTabs = (
        tabs: readonly MessageTab[],
        patch: (tab: TabState) => Partial<TabState>,
    ) =>
        store.setState(state => {
            const next = { ...state.tabs }
            for (const tab of tabs) {
                const current = next[tab] ?? EMPTY_TAB
                next[tab] = { ...current, ...patch(current) }
            }
            return { tabs: next }
        })

    const learn = (messages: Message[], channels: Channel[]) => {
        session
            .get(usersStore)
            .getState()
            .upsert(messages.map(message => message.author))
        if (channels.length === 0) return
        store.setState(state => ({
            channels: {
                ...state.channels,
                ...Object.fromEntries(
                    channels.map(channel => [channel.id, channel]),
                ),
            },
        }))
    }

    /** SEARCH_MESSAGES_SUCCESS: replaces a tab's messages, or appends a page to them. */
    const apply = (
        responses: Record<string, SearchTabResponse>,
        requested: readonly MessageTab[],
        append: boolean,
    ) => {
        const channels: Channel[] = []
        const threads: Channel[] = []
        const received: Message[] = []
        const next = { ...store.getState().tabs }
        for (const tab of requested) {
            const response = responses[tab]
            const hits = response ? hitsOf(response) : []
            received.push(...hits)
            channels.push(
                ...(response?.channels ?? []),
                ...(response?.threads ?? []),
            )
            threads.push(...(response?.threads ?? []))
            const current = next[tab] ?? EMPTY_TAB
            const seen = new Set(current.messages.map(message => message.id))
            next[tab] = {
                messages: append
                    ? [
                          ...current.messages,
                          ...hits.filter(message => !seen.has(message.id)),
                      ]
                    : hits,
                // An empty page ends the list however the cursor looks.
                cursor:
                    hits.length > 0 && hasCursor(response?.cursor)
                        ? response.cursor
                        : null,
                total: response?.total_results ?? current.total ?? 0,
                initialComplete: true,
                fetching: false,
                error: null,
                indexing: false,
            }
        }
        learn(received, channels)
        // ChannelStore.handleSearchMessagesSuccess (addThreadIfMissing): a result's thread or post opens with its name.
        for (const thread of threads)
            if (isThread(thread)) holdThread(session, thread)
        store.setState({ tabs: next })
    }

    const fail = (tabs: readonly MessageTab[], error: unknown) =>
        patchTabs(tabs, () => ({
            fetching: false,
            initialComplete: true,
            error: errorText(error),
        }))

    return { patchTabs, learn, apply, fail }
}
