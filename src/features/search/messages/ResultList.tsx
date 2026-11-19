import { FlashList } from '@shopify/flash-list'
import { useEffect, useRef } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { Card } from '../../../design/components/layout/Card'
import { showToast } from '../../../design/components/overlays/toastStore'
import { Text } from '../../../design/components/Text'
import { t } from '../../../i18n'
import { TAB_LIMITS } from '../api'
import {
    FILES_OR_LINKS_GAP_WIDTH,
    MEDIA_ITEM_GAP_WIDTH,
    SEARCH_LIST_HORIZONTAL_PADDING,
    SEARCH_LIST_SECTION_TOP_PADDING,
    SEARCH_ROW_TAP_STATE_PADDING,
} from './constants'
import {
    useSearchController,
    useSearchResults,
    useSearchTab,
} from './controller'
import type { ReactElement } from 'react'
import type { MessageTab } from '../api'
import type { SearchContext } from '../types'

/** pages/ErrorScreen: a muted line of text in the middle of the page. */
export function ErrorScreen({ text }: { text: string }) {
    return (
        <View style={styles.error} accessibilityLiveRegion="polite">
            <Text
                variant="text-sm/medium"
                color="TEXT_MUTED"
                style={styles.errorText}
            >
                {text}
            </Text>
        </View>
    )
}

const indexingText = (context: SearchContext) =>
    context.type === 'CHANNEL'
        ? t('search.indexing.channel')
        : context.type === 'DMS'
          ? t('search.indexing.dms')
          : t('search.indexing.guild')

/** SearchHistoricalIndexingHeader: shown above the messages while older messages are still being indexed. */
function HistoricalIndexingHeader() {
    const documentsIndexed = useSearchResults(state => state.documentsIndexed)
    return (
        <Card variant="primary" border="subtle" style={styles.indexingHeader}>
            <Text variant="heading-sm/normal" color="INTERACTIVE_TEXT_DEFAULT">
                {t(
                    documentsIndexed === 0
                        ? 'search.historicalIndexing.zero'
                        : documentsIndexed === 1
                          ? 'search.historicalIndexing.one'
                          : 'search.historicalIndexing.other',
                    { count: documentsIndexed.toLocaleString() },
                )}
            </Text>
        </Card>
    )
}

export interface ResultRow {
    key: string
    /** FlashList's recycling type. */
    type: string
}

/**
 * BaseMessagesScreen and SearchList: the list of a message tab. A tab that is still loading shows placeholders, one
 * whose index is not ready (202) or that failed shows a message instead, and one without results says so.
 * `rows` are the results; the placeholders are appended here while the first page loads.
 */
