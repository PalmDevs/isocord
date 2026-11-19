import { useEffect } from 'react'
import { useWindowDimensions } from 'react-native'
import { openLink } from '../../../core/openLink'
import { CARD_PLACEHOLDER_BODY_HEIGHT } from './cardRowMetrics'
import { CardPlaceholder, FileCard, LinkCard } from './cardRows'
import {
    FILE_OR_LINK_IMAGE_RATIO,
    FILES_OR_LINKS_GAP_WIDTH,
    FILES_OR_LINKS_MAX_ITEM_WIDTH,
    FILES_OR_LINKS_NUM_COLUMNS,
    MEDIA_ITEM_GAP_WIDTH,
    MEDIA_MAX_ITEM_WIDTH,
    MEDIA_NUM_COLUMNS,
    SEARCH_LIST_HORIZONTAL_PADDING,
    SEARCH_MESSAGES_DEFAULT_LINE_CLAMP,
    SEARCH_PINNED_MESSAGES_LINE_CLAMP,
} from './constants'
import {
    useSearchController,
    useSearchResults,
    useSearchTab,
} from './controller'
import { getFiles, getLinks, getMedia } from './extract'
import { MessagePlaceholder } from './MessagePlaceholder'
import { MessageResults } from './MessageResults'
import { MediaCell, MediaPlaceholder } from './mediaRows'
import { ResultList } from './ResultList'
import { useOpenMedia, useOpenResult } from './useOpenMedia'
import type { MessageTab } from '../api'
import type { SearchTabPageProps } from '../types'
import type { FileItem, LinkItem } from './extract'

/** MessagesScreen and PinsScreen: message results, drawn by one native list (MessageResults). */
function MessageListPage({
    tab,
    lineClamp,
    context,
    active,
    onDismiss,
}: SearchTabPageProps & { tab: MessageTab; lineClamp: number }) {
    const state = useSearchTab(tab)
    // ResultList decides between placeholders, errors, "no results" and the list from the rows' count.
    const rows = (state?.messages ?? []).map(({ id }) => ({
        key: id,
        type: 'message',
    }))
    return (
        <ResultList
            tab={tab}
            context={context}
            active={active}
            rows={rows}
            content="messages"
            separator={4}
            placeholderHeight={64}
            renderPlaceholder={() => <MessagePlaceholder />}
            renderList={({ onEndReached }) => (
                <MessageResults
                    tab={tab}
                    context={context}
                    lineClamp={lineClamp}
                    showHistoricalIndexing={tab === 'messages'}
                    onDismiss={onDismiss}
                    onEndReached={onEndReached}
                />
            )}
        />
    )
}

/** Tab "Messages". */
export function MessagesPage(props: SearchTabPageProps) {
    return (
        <MessageListPage
            {...props}
            tab="messages"
            lineClamp={SEARCH_MESSAGES_DEFAULT_LINE_CLAMP}
        />
    )
}

/**
 * Tab "Pins". With no query it lists the channel's pins (InitialPinsScreen), fetched when the tab is first shown;
 * otherwise the search results for `pinned`.
 */
export function PinsPage(props: SearchTabPageProps) {
    const controller = useSearchController()
    const pinsEndpoint = useSearchResults(state => state.pinsEndpoint)
    const { active } = props
    useEffect(() => {
        if (active && pinsEndpoint) void controller.fetchPins()
    }, [active, pinsEndpoint, controller])
    return (
        <MessageListPage
            {...props}
            tab="pins"
            lineClamp={SEARCH_PINNED_MESSAGES_LINE_CLAMP}
        />
    )
}

/**
 * The columns of a masonry tab and the width of an item: at least `minColumns` (the reference's grid), more as the
 * window gets wider, so that an item is never wider than `maxItemWidth`.
 */
function useMasonryColumns(minColumns: number, maxItemWidth: number) {
    const { width } = useWindowDimensions()
    const inner = width - 2 * SEARCH_LIST_HORIZONTAL_PADDING
    const columns = Math.max(minColumns, Math.ceil(width / maxItemWidth))
    return { columns, itemWidth: inner / columns }
}

/** Tab "Media": a masonry of the pictures and videos of the messages, each at its own proportions. */
export function MediaPage({ context, active }: SearchTabPageProps) {
    const state = useSearchTab('media')
    const onPress = useOpenMedia()
    const { columns, itemWidth } = useMasonryColumns(
        MEDIA_NUM_COLUMNS,
        MEDIA_MAX_ITEM_WIDTH,
    )
    const rows = getMedia(state?.messages ?? []).map(item => ({
        key: item.key,
        type: 'media',
        item,
    }))
    return (
        <ResultList
            tab="media"
            context={context}
            active={active}
            rows={rows}
            content="media"
            numColumns={columns}
            masonry
            placeholderHeight={itemWidth + MEDIA_ITEM_GAP_WIDTH}
            renderPlaceholder={() => <MediaPlaceholder />}
            renderRow={row => (
                <MediaCell
                    item={row.item}
                    width={itemWidth}
                    onPress={onPress}
                />
            )}
        />
    )
}

/** The width of a card of the masonry and the height of its placeholder, for the placeholders that fill the screen. */
function useCardLayout() {
    const { columns, itemWidth } = useMasonryColumns(
        FILES_OR_LINKS_NUM_COLUMNS,
        FILES_OR_LINKS_MAX_ITEM_WIDTH,
    )
    return {
        columns,
        // useFileOrLinkImageDimensions: the card without the 2 of its border.
        width: itemWidth - FILES_OR_LINKS_GAP_WIDTH - 2,
        placeholderHeight:
            itemWidth * FILE_OR_LINK_IMAGE_RATIO +
            CARD_PLACEHOLDER_BODY_HEIGHT +
            FILES_OR_LINKS_GAP_WIDTH,
    }
}

/** Tab "Files": a masonry of cards of the attachments. */
export function FilesPage({ context, active }: SearchTabPageProps) {
    const state = useSearchTab('files')
    const open = useOpenResult()
    const card = useCardLayout()
    const rows = getFiles(state?.messages ?? []).map((item: FileItem) => ({
        key: item.key,
        type: 'file',
        item,
    }))
    return (
        <ResultList
            tab="files"
            context={context}
            active={active}
            rows={rows}
            content="cards"
            numColumns={card.columns}
            masonry
            placeholderHeight={card.placeholderHeight}
            renderPlaceholder={() => <CardPlaceholder />}
            renderRow={row => (
                <FileCard item={row.item} width={card.width} onPress={open} />
            )}
        />
    )
}

/** Tab "Links": a masonry of cards of the links, an embed's picture and title or the first link of the text. */
export function LinksPage({ context, active }: SearchTabPageProps) {
    const state = useSearchTab('links')
    const open = useOpenResult()
    const card = useCardLayout()
    const rows = getLinks(state?.messages ?? []).map((item: LinkItem) => ({
        key: item.key,
        type: 'link',
        item,
    }))
    const onPressLink = (url: string) => void openLink(url)
    return (
        <ResultList
            tab="links"
            context={context}
            active={active}
            rows={rows}
            content="cards"
            numColumns={card.columns}
            masonry
            placeholderHeight={card.placeholderHeight}
            renderPlaceholder={() => <CardPlaceholder />}
            renderRow={row => (
                <LinkCard
                    item={row.item}
                    width={card.width}
                    onPress={open}
                    onPressLink={onPressLink}
                />
            )}
        />
    )
}
