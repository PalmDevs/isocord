import { createElement } from 'react'
import { createStore } from 'zustand/vanilla'
import { defineStore } from '../../core/session'
import { dismissKeyboard } from '../../design/components/keyboard'
import { openActionSheet } from '../../design/components/sheets/sheetStore'
import { parseChatLink } from '../chat/links/chatLink'
import { componentSources } from './componentSources'
import { messageSources, searchSources } from './sources'
import type { ComponentType } from 'react'
import type { Session } from '../../core/session'
import type { Message } from '../../stores/readStates'
import type { MediaItem } from '../search/messages/extract'
import type { MediaHolder, MessageSources, ViewerSource } from './sources'

/** A tapped tile in the window, in dp: where the viewer grows from. */
export interface MediaOrigin {
    x: number
    y: number
    width: number
    height: number
}

export interface OpenMediaViewer {
    /** New for each opening, so a second viewer opened over a closing one starts fresh. */
    key: number
    sources: ViewerSource[]
    /** The message each source belongs to (the footer shows the current one's); read again from the messages store when loaded there. */
    messages: Message[]
    initialIndex: number
    /** The tapped tile in the window (dp), undefined when unknown. */
    origin?: MediaOrigin
    /** Opened from search results: "Jump to Message" opens the message there (the search's own way of opening one). */
    jump?: (channelId: string, messageId: string) => void
}

interface MediaViewerState {
    /** The viewer on screen, if any. Rendered by MediaViewerHost. */
    open?: OpenMediaViewer
    /** Viewers opened this session, the next one's key. */
    opened: number
}

/** The session's media viewer. A switch of account takes it away. */
export const mediaViewerStore = defineStore('mediaViewer', () =>
    createStore<MediaViewerState>(() => ({ opened: 0 })),
)

const MEDIA_VIEWER_SHEET_KEY = 'media-viewer'

/** The viewer component, set by the feature. It opens chat links, which open the viewer, so importing it here would cycle. */
let ViewerSheet: ComponentType | undefined

export function registerViewerSheet(component: ComponentType): void {
    ViewerSheet = component
}

/** What was tapped among a message's own media: an attachment, an embed's media, or an embed's corner thumbnail. */
type MessageSelection =
    | { attachment: number }
    | { embed: number }
    | { thumbnail: number }

/** What was tapped: a message's own media, or item `item` of the gallery or thumbnail with component id `component`. */
export type MediaSelection =
    | MessageSelection
    | { component: number; item: number }

function show(session: Session, viewer: Omit<OpenMediaViewer, 'key'>): boolean {
    if (viewer.initialIndex < 0) return false
    dismissKeyboard()
    if (!ViewerSheet) throw new Error('The media viewer is not registered')
    session.get(mediaViewerStore).setState(({ opened }) => ({
        opened: opened + 1,
        open: { key: opened + 1, ...viewer },
    }))
    // openMediaModal's openAs "action-sheet": over the sheet it was opened from, under the sheets it opens.
    openActionSheet(MEDIA_VIEWER_SHEET_KEY, createElement(ViewerSheet), {
        stackingBehavior: 'stack',
        replaceable: false,
    })
    return true
}

/**
 * openMediaModal (handleMessagesTapImage): shows a message's media in the viewer, starting at `selected` (an
 * attachment index among the shown ones, an embed index, or the embed whose corner thumbnail was tapped), grown
 * out of the tile at `origin`. The media is the message's own, or `media` (a forward's snapshot). False, and
 * nothing opens, when that item has no media to show.
 */
export function openMediaViewer(
    session: Session,
    message: Message,
    selected: MediaSelection,
    origin?: MediaOrigin,
    media: MediaHolder = message,
): boolean {
    const { sources, initialIndex } = selectedSources(media, selected)
    return show(session, {
        sources,
        messages: sources.map(() => message),
        initialIndex,
        origin,
    })
}

/**
 * Returns what the viewer pages through for `selected`, and where it is among them (-1 when nothing). A component's
 * media pages through its own gallery only (extractMediaSourcesFromComponent), the rest through the whole message.
 */
function selectedSources(
    holder: MediaHolder,
    selected: MediaSelection,
): { sources: ViewerSource[]; initialIndex: number } {
    if ('component' in selected)
        return (
            componentSources(
                holder.components,
                selected.component,
                selected.item,
            ) ?? { sources: [], initialIndex: -1 }
        )
    const found = messageSources(holder)
    return {
        sources: found.sources,
        initialIndex: selectedIndex(found, selected),
    }
}

/** Where `selected` is among a message's sources, -1 when it has nothing to show. */
function selectedIndex(
    { attachments, embeds, thumbnails }: MessageSources,
    selected: MessageSelection,
): number {
    return 'attachment' in selected
        ? (attachments[selected.attachment] ?? -1)
        : 'thumbnail' in selected
          ? (thumbnails[selected.thumbnail] ?? -1)
          : (embeds[selected.embed] ?? -1)
}

/** A forward: its media is its snapshot's. */
export type ForwardingMessage = Message & {
    message_snapshots?: { message: MediaHolder }[]
}

/** A held media tile: what it shows, and the file its actions save and link to. */
export interface HeldMedia {
    source: ViewerSource
    /**
     * selectedMedia.mediaUrl, what Save downloads: an attachment's own file, or the proxy's copy of an embed's video
     * or picture (getEmbedUrl).
     */
    url: string
    /** The proxy's copy: an attachment's proxy_url, an embed's proxied video or picture. */
    proxyUrl: string
}

/**
 * The LongPressMessageActionSheet's selectedMedia: the media a held tile's link names, as the chat reports it (a
 * `media` chat link without its origin).
 */
export function heldMedia(
    message: Message,
    link: string,
): HeldMedia | undefined {
    const media = parseChatLink(link)
    if (media?.kind !== 'media') return undefined
    const holder: MediaHolder | undefined = media.forward
        ? (message as ForwardingMessage).message_snapshots?.[0]?.message
        : message
    if (!holder) return undefined
    const { sources, initialIndex } = selectedSources(holder, media.selection)
    const source = sources[initialIndex]
    if (!source) return undefined
    const proxyUrl = source.videoUrl ?? source.url
    // Attachments and component media save the file itself (shareURI).
    const own =
        'attachment' in media.selection || 'component' in media.selection
    return {
        source,
        url: own ? source.link : proxyUrl,
        proxyUrl,
    }
}

/** useOnPressMediaItem: the viewer pages through every picture and video of the search results loaded so far. */
export function openSearchMediaViewer(
    session: Session,
    items: MediaItem[],
    selected: MediaItem,
    origin: MediaOrigin | undefined,
    jump: (channelId: string, messageId: string) => void,
): boolean {
    return show(session, { ...searchSources(items, selected), origin, jump })
}

/** Takes the viewer away at once. Its sheet then removes itself. */
export function closeMediaViewer(session: Session): void {
    session.get(mediaViewerStore).setState({ open: undefined })
}

/**
 * Opens one picture, such as a profile avatar or banner, in the viewer. Its size in pixels, when known, sets how it
 * fits and zooms. Unknown (0), it fits the screen.
 */
export function openImageViewer(
    session: Session,
    url: string,
    width = 0,
    height = 0,
): boolean {
    return show(session, {
        sources: [
            {
                url,
                width,
                height,
                link: url,
                file: url,
                kind: 'image',
            },
        ],
        messages: [],
        initialIndex: 0,
    })
}
