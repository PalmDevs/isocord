import { Endpoint } from '../../core/api/paths'
import { isEmptyQuery } from './filters/catalog'
import { filterParams } from './filters/query'
import type { RestClient } from '../../core/api/rest'
import type { Channel } from '../../stores/channels/channels'
import type { Message } from '../../stores/readStates'
import type { SearchQuery } from './filters/catalog'
import type { SearchContext, SearchTab } from './types'

/** The tabs that show messages, SearchConstants.MESSAGE_SEARCH_RESULT_TABS. */
export type MessageTab = 'messages' | 'media' | 'pins' | 'links' | 'files'
export const MESSAGE_TABS: readonly MessageTab[] = [
    'messages',
    'media',
    'pins',
    'links',
    'files',
]
export const isMessageTab = (tab: SearchTab): tab is MessageTab =>
    (MESSAGE_TABS as readonly string[]).includes(tab)

/** SEARCH_QUERY_BY_SEARCH_FILTER: what each tab adds to the query. */
export const SEARCH_QUERY_BY_TAB: Record<
    MessageTab,
    Record<string, unknown>
> = {
    messages: {},
    media: { has: ['image', 'video'] },
    pins: { pinned: true },
    links: { has: ['link'] },
    files: { has: ['file'] },
}
/** SEARCH_QUERY_DEFAULT_FILTERS (SearchModes.NEWEST). */
export const SEARCH_QUERY_DEFAULT_FILTERS = {
    sort_by: 'timestamp',
    sort_order: 'desc',
}
/** SEARCH_TABS_TO_SEARCH_QUERY_LIMITS. */
export const TAB_LIMITS: Record<MessageTab, number> = {
    media: 15,
    messages: 15,
    pins: 15,
    links: 10,
    files: 10,
}
export const MAX_SEARCH_RESULTS_LIMIT = 25
/** getInitialFetchLimit: the first page of a tab. */
export const initialLimit = (tab: MessageTab) =>
    Math.min(TAB_LIMITS[tab], MAX_SEARCH_RESULTS_LIMIT)
/** getNextFetchLimit: every later page is twice as large, up to the maximum. */
export const nextLimit = (tab: MessageTab) =>
    Math.min(2 * TAB_LIMITS[tab], MAX_SEARCH_RESULTS_LIMIT)

/**
 * The tabs fetched with an empty query: SEARCH_INITIAL_MESSAGE_TABS (media, links, pins, files) for all DMs and
 * CHANNEL_SEARCH_INITIAL_MESSAGE_TABS (no pins: they come from the channel's pins) for one channel.
 */
export const INITIAL_FETCH_TABS: Record<
    SearchContext['type'],
    readonly MessageTab[]
> = {
    CHANNEL: ['media', 'links', 'files'],
    GUILD_CHANNEL: ['media', 'links', 'files'],
    DMS: ['media', 'links', 'pins', 'files'],
}

/**
 * Whether the pins tab lists the channel's pins (no query, one channel) rather than searching `pinned`. A guild
 * channel's search is one channel while its scope tag is there.
 */
export const usesPinsEndpoint = (context: SearchContext, query: SearchQuery) =>
    isEmptyQuery(query) &&
    (context.type === 'CHANNEL' ||
        (context.type === 'GUILD_CHANNEL' &&
            query.filters.some(filter => filter.implicit)))

export type SearchCursor =
    | { type: 'timestamp'; timestamp: string }
    | { type: 'score'; score: { timestamp: string; score: number } }

export interface SearchTabResponse {
    /** Nested: each inner array is a hit with its (no longer returned) context. */
    messages?: Message[][]
    channels?: Channel[]
    threads?: Channel[]
    /** Empty object when there is no more. */
    cursor?: SearchCursor | Record<string, never>
    total_results?: number
}

interface SearchTabsBody {
    tabs: Record<string, SearchTabResponse>
    doing_deep_historical_index?: boolean
    documents_indexed?: number
}

