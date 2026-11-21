import { toCodePoints } from '@twemoji/parser'

const buildUrl = (codepoints: string) =>
    `file:///android_asset/twemoji/${codepoints}.png`

/**
 * Returns the asset URL for a Unicode emoji.
 * Twemoji drops U+FE0F from file names unless the sequence has a zero-width joiner.
 */
export const twemojiUrl = (emoji: string) =>
    buildUrl(
        toCodePoints(
            emoji.includes('\u200d') ? emoji : emoji.replaceAll('\ufe0f', ''),
        ).join('-'),
    )
