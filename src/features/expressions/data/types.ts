import type { GuildEmoji } from '../../../core/discord/expressionTypes'

export { StickerFormat } from '../../../core/discord/expressionTypes'
export type {
    GuildEmoji,
    Sticker,
    StickerPack,
} from '../../../core/discord/expressionTypes'

/** A guild emoji with the guild it belongs to, which the API payloads leave implicit. */
export interface CustomEmoji extends GuildEmoji {
    type: 'custom'
    guildId: string
}

export interface UnicodeEmoji {
    type: 'unicode'
    /** First name; the key frecency and favorites use. */
    uniqueName: string
    /** Every name and alias, `:name:` works for each. */
    names: string[]
    surrogates: string
    unicodeVersion: number
    /** Absent for the skin tone modifiers, which are not in a picker category. */
    category?: string
    /** One skin tone variant set (a single tone applies to the emoji). */
    hasDiversity: boolean
    /** Several tones (handshake, couples): variants are keyed by each person's tone. */
    hasMultiDiversity: boolean
    /** A skin tone variant of another emoji. */
    isDiversityChild: boolean
    /** Tone code points of a variant (`1f3fb`), in the reference's order. */
    diversity?: string[]
    /** Variants by `diversity.join('-')`. */
    diversityChildren: Record<string, UnicodeEmoji>
    /** The emoji it is a variant of. */
    parent?: UnicodeEmoji
}

export type AnyEmoji = UnicodeEmoji | CustomEmoji

export const StickerType = { STANDARD: 1, GUILD: 2 } as const