export type SearchOutcome =
    | {
          status: 'ok'
          tabs: Record<string, SearchTabResponse>
          doingHistoricalIndex: boolean
          documentsIndexed: number
      }
    | { status: 'indexing'; retryAfterMs: number }

/** SEARCH_TABS_CHANNEL, SEARCH_TABS_GUILD and SEARCH_TABS_DMS of the reference's Endpoints. */
export function searchTabsEndpoint(context: SearchContext): string {
    switch (context.type) {
        case 'DMS':
            return Endpoint.searchTabsDms
        case 'CHANNEL':
            return Endpoint.searchTabsChannel(context.channelId)
        case 'GUILD_CHANNEL':
            return Endpoint.searchTabsGuild(context.guildId)
    }
}

export interface TabRequest {
    tab: MessageTab
    limit: number
    cursor?: SearchCursor
}

/**
 * SearchTabsFetchManager.createRequestPayload and SearchTabFetcherImpl: one POST for any set of tabs. Each tab
 * is the default filters, the tab's own filter, the filters, the query text and its pagination cursor. A channel of
 * a guild searches the guild, narrowed with `channel_ids` by the `in` filters (its scope tag among them).
 */
export async function searchTabs(
    rest: RestClient,
    context: SearchContext,
    query: SearchQuery,
    tabs: TabRequest[],
    signal?: AbortSignal,
): Promise<SearchOutcome> {
    const params = filterParams(query.filters)
    const body: Record<string, unknown> = {
        tabs: Object.fromEntries(
            tabs.map(({ tab, limit, cursor }) => [
                tab,
                {
                    ...SEARCH_QUERY_DEFAULT_FILTERS,
                    ...SEARCH_QUERY_BY_TAB[tab],
                    ...params.tab,
                    ...(query.text ? { content: query.text } : {}),
                    ...(cursor ? { cursor } : {}),
                    limit,
                },
            ]),
        ),
        track_exact_total_hits: false,
    }
    // NSFW channels are left out unless asked for. Channels named with `in` are asked for; a whole server only
    // with the nsfw filter. Users who may not see NSFW never get it anyway.
    if (params.channelIds) {
        body.channel_ids = params.channelIds
        body.include_nsfw = true
    } else if (context.type === 'GUILD_CHANNEL') {
        body.include_nsfw = params.includeNsfw
    }
    const response = await rest.post<
        SearchTabsBody | { retry_after?: number; code?: number }
    >(searchTabsEndpoint(context), { body, signal })
    if (response && 'tabs' in response && response.tabs) {
        return {
            status: 'ok',
            tabs: response.tabs,
            doingHistoricalIndex: Boolean(response.doing_deep_historical_index),
            documentsIndexed: Number(response.documents_indexed ?? 0),
        }
    }
    // 202, "Index not yet available": retried after `retry_after` seconds, 5 s when that is missing or 0.
    const seconds = Number(
        (response as { retry_after?: number } | undefined)?.retry_after,
    )
    return {
        status: 'indexing',
        retryAfterMs:
            Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 5000,
    }
}

export interface PinItem {
    pinned_at: string
    message: Message
}

/** GET /channels/{id}/messages/pins, newest pin first; `before` is the `pinned_at` of the last one loaded. */
export async function fetchChannelPins(
    rest: RestClient,
    channelId: string,
    before?: string,
    signal?: AbortSignal,
): Promise<{ items: PinItem[]; has_more: boolean }> {
    return rest.get(Endpoint.channelPins(channelId), {
        query: { before },
        signal,
        // ChannelPinActionCreators.
        retries: 2,
    })
}

/** The hits of a tab response, flattened. */
export function hitsOf(result: SearchTabResponse): Message[] {
    return (result.messages ?? []).flat()
}

export const hasCursor = (
    cursor: SearchTabResponse['cursor'],
): cursor is SearchCursor => cursor != null && 'type' in cursor
