import { stickerImageUrl } from '../../core/discord/cdn'
import { StickerFormat } from '../../core/discord/expressionTypes'
import { isImageFile, isVideoFile } from '../../core/discord/mediaFormats'
import {
    AttachmentFlag,
    SPOILER_FILENAME_PREFIX,
} from '../../core/discord/messages'
import { formatBytes } from '../../core/format'
import { DAY } from '../../core/time'
import { t } from '../../i18n'
import { rgbInt } from './color'
import { formatNumericDate, formatTime, sameDay } from './timestamp'
import type {
    Attachment,
    Embed,
    EmbedMedia,
    StickerItem,
} from '../../stores/messages/messageTypes'
import type {
    AttachmentRow,
    EmbedRow,
    MediaRow,
    Span,
    StickerRow,
} from './rows/rows'

// MediaFormatTesters.isAudioFile, Android variant.
const AUDIO = /\.(mp3|m4a|wav|ogg|opus|flac)$/i
const pathOf = (url: string) => url.split('?', 1)[0] ?? ''

/*
 * Image URLs are the plain proxy URLs. Only the native list knows how large a tile is once laid out, so it
 * appends the media proxy's width, height, format and animated parameters itself (ProxyImageMapper).
 */

export function attachmentRows(
    attachments: Attachment[] | undefined,
): AttachmentRow[] {
    // Thumbnails of other attachments (IS_THUMBNAIL = 1 << 1) are not shown on their own.
    return (attachments ?? [])
        .filter(
            attachment =>
                !((attachment.flags ?? 0) & AttachmentFlag.IS_THUMBNAIL),
        )
        .map((attachment): AttachmentRow => {
            const { filename, width, height } = attachment
            const spoiler =
                filename.startsWith(SPOILER_FILENAME_PREFIX) ||
                Boolean((attachment.flags ?? 0) & AttachmentFlag.IS_SPOILER)
            const base = {
                filename: spoiler
                    ? filename.replace(SPOILER_FILENAME_PREFIX, '')
                    : filename,
                size: formatBytes(attachment.size),
                width: width ?? 0,
                height: height ?? 0,
                spoiler: spoiler ? t('chat.media.spoiler') : undefined,
                description: attachment.description || undefined,
                altLabel: attachment.description
                    ? t('chat.media.alt')
                    : undefined,
            }
            const source = attachment.proxy_url || attachment.url
            if (width && height && isImageFile(filename)) {
                return { ...base, kind: 'image', url: source }
            }
            if (width && height && isVideoFile(filename)) {
                // The proxy serves a still frame of a video, so the poster is the same URL.
                return {
                    ...base,
                    kind: 'video',
                    url: source,
                    posterUrl: source,
                }
            }
            if (attachment.waveform) {
                return {
                    ...base,
                    kind: 'voice',
                    url: attachment.url,
                    durationSecs: attachment.duration_secs,
                    waveform: attachment.waveform,
                }
            }
            if (AUDIO.test(filename)) {
                return {
                    ...base,
                    kind: 'audio',
                    url: attachment.url,
                    durationSecs: attachment.duration_secs,
                }
            }
            return { ...base, kind: 'file', url: attachment.url }
        })
}

export function stickerRows(stickers: StickerItem[] | undefined): StickerRow[] {
    return (stickers ?? []).map(sticker => {
        const lottie = sticker.format_type === StickerFormat.LOTTIE
        const extension =
            sticker.format_type === StickerFormat.GIF ? 'gif' : 'png'
        return {
            name: sticker.name,
            url: lottie
                ? `https://discord.com/stickers/${sticker.id}.json`
                : stickerImageUrl(sticker.id, extension, 320),
            lottie,
        }
    })
}

/** The `/stickers/<id>.` part of the URLs `stickerRows` builds. */
const STICKER_ID = /\/stickers\/(\d+)\./

/** Returns the id of a sticker from the URL `stickerRows` gave it, which a tapped sticker reports. */
export const stickerIdOf = (url: string): string | undefined =>
    url.match(STICKER_ID)?.[1]

