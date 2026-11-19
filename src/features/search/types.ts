import type { ComponentType } from 'react'

/**
 * The search surfaces of the reference (modules/search, SearchConstants): one tabbed layout shared by the channel
 * details panel and the global (DMs) search of the Messages tab. Each context shows a different set of tabs.
 */

/** SearchConstants.SearchTabs. */
export type SearchTab =
    | 'recent'
    | 'members'
    | 'guild_channels'
    | 'people'
    | 'media'
    | 'pins'
    | 'messages'
    | 'links'
    | 'files'
    | 'threads'

/** Constants.SearchTypes, the ones isocord has. CHANNEL is a DM or group DM, GUILD_CHANNEL a guild channel. */
export type SearchContext =
    | { type: 'CHANNEL'; channelId: string }
    | { type: 'GUILD_CHANNEL'; channelId: string; guildId: string }
    | { type: 'DMS' }

/**
 * The tab sets: a context's type, or GUILD for the search of the server header. The reference searches the whole
 * server there (SearchTypes.GUILD); isocord shows GUILD's tabs over the selected channel's GUILD_CHANNEL context.
 */
export type SearchTabsType = SearchContext['type'] | 'GUILD'

/**
 * SEARCH_TYPE_TO_SEARCH_INITIAL_TABS (empty query) and SEARCH_TYPE_TO_SEARCH_RESULT_TABS (with a query). A thread's
 * details (the reference's SearchTypes.THREAD) leave out the threads tab: its host passes no page for it.
 */
export const INITIAL_TABS: Record<SearchTabsType, SearchTab[]> = {
    CHANNEL: ['members', 'media', 'pins', 'links', 'files'],
    GUILD_CHANNEL: [
        'members',
        'guild_channels',
        'media',
        'pins',
        'threads',
        'links',
        'files',
    ],
    GUILD: [
        'recent',
        'members',
        'guild_channels',
        'media',
        'pins',
        'links',
        'files',
    ],
    DMS: ['recent', 'people', 'media', 'pins', 'links', 'files'],
}
export const RESULT_TABS: Record<SearchTabsType, SearchTab[]> = {
    CHANNEL: ['messages', 'media', 'pins', 'links', 'files'],
    GUILD_CHANNEL: [
        'members',
        'guild_channels',
        'messages',
        'media',
        'pins',
        'links',
        'files',
    ],
    GUILD: [
        'members',
        'guild_channels',
        'messages',
        'media',
        'pins',
        'links',
        'files',
    ],
    DMS: ['people', 'messages', 'media', 'pins', 'links', 'files'],
}

/** What every tab page receives. `query` is the trimmed text of the search bar ('' when empty). */
export interface SearchTabPageProps {
    context: SearchContext
    query: string
    /** True while this page is the selected tab: fetch lazily, only once it is. */
    active: boolean
    /** Called when the user picks a result that leaves search (a message, a DM): the host closes itself. */
    onDismiss: () => void
    /** Selects another visible tab of the layout (SearchTabsPage's selectMediaTab, the Recent tab's "View all"). */
    selectTab: (tab: SearchTab) => void
}

export type SearchTabPages = Partial<
    Record<SearchTab, ComponentType<SearchTabPageProps>>
>
