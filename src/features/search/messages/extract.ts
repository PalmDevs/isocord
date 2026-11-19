import { isImageFile, isVideoFile } from '../../../core/discord/mediaFormats'
import { AttachmentFlag } from '../../../core/discord/messages'
import { linkAt } from './text'
import type { Attachment, Embed } from '../../../stores/messages/messageTypes'
import type { Message } from '../../../stores/readStates'

export const isImageAttachment = (attachment: Attachment) =>
    Boolean(attachment.width && attachment.height) &&
    (attachment.content_type?.startsWith('image/') ||
        isImageFile(attachment.filename))
export const isVideoAttachment = (attachment: Attachment) =>
    Boolean(attachment.width && attachment.height) &&
    (attachment.content_type?.startsWith('video/') ||
        isVideoFile(attachment.filename))

/** isValidImageEmbed: an embed that has a picture to show (a still, a gif, or the poster of a video). */
export function embedImage(embed: Embed): string | undefined {
    const media = embed.thumbnail ?? embed.image
    const url = media?.proxy_url ?? media?.url
    if (url) return url
    return undefined
}

const isVoiceMessage = (message: Message) =>
    Boolean((message.flags ?? 0) & AttachmentFlag.IS_VOICE_MESSAGE)

/** The size of the picture `embedImage` picks, when the embed says it. */
function embedImageSize(
    embed: Embed,
): { width: number; height: number } | undefined {
    const media = embed.thumbnail ?? embed.image
    return media?.width && media.height
        ? { width: media.width, height: media.height }
        : undefined
}

/** Height over width kept within `min` and `max`; `fallback` (also clamped) when the size is not known. */
export function clampRatio(
    size: { width?: number | null; height?: number | null } | undefined,
    min: number,
    max: number,
    fallback: number,
): number {
    const ratio =
        size?.width && size.height ? size.height / size.width : fallback
    return Math.min(Math.max(ratio, min), max)
}

/** SearchMediaTypes. */
export type MediaItem =
    | {
          key: string
          type: 'attachment'
          message: Message
          attachment: Attachment
          video: boolean
      }
    | {
          key: string
          type: 'embed'
          message: Message
          embed: Embed
          url: string
      }
    | { key: string; type: 'audio'; message: Message; attachment?: Attachment }

/**
 * The items of each message, kept while the message is: a page of results added, or the list built again, gives the
 * tiles already shown the same items, and their memoised cells don't render again.
 */
const mediaOfMessage = new WeakMap<Message, MediaItem[]>()

/** SearchPlatformUtils.getMedia: every picture and video of the messages, in order, plus voice messages. */
export function getMedia(messages: Message[]): MediaItem[] {
    return messages.flatMap(message => {
        let items = mediaOfMessage.get(message)
        if (!items) {
            items = messageMedia(message)
            mediaOfMessage.set(message, items)
        }
        return items
    })
}

function messageMedia(message: Message): MediaItem[] {
    const items: MediaItem[] = []
    let index = 0
    for (const attachment of message.attachments ?? []) {
        if ((attachment.flags ?? 0) & AttachmentFlag.IS_THUMBNAIL) continue
        const video = isVideoAttachment(attachment)
        if (!video && !isImageAttachment(attachment)) continue
        items.push({
            key: `${message.id}-${index++}`,
            type: 'attachment',
            message,
            attachment,
            video: Boolean(video),
        })
    }
    for (const embed of message.embeds ?? []) {
        const url = embedImage(embed)
        if (!url) continue
        items.push({
            key: `${message.id}-${index++}`,
            type: 'embed',
            message,
            embed,
            url,
        })
    }
    if (isVoiceMessage(message))
        items.push({
            key: `${message.id}-${index++}`,
            type: 'audio',
            message,
            attachment: message.attachments?.[0],
        })
    return items
}

/** The size of what a media tile shows; none for a voice message. */
export function mediaSize(item: MediaItem) {
    return item.type === 'attachment'
        ? item.attachment
        : item.type === 'embed'
          ? embedImageSize(item.embed)
          : undefined
}

/** SearchFileTypes. */
export interface FileItem {
    key: string
    type: 'audio' | 'media_attachment' | 'attachment'
    message: Message
    attachment: Attachment
}

/** SearchPlatformUtils.getFiles: the attachments of the messages; pictures and videos keep a thumbnail. */
export function getFiles(messages: Message[]): FileItem[] {
    return messages.flatMap(message =>
        (message.attachments ?? []).map((attachment, index): FileItem => {
            const media =
                isImageAttachment(attachment) || isVideoAttachment(attachment)
            return {
                key: `${message.id}-${index}`,
                type: media
                    ? 'media_attachment'
                    : isVoiceMessage(message)
                      ? 'audio'
                      : 'attachment',
                message,
                attachment,
            }
        }),
    )
}

/** The size of a file card's picture; only a picture or a video has one. */
export const fileSize = (item: FileItem) =>
    item.type === 'media_attachment' ? item.attachment : undefined

/** SearchLinkTypes. */
export type LinkItem =
    | {
          key: string
          type: 'embed'
          message: Message
          embed: Embed
          url: string
      }
    | { key: string; type: 'text'; message: Message; link?: string }

/** The size of a link card's picture. */
export const linkSize = (item: LinkItem) =>
    item.type === 'embed' ? embedImageSize(item.embed) : undefined

/**
 * SearchPlatformUtils.getLinks: the embeds of a message that have a picture, or when there are none a single
 * entry for the first link in its text.
 */
export function getLinks(messages: Message[]): LinkItem[] {
    return messages.flatMap((message): LinkItem[] => {
        const embeds = (message.embeds ?? []).flatMap((embed, index) => {
            const url = embedImage(embed)
            return url
                ? [
                      {
                          key: `${message.id}-${index}`,
                          type: 'embed' as const,
                          message,
                          embed,
                          url,
                      },
                  ]
                : []
        })
        if (embeds.length > 0) return embeds
        return [
            {
                key: `${message.id}-0`,
                type: 'text',
                message,
                link: linkAt(message.content),
            },
        ]
    })
}

/** Adds the media proxy's size and format to a picture's URL (ProxyImageMapper); video stills come as webp. */
export function proxied(url: string, width: number, height: number): string {
    if (
        !/^https?:\/\/(media|images-ext-\d+)\.discordapp\.(net|com)\//.test(url)
    )
        return url
    const separator = url.includes('?') ? '&' : '?'
    return `${url}${separator}format=webp&width=${Math.round(width)}&height=${Math.round(height)}`
}
