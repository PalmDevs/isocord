import { File, Paths } from 'expo-file-system'
import type { UnicodeEmoji } from './types'

/**
 * The reference's Unicode emoji dataset (module 4725, from `scripts/extract-emojis.ts`).
 * Holds names, aliases, categories in picker order, skin tone variants and the emoticon table.
 * English has no keywords, so `names` is the keyword list.
 * The ~260 KB JSON loads on the first `loadUnicodeEmojis()` call, not at startup.
 */

/** Raw row: [names, surrogates, unicodeVersion, flags (1 diversity, 2 multi diversity, 4 skin tone modifier), children or tone codes]. */
type Row = [string[], string, number, number, (number | string)[]?]

interface Dataset {
    categories: Array<[string, number, number]>
    emojis: Row[]
    shortcuts: Record<string, string>
}

export interface UnicodeEmojiCategory {
    /** `people`, `nature`, `food`, `activity`, `travel`, `objects`, `symbols`, `flags`. */
    name: string
    emojis: UnicodeEmoji[]
}

export interface UnicodeEmojiData {
    /** Picker categories in the reference's order. Skin tone variants are not listed, they hang off their base emoji. */
    categories: UnicodeEmojiCategory[]
    /** Every listed emoji, in category order. */
    all: UnicodeEmoji[]
    /** Emoticon to emoji name, e.g. `:-)` to `slight_smile`. */
    shortcuts: Record<string, string>
    byName: Map<string, UnicodeEmoji>
    /** Includes the skin tone variants. */
    bySurrogates: Map<string, UnicodeEmoji>
}

/** Skin tone modifiers, light to dark; `skin-tone-N` is index N - 1. */
export const SKIN_TONE_SURROGATES = [
    '\u{1F3FB}',
    '\u{1F3FC}',
    '\u{1F3FD}',
    '\u{1F3FE}',
    '\u{1F3FF}',
] as const

let data: UnicodeEmojiData | undefined
let loading: Promise<UnicodeEmojiData> | undefined

function build(raw: Dataset): UnicodeEmojiData {
    const rows = raw.emojis.map(
        ([names, surrogates, unicodeVersion, flags, extra]) => {
            const emoji: UnicodeEmoji = {
                type: 'unicode',
                uniqueName: names[0] as string,
                names,
                surrogates,
                unicodeVersion,
                hasDiversity: (flags & 1) !== 0,
                hasMultiDiversity: (flags & 2) !== 0,
                isDiversityChild:
                    (flags & 4) !== 0 || typeof extra?.[0] === 'string',
                diversityChildren: {},
            }
            if (emoji.isDiversityChild && extra)
                emoji.diversity = extra as string[]
            return emoji
        },
    )
    raw.emojis.forEach(([, , , , extra], index) => {
        const emoji = rows[index] as UnicodeEmoji
        if (!extra || emoji.isDiversityChild) return
        for (const childIndex of extra as number[]) {
            const child = rows[childIndex]
            if (!child?.diversity) continue
            child.parent = emoji
            emoji.diversityChildren[child.diversity.join('-')] = child
        }
    })

    const categories = raw.categories.map(([name, start, end]) => {
        const emojis = rows.slice(start, end)
        for (const emoji of emojis) emoji.category = name
        return { name, emojis }
    })
    const byName = new Map<string, UnicodeEmoji>()
    const bySurrogates = new Map<string, UnicodeEmoji>()
    for (const emoji of rows) {
        for (const name of emoji.names) byName.set(name, emoji)
        bySurrogates.set(emoji.surrogates, emoji)
    }
    return {
        categories,
        all: categories.flatMap(category => category.emojis),
        shortcuts: raw.shortcuts,
        byName,
        bySurrogates,
    }
}

/**
 * Loads and indexes the dataset once. The JSON ships as an APK asset (`android/app/src/main/assets`)
 * and is parsed at runtime: required through Metro it would become a large JS module that bloats
 * the bundle and is slow to compile in Hermes.
 */
export function loadUnicodeEmojis(): Promise<UnicodeEmojiData> {
    loading ??= new File(Paths.bundle, 'unicode-emojis.json')
        .text()
        .then(text => {
            data = build(JSON.parse(text) as Dataset)
            return data
        })
    return loading
}

/** The dataset when `loadUnicodeEmojis()` has finished, otherwise undefined. */
export const getUnicodeEmojis = (): UnicodeEmojiData | undefined => data

/** The code point of a skin tone modifier in the dataset's lowercase hex form (`1f3fb`). */
const toneCode = (surrogate: string) =>
    (surrogate.codePointAt(0) ?? 0).toString(16)

/**
 * An emoji by `names` entry, also as `name::skin-tone-N` (what the reference writes for a toned
 * emoji) which resolves to that variant.
 */
export function getUnicodeEmojiByName(name: string): UnicodeEmoji | undefined {
    const direct = data?.byName.get(name)
    if (direct) return direct
    const match = /^(.+)::skin-tone-([1-5])$/.exec(name)
    const base = match && data?.byName.get(match[1] as string)
    return base
        ? applySkinTone(base, SKIN_TONE_SURROGATES[Number(match[2]) - 1])
        : undefined
}

/** An emoji from its characters; tolerates a missing variation selector. */
export function getUnicodeEmojiBySurrogates(
    surrogates: string,
): UnicodeEmoji | undefined {
    return (
        data?.bySurrogates.get(surrogates) ??
        data?.bySurrogates.get(`${surrogates}️`) ??
        data?.bySurrogates.get(surrogates.replace(/️/g, ''))
    )
}

/**
 * The variant of `emoji` for the user's default skin tone (`diversity_surrogate`, a modifier
 * character, or empty/undefined for none). Only emojis with a single tone variant set change:
 * multi tone emojis (handshake) stay as they are, as in the reference.
 */
export function applySkinTone(
    emoji: UnicodeEmoji,
    tone: string | null | undefined,
): UnicodeEmoji {
    if (!tone || !emoji.hasDiversity) return emoji
    return emoji.diversityChildren[toneCode(tone)] ?? emoji
}

/** `:name:` for the first name, or the `fallback` when the characters are not an emoji. */
export function surrogatesToShortcode(
    surrogates: string,
    fallback = surrogates,
): string {
    const emoji = getUnicodeEmojiBySurrogates(surrogates)
    return emoji ? `:${emoji.uniqueName}:` : fallback
}
