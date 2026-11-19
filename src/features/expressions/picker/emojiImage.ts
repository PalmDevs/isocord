import { emojiUrl, stickerImageUrl } from '../../../core/discord/cdn'
import { StickerFormat } from '../../../core/discord/expressionTypes'
import { twemojiUrl } from '../../chat/emoji'
import type { SearchEmoji } from '../data/search'
import type { Sticker } from '../data/types'

export { twemojiUrl }

/** Image of an emoji; animated custom emojis only move when `animate` (the user's `animate_emoji`). */
export function emojiImageUrl(emoji: SearchEmoji, animate: boolean) {
    return emoji.type === 'unicode'
        ? twemojiUrl(emoji.surrogates)
        : `${emojiUrl(emoji.id, false, 96)}${emoji.animated && animate ? '&animated=true' : ''}`
}

/**
 * The text the composer inserts for an emoji: `:name:`, or `:name~N:` for a custom emoji whose name is taken
 * (EmojiDisambiguations), so the right one is found when sent and becomes `<:name:id>`.
 */
export const emojiText = (emoji: SearchEmoji) =>
    emoji.type === 'unicode' ? emoji.surrogates : `:${emoji.name}:`

/** A sticker's image from the media proxy: the GIF of a GIF sticker, a PNG of the others (an APNG keeps its frames). */
export const stickerUrl = (sticker: Sticker, size = 160) =>
    stickerImageUrl(
        sticker.id,
        sticker.format_type === StickerFormat.GIF ? 'gif' : 'png',
        size,
    )
