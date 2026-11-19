import { createContext, use, useEffect, useMemo, useRef } from 'react'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { useSession } from '../../core/react'
import { Tabs, TabsPages } from '../../design/components/layout/Tabs'
import { useTabsState } from '../../design/components/layout/useTabsState'
import { SkeletonPausedContext } from '../../design/components/skeletonUtils'
import { t } from '../../i18n'
import { isMessageTab } from './api'
import { useGuildChannelResults } from './channels/useGuildChannelResults'
import {
    FILTERED_TABS,
    hasFilters,
    isEmptyQuery,
    queryKey,
} from './filters/catalog'
import {
    createSearchController,
    SearchControllerContext,
} from './messages/controller'
import {
    FilesPage,
    LinksPage,
    MediaPage,
    MessagesPage,
    PinsPage,
} from './messages/pages'
import { ErrorScreen } from './messages/ResultList'
import { INITIAL_TABS, RESULT_TABS } from './types'
import { useSettledQuery } from './useSettledQuery'
import type { ComponentType, ReactNode } from 'react'
import type { TabItem } from '../../design/components/layout/useTabsState'
import type { MessageTab } from './api'
import type { SearchFilter } from './filters/catalog'
import type {
    SearchContext,
    SearchTab,
    SearchTabPageProps,
    SearchTabPages,
} from './types'

export interface SearchTabsLayoutProps {
    context: SearchContext
    /** The trimmed text of the query. With the filters, switches between INITIAL_TABS and RESULT_TABS of the context. */
    query: string
    /** The filters of the query. Kept by identity while unchanged: a new array searches again. */
    filters: SearchFilter[]
    /** Drawn over the tabs and their pages, which stay mounted under it (a filter's picker). */
    overlay?: ReactNode
    /**
     * Pages the host provides (members, people, recent). The message tabs (messages, media, pins, links, files)
     * are built in and need not be passed.
     */
    pages?: SearchTabPages
    onDismiss: () => void
    /** Rendered above the tab bar, scrolling with nothing (the channel details header, for instance). */
    header?: ReactNode
    /**
     * The search of the server header: GUILD's tabs (Recent and Channels among them) instead of the channel details'
     * ones of the context.
     */
    guildSearch?: boolean
    /** The tab selected at first (while it is visible; the first tab otherwise). */
    initialTab?: SearchTab
    /** The pages beside the selected one are not built yet (the channel details waiting to slide in). */
    deferPages?: boolean
    /** The selected page is laid out. */
    onPageReady?: () => void
}

/** The pages of the message tabs. */
const MESSAGE_PAGES: Record<MessageTab, ComponentType<SearchTabPageProps>> = {
    messages: MessagesPage,
    media: MediaPage,
    pins: PinsPage,
    links: LinksPage,
    files: FilesPage,
}

const contextKey = (context: SearchContext) =>
    context.type === 'DMS' ? 'DMS' : `${context.type}:${context.channelId}`

/**
 * Tabs that are visible: SearchTabsLayoutStore.computeLayoutForState. Before a query there are the initial tabs. With
 * one, the tabs of the results; once the results of this very query are in, a message tab that found nothing is
 * dropped. Until then the tabs of before stay, so the strip does not jump while typing.
 */
function useVisibleTabs(
    candidates: SearchTab[],
    empty: boolean,
    query: string,
    resultsQuery: string | null,
    totals: Partial<Record<MessageTab, number | null | undefined>>,
): SearchTab[] {
    const previous = useRef<{ wasInitial: boolean; visible: SearchTab[] }>({
        wasInitial: true,
        visible: candidates,
    })
    let visible = candidates
    let wasInitial = false
    // `query` and `resultsQuery` are queryKeys.
    if (empty) {
        wasInitial = true
    } else if (resultsQuery !== query) {
        const { wasInitial: before, visible: shown } = previous.current
        visible = candidates.filter(tab => before || shown.includes(tab))
    } else {
        const messageTabs = candidates.filter(isMessageTab)
        if (messageTabs.every(tab => totals[tab] != null))
            visible = candidates.filter(
                tab => !isMessageTab(tab) || totals[tab] !== 0,
            )
        else
            visible = candidates.filter(tab =>
                previous.current.visible.includes(tab),
            )
    }
    previous.current = { wasInitial, visible }
    return visible
}

/** Tells a page whether its tab is the selected one. */
const ActiveTabContext = createContext<string | undefined>(undefined)
/** Selects a tab by its id, for the pages (SearchTabPageProps.selectTab). */
const SelectTabContext = createContext<(tab: SearchTab) => void>(() => {})

function TabPage({
    id,
    Page,
    context,
    query,
    onDismiss,
}: {
    id: SearchTab
    Page: ComponentType<SearchTabPageProps>
    context: SearchContext
    query: string
    onDismiss: () => void
}) {
    const active = use(ActiveTabContext) === id
    const selectTab = use(SelectTabContext)
    // Pages beside the selected one stay mounted: their skeletons would pulse on every frame, off screen.
    return (
        <SkeletonPausedContext value={!active}>
            <Page
                context={context}
                query={query}
                active={active}
                onDismiss={onDismiss}
                selectTab={selectTab}
            />
        </SkeletonPausedContext>
    )
}

/** Counts are shown in parentheses, capped like the reference's non-exact counts. */
const formatCount = (count: number) =>
    count > 1000 ? '(1000+)' : `(${count.toLocaleString()})`

