import { createContext, use } from 'react'
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import {
    fetchChannelPins,
    INITIAL_FETCH_TABS,
    initialLimit,
    MESSAGE_TABS,
    nextLimit,
    searchTabs,
    usesPinsEndpoint,
} from '../api'
import {
    FILTERED_TABS,
    hasFilters,
    isEmptyQuery,
    queryKey,
} from '../filters/catalog'
import { createResultsWriter, EMPTY_TAB } from './resultsWriter'
import type { Session } from '../../../core/session'
import type { MessageTab } from '../api'
import type { SearchQuery } from '../filters/catalog'
import type { SearchContext } from '../types'
import type { ResultsState, TabState } from './resultsWriter'

export type { ResultsState, TabState } from './resultsWriter'

/** SearchFetcher: at most this many 202 retries. */
const MAX_INDEXING_ATTEMPTS = 5

/**
 * The search results of one layout (SearchMessageStore, SearchActionCreators.fetchTabMessages and
 * SearchPlatformUtils.fetchInitialMessages/fetchNextMessages): the first page of all tabs of the mode in one
 * request, then a page per tab on demand. Created with the layout and discarded with it, as search closing
 * deletes its query.
 */
export function createSearchController(
    session: Session,
    context: SearchContext,
) {
    const store = createStore<ResultsState>(() => ({
        query: null,
        key: null,
        pinsEndpoint: false,
        tabs: {},
        channels: {},
        historicalIndexing: false,
        documentsIndexed: 0,
    }))
    const nextRequests = new Map<MessageTab, AbortController>()
    let initialRequest: AbortController | undefined
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let disposed = false
    /** The query of the results, filters included. */
    let currentQuery: SearchQuery | null = null

    const { patchTabs, learn, apply, fail } = createResultsWriter(
        session,
        store,
    )

    const runInitial = async (
        query: SearchQuery,
        tabs: readonly MessageTab[],
        attempt: number,
    ) => {
        initialRequest?.abort()
        const abort = new AbortController()
        initialRequest = abort
        // Pins of one channel come from the pins endpoint, fetched by the page when it is shown.
        const searched = tabs.filter(
            tab => tab !== 'pins' || !usesPinsEndpoint(context, query),
        )
        if (searched.length === 0) return
        try {
            const outcome = await searchTabs(
                session.rest,
                context,
                query,
                searched.map(tab => ({ tab, limit: initialLimit(tab) })),
                abort.signal,
            )
            if (abort.signal.aborted) return
            if (outcome.status === 'indexing') {
                patchTabs(searched, () => ({ fetching: false, indexing: true }))
                if (attempt >= MAX_INDEXING_ATTEMPTS) return
                retryTimer = setTimeout(
                    () => void runInitial(query, tabs, attempt + 1),
                    outcome.retryAfterMs,
                )
                return
            }
            apply(outcome.tabs, searched, false)
            store.setState({
                historicalIndexing: outcome.doingHistoricalIndex,
                documentsIndexed: outcome.documentsIndexed,
            })
        } catch (error) {
            if (abort.signal.aborted) return
            fail(searched, error)
        }
    }

    return {
        store,

        /**
         * fetchInitialMessages: starts over for `query`, loading the first page of every tab the mode shows in one
         * request. Does nothing while the same query, filters included, is already loading or loaded.
         */
        fetchInitial(query: SearchQuery) {
            if (disposed) return
            const key = queryKey(query)
            const state = store.getState()
            if (state.key === key) return
            currentQuery = query
            clearTimeout(retryTimer)
            for (const request of nextRequests.values()) request.abort()
            nextRequests.clear()
            const tabs = isEmptyQuery(query)
                ? INITIAL_FETCH_TABS[context.type]
                : hasFilters(query)
                  ? FILTERED_TABS
                  : MESSAGE_TABS
            store.setState({
                query: query.text,
                key,
                pinsEndpoint: usesPinsEndpoint(context, query),
                tabs: Object.fromEntries(
                    tabs
                        .filter(
                            tab =>
                                tab !== 'pins' ||
                                !usesPinsEndpoint(context, query),
                        )
                        .map(tab => [tab, { ...EMPTY_TAB, fetching: true }]),
                ),
                historicalIndexing: false,
                documentsIndexed: 0,
            })
            void runInitial(query, tabs, 0)
        },

        /** fetchNextMessages: the next page of one tab, when its first has loaded and more is known to exist. */
        async fetchNext(tab: MessageTab) {
            const state = store.getState()
            const current = state.tabs[tab]
            const query = currentQuery
            if (
                disposed ||
                query == null ||
                !current?.initialComplete ||
                current.fetching ||
                current.error ||
                current.indexing ||
                current.cursor == null
            )
                return
            const abort = new AbortController()
            nextRequests.set(tab, abort)
            patchTabs([tab], () => ({ fetching: true }))
            try {
                if (typeof current.cursor === 'string') {
                    await loadPins(current.cursor, abort.signal)
                    return
                }
                const outcome = await searchTabs(
                    session.rest,
                    context,
                    query,
                    [{ tab, limit: nextLimit(tab), cursor: current.cursor }],
                    abort.signal,
                )
                if (abort.signal.aborted) return
                if (outcome.status === 'indexing') {
                    patchTabs([tab], () => ({ fetching: false }))
                    return
                }
                apply(outcome.tabs, [tab], true)
            } catch (error) {
                if (abort.signal.aborted) return
                fail([tab], error)
            } finally {
                if (nextRequests.get(tab) === abort) nextRequests.delete(tab)
            }
        },

        /** InitialPinsScreen: the pins of the channel, once the pins page is first shown. */
        async fetchPins() {
            const state = store.getState()
            if (
                disposed ||
                !state.pinsEndpoint ||
                state.tabs.pins?.fetching ||
                state.tabs.pins?.initialComplete
            )
                return
            const abort = new AbortController()
            nextRequests.set('pins', abort)
            patchTabs(['pins'], () => ({ fetching: true }))
            try {
                await loadPins(undefined, abort.signal)
            } catch (error) {
                if (abort.signal.aborted) return
                fail(['pins'], error)
            } finally {
                if (nextRequests.get('pins') === abort)
                    nextRequests.delete('pins')
            }
        },

        dispose() {
            disposed = true
            clearTimeout(retryTimer)
            initialRequest?.abort()
            for (const request of nextRequests.values()) request.abort()
        },
    }

    async function loadPins(before: string | undefined, signal: AbortSignal) {
        if (context.type === 'DMS') return
        const page = await fetchChannelPins(
            session.rest,
            context.channelId,
            before,
            signal,
        )
        if (signal.aborted) return
        const messages = page.items.map(item => item.message)
        learn(messages, [])
        const last = page.items.at(-1)
        patchTabs(['pins'], tab => ({
            messages: [
                ...tab.messages,
                ...messages.filter(
                    message =>
                        !tab.messages.some(known => known.id === message.id),
                ),
            ],
            cursor: page.has_more && last ? last.pinned_at : null,
            total: tab.messages.length + messages.length,
            initialComplete: true,
            fetching: false,
            error: null,
        }))
    }
}

export type SearchController = ReturnType<typeof createSearchController>

export const SearchControllerContext = createContext<SearchController | null>(
    null,
)

export function useSearchController(): SearchController {
    const controller = use(SearchControllerContext)
    if (!controller)
        throw new Error('Search pages must be inside a SearchTabsLayout')
    return controller
}

/** The state of one tab (undefined until a fetch for the current query started). */
export function useSearchTab(tab: MessageTab): TabState | undefined {
    const { store } = useSearchController()
    return useStore(store, state => state.tabs[tab])
}

export function useSearchResults<T>(select: (state: ResultsState) => T): T {
    const { store } = useSearchController()
    return useStore(store, select)
}