function embedMedia(media: EmbedMedia | undefined): MediaRow | undefined {
    if (!media) return undefined
    // Some bot embeds leave the size out; the renderer then fits the image to the media box.
    return {
        url: media.proxy_url ?? media.url,
        width: media.width ?? 0,
        height: media.height ?? 0,
    }
}

/** The footer's timestamp: "Today at 1:25 PM", "Yesterday at 1:25 PM", or the date. */
function calendar(iso: string): string {
    const date = new Date(iso)
    const time = formatTime(date)
    const now = new Date()
    if (sameDay(date, now)) return t('chat.today', { time })
    if (sameDay(date, new Date(now.getTime() - DAY)))
        return t('chat.yesterday', { time })
    return formatNumericDate(date)
}

const httpUrl = (url: string | undefined) =>
    url && /^https?:\/\//i.test(url) ? url : undefined

/** The reference's hosted players with a play button (shouldPlayVideoInline) and how it names a provider (getEffectiveVideoProvider). */
function hostedPlayer(embed: Embed): boolean {
    let name = embed.provider?.name
    if (name !== 'YouTube' && name !== 'TikTok') {
        try {
            const host = new URL(embed.video?.url ?? '').hostname
            if (host === 'www.youtube.com') name = 'YouTube'
            else if (host === 'www.tiktok.com') name = 'TikTok'
        } catch {}
    }
    return name === 'YouTube' || name === 'TikTok'
}

/**
 * EmbedUtils.isEmbedInline: an embed with an image or video and nothing else to say (gifv always) is just media.
 * The reference's image comes from the thumbnail on image and article embeds. A description or fields keep the card.
 */
function isInline(embed: Embed): boolean {
    const type = embed.type ?? 'rich'
    const hasMedia =
        embed.image ??
        embed.video ??
        (type === 'image' || type === 'article' ? embed.thumbnail : undefined)
    if (!hasMedia) return false
    if (type === 'gifv') return true
    return (
        type !== 'rich' &&
        !embed.author &&
        embed.title == null &&
        !embed.description &&
        !embed.fields?.length
    )
}

/** Whether an embed card tucks its thumbnail into the corner: video and article previews show it large instead. */
export function cornerThumbnail(embed: Embed): boolean {
    const type = embed.type ?? 'rich'
    return (
        embed.thumbnail != null &&
        !isInline(embed) &&
        type !== 'video' &&
        type !== 'article'
    )
}

interface MergedEmbed {
    embed: Embed
    /** Index in the message's embeds; the `isocord://embed-media` links count by it. */
    source: number
    /** EmbedUtils.mergeEmbedsOnURL: the images of later embeds with the same url, which are dropped. */
    images: Array<{ media: EmbedMedia; source: number }>
}

function mergeOnUrl(embeds: Embed[]): MergedEmbed[] {
    const byUrl = new Map<string, MergedEmbed>()
    const merged: MergedEmbed[] = []
    embeds.forEach((embed, source) => {
        const first = embed.url ? byUrl.get(embed.url) : undefined
        if (first) {
            if (embed.image) {
                if (first.embed.image && first.images.length === 0)
                    first.images.push({
                        media: first.embed.image,
                        source: first.source,
                    })
                first.images.push({ media: embed.image, source })
            }
            return
        }
        const item: MergedEmbed = { embed, source, images: [] }
        if (embed.url) byUrl.set(embed.url, item)
        merged.push(item)
    })
    return merged
}

/** RedundantLinkUtils.hasOnlySimpleEmbed: exactly one image or GIF embed, shown inline. */
export function hasOnlySimpleEmbed(embeds: Embed[] | undefined): boolean {
    const [only, ...rest] = mergeOnUrl(embeds ?? [])
    return (
        only !== undefined &&
        rest.length === 0 &&
        (only.embed.type === 'image' || only.embed.type === 'gifv') &&
        isInline(only.embed)
    )
}

/** Turns markdown into spans: embed titles and field names use their own rules (`title`: with or without links). */
export type EmbedSpans = (text: string, title?: 'links' | 'plain') => Span[]