function TabsBody({
    items,
    defaultIndex,
    onSelect,
    holdNeighbours,
    onPageReady,
}: {
    items: TabItem[]
    defaultIndex: number
    onSelect: (id: string) => void
    holdNeighbours: boolean
    onPageReady?: () => void
}) {
    const state = useTabsState({
        items,
        defaultIndex,
        onSetActiveIndex: index => {
            const item = items[index]
            if (item) onSelect(item.key)
        },
    })
    const selectTab = (tab: SearchTab) => {
        const index = items.findIndex(item => item.key === tab)
        if (index >= 0) state.setActiveIndex(index)
    }
    return (
        <ActiveTabContext value={items[state.selectedIndex]?.key}>
            <SelectTabContext value={selectTab}>
                <Tabs state={state} formatCount={formatCount} />
                <TabsPages
                    state={state}
                    holdNeighbours={holdNeighbours}
                    onSelectedLayout={onPageReady}
                    style={styles.pages}
                />
            </SelectTabContext>
        </ActiveTabContext>
    )
}

/**
 * SearchTabsLayout: the tab strip and its pages, for the channel details and the DMs search. A page per visible tab;
 * the message tabs are built in and share one request for their first pages, the others come from the host.
 * Selecting a tab keeps it selected while the set of tabs changes with the query.
 */
export function SearchTabsLayout({
    context,
    query,
    filters,
    overlay,
    pages,
    onDismiss,
    header,
    guildSearch = false,
    initialTab,
    deferPages = false,
    onPageReady,
}: SearchTabsLayoutProps): ReactNode {
    const session = useSession()
    const key = contextKey(context)
    // The results live as long as the layout does, and start over for another context.
    // biome-ignore lint/correctness/useExhaustiveDependencies: `key` identifies `context`
    const controller = useMemo(
        () => createSearchController(session, context),
        [session, key],
    )
    useEffect(() => () => controller.dispose(), [controller])

    // Typing settles before it searches; a filter searches at once.
    const settled = useSettledQuery(query)
    useEffect(
        () => controller.fetchInitial({ text: settled, filters }),
        [controller, settled, filters],
    )

    const empty = isEmptyQuery({ text: query, filters })
    const searchKey = queryKey({ text: query, filters })
    const resultsKey = useStore(controller.store, state => state.key)
    const totals = useStore(
        controller.store,
        useShallow(state => ({
            messages: state.tabs.messages?.total,
            media: state.tabs.media?.total,
            pins: state.tabs.pins?.total,
            links: state.tabs.links?.total,
            files: state.tabs.files?.total,
        })),
    )

    // SearchGuildChannelTabStore.getCount: the matching channels, counted once there is a query.
    const channels = useGuildChannelResults(
        guildSearch && context.type === 'GUILD_CHANNEL'
            ? context.guildId
            : undefined,
        settled,
    )
    const channelCount =
        settled === ''
            ? undefined
            : channels.text.length + channels.voice.length

    // A filter narrows to messages: the other tabs would ignore it (members, channels) or fight it (media's has).
    const candidates = hasFilters({ text: query, filters })
        ? [...FILTERED_TABS]
        : (empty ? INITIAL_TABS : RESULT_TABS)[
              guildSearch ? 'GUILD' : context.type
          ].filter(tab => guildSearch || tab !== 'guild_channels')
    const visible = useVisibleTabs(
        candidates,
        empty,
        searchKey,
        resultsKey,
        totals,
    )
    const showCounts = !empty && resultsKey === searchKey

    const selected = useRef<string | undefined>(initialTab)
    const items = useMemo(
        () =>
            visible.flatMap((tab): TabItem[] => {
                const Page = isMessageTab(tab)
                    ? MESSAGE_PAGES[tab]
                    : pages?.[tab]
                if (!Page) return []
                const total = isMessageTab(tab)
                    ? showCounts
                        ? totals[tab]
                        : undefined
                    : tab === 'guild_channels'
                      ? channelCount
                      : undefined
                return [
                    {
                        key: tab,
                        label: t(`search.tab.${tab}`),
                        count: total ?? undefined,
                        page: (
                            <TabPage
                                id={tab}
                                Page={Page}
                                context={context}
                                query={query}
                                onDismiss={onDismiss}
                            />
                        ),
                    },
                ]
            }),
        [
            visible,
            pages,
            totals,
            showCounts,
            channelCount,
            context,
            query,
            onDismiss,
        ],
    )

    const ids = items.map(item => item.key)
    const defaultIndex = Math.max(0, ids.indexOf(selected.current ?? ''))
    if (selected.current === undefined) selected.current = ids[0]

    return (
        <SearchControllerContext value={controller}>
            <View style={styles.container}>
                {header}
                <View style={styles.pages}>
                    {items.length === 0 ? (
                        <View style={styles.pages}>
                            <ErrorScreen text={t('search.noResults')} />
                        </View>
                    ) : (
                        // A different set of tabs is a new strip and pager, opened on the tab that was selected.
                        <TabsBody
                            key={ids.join(',')}
                            items={items}
                            defaultIndex={defaultIndex}
                            onSelect={id => {
                                selected.current = id
                            }}
                            holdNeighbours={deferPages}
                            onPageReady={onPageReady}
                        />
                    )}
                    {overlay}
                </View>
            </View>
        </SearchControllerContext>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    pages: { flex: 1 },
})