export function ResultList<T extends ResultRow>({
    tab,
    context,
    active,
    rows,
    renderRow,
    renderList,
    renderPlaceholder,
    placeholderHeight,
    numColumns = 1,
    masonry = false,
    separator = 0,
    content,
    showHistoricalIndexing = false,
}: {
    tab: MessageTab
    context: SearchContext
    active: boolean
    rows: T[]
    renderRow?: (row: T, index: number) => ReactElement | null
    /** Draws the loaded results itself (a native list) instead of the FlashList; `onEndReached` asks for the next page. */
    renderList?: (list: { onEndReached: () => void }) => ReactElement
    /** Placeholder number `index`, in the position of that row. */
    renderPlaceholder: (index: number) => ReactElement
    /** Used to fill the screen with placeholders. */
    placeholderHeight: number
    numColumns?: number
    /**
     * Items of different heights, each in the shortest column (FlashList's masonry with optimizeItemArrangement,
     * which places items without reordering them). The items fill their column, so they space themselves.
     */
    masonry?: boolean
    /** MessageVerticalSeparator: the gap between rows of a single column. */
    separator?: number
    /** useContentContainerStyles: the padding around the rows. */
    content: 'messages' | 'media' | 'cards'
    showHistoricalIndexing?: boolean
}) {
    const controller = useSearchController()
    const state = useSearchTab(tab)
    const historicalIndexing = useSearchResults(s => s.historicalIndexing)
    const { height } = useWindowDimensions()

    const firstPageLoading = !state?.initialComplete
    const error = state?.error ?? null
    const hasItems = rows.length > 0

    // Pages end while another tab is shown are remembered and fetched when this one is (SearchFetchPendingManager).
    const pending = useRef(false)
    const onEndReached = () => {
        if (!hasItems || firstPageLoading) return
        if (!active) {
            pending.current = true
            return
        }
        void controller.fetchNext(tab)
    }
    useEffect(() => {
        if (active && pending.current && !firstPageLoading) {
            pending.current = false
            void controller.fetchNext(tab)
        }
    }, [active, firstPageLoading, controller, tab])

    // useMessageSearchErrorScreen: an error with results already shown is a toast.
    useEffect(() => {
        if (active && error && hasItems && !firstPageLoading)
            showToast({
                key: 'SEARCH_ERROR_TOAST',
                variant: 'critical',
                content: error,
            })
    }, [active, error, hasItems, firstPageLoading])

    if (state?.indexing) return <ErrorScreen text={indexingText(context)} />
    if (error && !hasItems && !firstPageLoading)
        return <ErrorScreen text={error} />

    const placeholderCount = firstPageLoading
        ? Math.max(
              Math.ceil(height / placeholderHeight) * numColumns,
              TAB_LIMITS[tab],
          )
        : 0
    const placeholders = Array.from(
        { length: placeholderCount },
        (_, index) => ({
            key: `placeholder-${index}`,
            type: 'placeholder',
        }),
    )
    const data: Array<T | (typeof placeholders)[number]> = firstPageLoading
        ? placeholders
        : rows

    if (data.length === 0) return <ErrorScreen text={t('search.noResults')} />
    if (renderList && !firstPageLoading) return renderList({ onEndReached })

    return (
        // Placeholders and results are separate lists: FlashList keeps cells scrolled off mounted for reuse, and the
        // placeholders would stay pulsing behind the results.
        <FlashList
            key={firstPageLoading ? 'loading' : 'results'}
            data={data}
            keyExtractor={row => row.key}
            getItemType={row => row.type}
            numColumns={numColumns}
            masonry={masonry}
            optimizeItemArrangement={masonry}
            ItemSeparatorComponent={
                separator > 0
                    ? () => <View style={{ height: separator }} />
                    : undefined
            }
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onEndReached={onEndReached}
            onEndReachedThreshold={
                numColumns === 1 ? 0.5 : numColumns === 2 ? 0.8 : 0.99
            }
            contentContainerStyle={styles[content]}
            ListHeaderComponent={
                showHistoricalIndexing && historicalIndexing ? (
                    <HistoricalIndexingHeader />
                ) : null
            }
            renderItem={({ item, index }) =>
                item.type === 'placeholder'
                    ? renderPlaceholder(index)
                    : (renderRow?.(item as T, index) ?? null)
            }
        />
    )
}

const styles = StyleSheet.create((theme, runtime) => ({
    error: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: runtime.insets.bottom,
    },
    errorText: { textAlign: 'center', paddingHorizontal: theme.space.PX_16 },
    // useContentContainerStyles, and SearchList's room for the safe area below the last row.
    messages: {
        paddingTop: theme.space.PX_16 - SEARCH_ROW_TAP_STATE_PADDING,
        paddingBottom: theme.space.PX_16 + runtime.insets.bottom,
    },
    // The masonry cells bring half a gap of their own on every side.
    media: {
        paddingTop: SEARCH_LIST_SECTION_TOP_PADDING - MEDIA_ITEM_GAP_WIDTH / 2,
        paddingHorizontal:
            SEARCH_LIST_HORIZONTAL_PADDING - MEDIA_ITEM_GAP_WIDTH / 2,
        paddingBottom: theme.space.PX_16 + runtime.insets.bottom,
    },
    cards: {
        paddingTop:
            SEARCH_LIST_HORIZONTAL_PADDING - FILES_OR_LINKS_GAP_WIDTH / 2,
        paddingHorizontal:
            SEARCH_LIST_HORIZONTAL_PADDING - FILES_OR_LINKS_GAP_WIDTH / 2,
        paddingBottom: theme.space.PX_16 + runtime.insets.bottom,
    },
    // SearchHistoricalIndexingHeader.
    indexingHeader: {
        marginHorizontal: SEARCH_LIST_HORIZONTAL_PADDING,
        marginTop: SEARCH_ROW_TAP_STATE_PADDING,
        marginBottom: theme.space.PX_16,
        padding: theme.space.PX_16,
    },
}))