function embedRow(
    { embed, source, images }: MergedEmbed,
    spans: EmbedSpans,
): EmbedRow | undefined {
    const type = embed.type ?? 'rich'
    const thumbnail = embedMedia(embed.thumbnail)
    const image = embedMedia(embed.image)
    const video = embed.video
    const videoUrl = video && (video.proxy_url || video.url)
    // The proxy serves a still frame of a video it hosts, which stands in for a missing thumbnail.
    const frame =
        video?.proxy_url && video.width && video.height
            ? { url: video.proxy_url, width: video.width, height: video.height }
            : undefined
    // Hosted players (YouTube, ...) cannot be played here; a file can.
    const playsInline =
        (type === 'video' || type === 'gifv') &&
        Boolean(video?.proxy_url) &&
        (type === 'gifv' || isVideoFile(pathOf(videoUrl ?? '')))
    if (isInline(embed)) {
        // Tenor and Giphy gifv: a still plus the looping MP4 that replaces it.
        const poster =
            thumbnail ??
            image ??
            frame ??
            (video?.width && video.height
                ? { url: '', width: video.width, height: video.height }
                : undefined)
        return (
            poster && {
                media: true,
                source,
                description: [],
                fields: [],
                image: poster,
                videoUrl: playsInline || type === 'gifv' ? videoUrl : undefined,
                gifv: type === 'gifv' || undefined,
                playLink:
                    type === 'video' && !video?.proxy_url && hostedPlayer(embed)
                        ? httpUrl(embed.url ?? video?.url)
                        : undefined,
            }
        )
    }
    // Video and article previews show their thumbnail large; other embeds tuck it into the corner.
    const large = type === 'video' || type === 'article'
    const footer = [
        embed.footer?.text,
        embed.timestamp && calendar(embed.timestamp),
    ]
        .filter(Boolean)
        .join(' | ')
    const bigImage = image ?? (large ? (thumbnail ?? frame) : undefined)
    const row: EmbedRow = {
        media: false,
        source,
        color: rgbInt(embed.color),
        provider: embed.provider?.name,
        providerUrl: httpUrl(embed.provider?.url),
        authorName: embed.author?.name,
        authorIconUrl: embed.author?.proxy_icon_url,
        authorUrl: httpUrl(embed.author?.url),
        // A title that links to the embed's url keeps no links of its own (parseEmbedTitleWithoutLinks).
        title: embed.title
            ? spans(embed.title, httpUrl(embed.url) ? 'plain' : 'links')
            : undefined,
        url: httpUrl(embed.url),
        description: embed.description ? spans(embed.description) : [],
        fields: (embed.fields ?? []).map(field => ({
            name: spans(field.name, 'links'),
            value: spans(field.value),
            inline: Boolean(field.inline),
        })),
        image: bigImage,
        // Several embeds sharing the url (a Twitter post with more pictures) form one gallery.
        images: images.length
            ? images.map(item => ({
                  url: item.media.proxy_url ?? item.media.url,
                  width: item.media.width ?? 0,
                  height: item.media.height ?? 0,
                  source: item.source,
              }))
            : undefined,
        thumbnail: cornerThumbnail(embed) ? thumbnail : undefined,
        videoUrl: playsInline ? videoUrl : undefined,
        // The reference draws the play button only on YouTube and TikTok videos that have no file.
        playLink:
            type === 'video' &&
            !video?.proxy_url &&
            bigImage &&
            hostedPlayer(embed)
                ? httpUrl(embed.url ?? video?.url)
                : undefined,
        footer: footer || undefined,
        footerIconUrl: embed.footer?.proxy_icon_url,
    }
    const empty =
        !row.provider &&
        !row.authorName &&
        !row.title?.length &&
        !row.description.length &&
        !row.fields.length &&
        !row.image &&
        !row.thumbnail &&
        !row.footer
    return empty ? undefined : row
}

/** `spoiler` (the localised label) hides the media of every embed until tapped: the link was written inside `||...||`. */
export function embedRows(
    embeds: Embed[] | undefined,
    spans: EmbedSpans,
    spoiler?: string,
): EmbedRow[] {
    return mergeOnUrl(embeds ?? [])
        .map(item => embedRow(item, spans))
        .filter(embed => embed !== undefined)
        .map(embed => (spoiler ? { ...embed, spoiler } : embed))
}
