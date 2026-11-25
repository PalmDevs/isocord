import {
    AttachmentFlag,
    SPOILER_FILENAME_PREFIX,
} from '../../core/discord/messages'
import { t } from '../../i18n'
import { cornerThumbnail } from '../chat/media'
import { hasSpoilerLink } from '../chat/rows/buildRows'
import { parseMarkdown } from '../chat/rows/markdown'
import {
    isImageAttachment,
    isVideoAttachment,
} from '../search/messages/extract'
import type {
    Attachment,
    Embed,
    EmbedMedia,
} from '../../stores/messages/messageTypes'
import type { Message } from '../../stores/readStates'
import type { ApiComponent } from '../chat/messageComponents/apiComponent'
import type { MediaItem } from '../search/messages/extract'

/** One picture or video of the viewer. Decoded as ViewerSource in MediaViewer.kt. */
export interface ViewerSource {
    /** The picture, or the still of a video. */
    url: string
    /** The proxy URL for the media. */
    proxyUrl?: string
    /** Size in pixels; 0 when unknown. */
    width: number
    height: number
    /** A video file played over the still. */
    videoUrl?: string
    /** The video stands in for a GIF: it loops, muted, while shown. */
    gifv?: boolean
    /** A hosted player drawn in a web view (MediaModalYoutube, MediaModalTiktok): its page and which one it is. */
    embedUrl?: string
    provider?: 'youtube' | 'tiktok'
    /** Alt text, behind the ALT button. */
    description?: string
    /** The localised "SPOILER" label when the media starts hidden. */
    spoiler?: string
    /** What Save, Share and the links use: the file itself rather than the proxy's copy (getAttachmentUrl, getEmbedUrl). */
    link: string
    /** The media file at its own address, not the proxy's: the long press sheet's media link. JS only. */
    file: string
    /** image, video or gif: which "saved" toast Save shows. */
    kind: 'image' | 'video' | 'gif'
}

const GIF = /\.gif$/i
const pathOf = (url: string) => url.split('?', 1)[0] ?? ''

// getYoutubeVideoIdFromURI, getYoutubeClipVideoIdFromURI and the TikTok player's prefix.
const YOUTUBE =
    /^https:\/\/www\.youtube\.com\/embed\/([A-Za-z0-9_-]{11})(\?(start|clip)=[A-Za-z0-9_-]+(&clipt=[A-Za-z0-9_-]+)?)?$/
const TIKTOK = 'https://www.tiktok.com/player/v1/'

function attachmentSource(attachment: Attachment): ViewerSource | undefined {
    const { filename, width, height } = attachment
    if (!width || !height) return undefined
    const url = attachment.proxy_url || attachment.url
    const spoiler =
        filename.startsWith(SPOILER_FILENAME_PREFIX) ||
        Boolean((attachment.flags ?? 0) & AttachmentFlag.IS_SPOILER)
    const base = {
        url,
        width,
        height,
        description: attachment.description || undefined,
        spoiler: spoiler ? t('chat.media.spoiler') : undefined,
        link: attachment.url,
        file: attachment.url,
    }
    // The search tiles' test (file name or content type), so a tile always opens.
    if (isImageAttachment(attachment))
        return {
            ...base,
            kind:
                GIF.test(filename) || attachment.content_type === 'image/gif'
                    ? 'gif'
                    : 'image',
        }
    // The proxy serves a still frame of a video at its own URL.
    if (isVideoAttachment(attachment))
        return { ...base, videoUrl: url, kind: 'video' }
    return undefined
}

/** Returns 'gif' for a picture at a .gif link from any site (isAnimatedImageSource), 'image' otherwise. */
const imageKind = (media: EmbedMedia): 'gif' | 'image' =>
    GIF.test(pathOf(media.url)) ? 'gif' : 'image'

/**
 * MediaSourceUtil.extractMediaFromEmbed: the embed's picture, and what plays over it. The picture is the one the
 * tile shows: the search tiles' (embedImage, thumbnail first) or the chat's (image first). `spoiler`: the link was
 * written inside `||...||`.
 */
