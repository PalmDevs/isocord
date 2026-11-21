import { parse } from '@twemoji/parser'
import { twemojiUrl } from '../../core/discord/twemoji'

export { twemojiUrl }

/**
 * Twemoji art bundled as APK assets (`scripts/fetch-twemoji.sh`), as the reference does
 * (EmojiUtilsPlatformed.native getURL: `asset:/emoji-<codepoints>.png`). Glide (expo-image) and Coil both load
 * `file:///android_asset/` URIs.
 */
const buildUrl = (codepoints: string) =>
    `file:///android_asset/twemoji/${codepoints}.png`

interface EmojiPart {
    text: string
    /** Twemoji image for this run, when it is an emoji. */
    emoji?: string
}

const ASCII_ONLY = /^[\x20-\x7e\n\r\t]*$/

/** Splits text into plain runs and Unicode emoji. `:shortcode:` text is left as it is. */
export function splitEmoji(text: string): EmojiPart[] {
    if (ASCII_ONLY.test(text)) return [{ text }]
    const parts: EmojiPart[] = []
    let cursor = 0
    for (const entity of parse(text, { assetType: 'png', buildUrl })) {
        const [start, end] = entity.indices
        if (start > cursor) parts.push({ text: text.slice(cursor, start) })
        parts.push({ text: entity.text, emoji: entity.url })
        cursor = end
    }
    if (cursor < text.length) parts.push({ text: text.slice(cursor) })
    return parts
}