function embedSource(
    embed: Embed,
    spoiler: string | undefined,
    thumbnailFirst = false,
): ViewerSource | undefined {
    const media = thumbnailFirst
        ? (embed.thumbnail ?? embed.image)
        : (embed.image ?? embed.thumbnail)
    if (!media) return undefined
    const video = embed.video
    const videoUrl = video?.proxy_url
    const file = Boolean(videoUrl && (embed.type === 'gifv' || video))
    const hosted = video && !videoUrl ? video.url : undefined
    const provider = hosted
        ? YOUTUBE.test(hosted)
            ? 'youtube'
            : hosted.startsWith(TIKTOK)
              ? 'tiktok'
              : undefined
        : undefined
    return {
        url: media.proxy_url ?? media.url,
        proxyUrl: media.proxy_url,
        width: media.width ?? 0,
        height: media.height ?? 0,
        videoUrl: file ? videoUrl : undefined,
        gifv: (file && embed.type === 'gifv') || undefined,
        embedUrl: provider && hosted,
        provider,
        spoiler,
        link: embed.url ?? video?.url ?? media.url,
        file: (file && video?.url) || media.url,
        kind: embed.type === 'gifv' ? 'gif' : file ? 'video' : imageKind(media),
    }
}

/**
 * A picture of an embed shown on its own: the corner thumbnail of a card that also has an image. No spoiler cover:
 * the chat draws the corner thumbnail uncovered.
 */
function pictureSource(media: EmbedMedia): ViewerSource {
    return {
        url: media.proxy_url ?? media.url,
        proxyUrl: media.proxy_url,
        width: media.width ?? 0,
        height: media.height ?? 0,
        link: media.url,
        file: media.url,
        kind: imageKind(media),
    }
}

/** What a message's media comes from: the message itself, or the snapshot of a forward. */
export interface MediaHolder {
    content?: string
    attachments?: Attachment[]
    embeds?: Embed[]
    components?: ApiComponent[]
}

/** The "SPOILER" label when the holder's links were written inside a spoiler, as the chat hides its embeds. */
const embedSpoiler = (holder: MediaHolder) =>
    holder.content && hasSpoilerLink(parseMarkdown(holder.content))
        ? t('chat.media.spoiler')
        : undefined

/** What a message has to show in the viewer, and which source each attachment and embed became (-1 for none). */
export interface MessageSources {
    sources: ViewerSource[]
    /** By index among the attachments the chat shows (thumbnails of other attachments left out), as `isocord://media` counts. */
    attachments: number[]
    /** By index in message.embeds, as `isocord://embed-media` counts. */
    embeds: number[]
    /** The corner thumbnail of each embed (`isocord://embed-media/<id>/<index>/thumbnail`), by index in message.embeds. */
    thumbnails: number[]
}

/**
 * MediaSourceUtil.extractMediaSourcesFromMessage: the pictures and videos of a message the viewer pages through,
 * attachments first, then embeds. Unlike the reference, a card's corner thumbnail opens too: when the card also
 * has an image, the thumbnail is a page of its own, just before it.
 */
export function messageSources(message: MediaHolder): MessageSources {
    const sources: ViewerSource[] = []
    const attachments: number[] = []
    const embeds: number[] = []
    const thumbnails: number[] = []
    for (const attachment of message.attachments ?? []) {
        if ((attachment.flags ?? 0) & AttachmentFlag.IS_THUMBNAIL) continue
        const source = attachmentSource(attachment)
        attachments.push(source ? sources.push(source) - 1 : -1)
    }
    const spoiler = embedSpoiler(message)
    for (const embed of message.embeds ?? []) {
        const own =
            embed.image &&
            embed.thumbnail &&
            embed.thumbnail.url !== embed.image.url &&
            cornerThumbnail(embed)
                ? sources.push(pictureSource(embed.thumbnail)) - 1
                : undefined
        const source = embedSource(embed, spoiler)
        const index = source ? sources.push(source) - 1 : -1
        embeds.push(index)
        // Without an image (or with the same picture), the embed's own source is its thumbnail.
        thumbnails.push(own ?? index)
    }
    return { sources, attachments, embeds, thumbnails }
}

/**
 * useOnPressMediaItem: every picture and video among the search results, the message each belongs to, and where
 * `selected` is among them (-1 when it has nothing to show).
 */
export function searchSources(
    items: MediaItem[],
    selected: MediaItem,
): { sources: ViewerSource[]; messages: Message[]; initialIndex: number } {
    const sources: ViewerSource[] = []
    const messages: Message[] = []
    let initialIndex = -1
    for (const item of items) {
        const source =
            item.type === 'attachment'
                ? attachmentSource(item.attachment)
                : item.type === 'embed'
                  ? embedSource(item.embed, embedSpoiler(item.message), true)
                  : undefined
        if (!source) continue
        if (item.key === selected.key) initialIndex = sources.length
        sources.push(source)
        messages.push(item.message)
    }
    return { sources, messages, initialIndex }
}
