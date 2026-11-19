import {
    EmojiDisabledReason,
    EmojiIntention,
    getEmojiUnavailableReason,
    getStickerSendability,
    isEmojiUsableByRoles,
    StickerSendability,
} from './availability'
import { applySkinTone } from './unicode'
import type { UsageContext } from './availability'
import type { AnyEmoji, CustomEmoji, GuildEmoji, Sticker } from './types'
import type { UnicodeEmojiData } from './unicode'

/**
 * Emoji and sticker search plus the chat input's suggestion triggers. Pure, all input comes
 * from the `ExpressionContext`.
 * Reference: `EmojiStore.searchWithoutFetchingLatest`, `getSearchResultsOrder`,
 * `AutocompleteUtils.queryStickers`, `useEmojiSuggestions`, `AutocompleteOptions`.
 */

/** One guild's expressions as the search sees them. */
export interface ContextGuild {
    id: string
    name: string
    emojis: GuildEmoji[]
    stickers: Sticker[]
    /** The user's role ids in the guild, for role restricted emojis. */
    memberRoleIds: string[]
}

export interface ExpressionContext extends UsageContext {
    /** The user's guilds with held emojis/stickers, in the server list's order. The current guild is moved first. */
    guilds: ContextGuild[]
    /** Absent until `loadUnicodeEmojis()` finished: only custom emojis are found then. */
    unicode?: UnicodeEmojiData
    /** Stickers of the standard packs, with `packNames` by pack id. Absent until the packs are fetched. */
    standardStickers?: Sticker[]
    packNames?: Record<string, string>
    /** Frecency score of an emoji key (custom id, unicode first name) or sticker id; null when unused. */
    emojiScore?: (key: string) => number | null
    stickerScore?: (id: string) => number | null
    /** The user's default skin tone modifier, applied to unicode emojis that have variants. */
    skinTone?: string | null
}

/** A search hit. Custom emojis whose name is taken get `name~N` as `name`, `originalName` keeps the real one. */
export type SearchEmoji =
    | (Exclude<AnyEmoji, CustomEmoji> & { name?: undefined })
    | (CustomEmoji & { originalName?: string })

export interface EmojiSearchResult {
    /** Usable now. */
    unlocked: SearchEmoji[]
    /** Needs Nitro; shown with an upsell. */
    locked: SearchEmoji[]
}

const escapeRegex = (text: string) =>
    text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const emojiName = (emoji: SearchEmoji) =>
    emoji.type === 'unicode' ? emoji.uniqueName : emoji.name
const emojiKey = (emoji: SearchEmoji) =>
    emoji.type === 'unicode' ? emoji.uniqueName : emoji.id

const compareStrings = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

const emojiLists = new WeakMap<ExpressionContext, SearchEmoji[]>()

/**
 * Returns every pickable emoji in the reference's order.
 * Unicode first, then the current guild's emojis, then other guilds'.
 * Custom emojis sort by name, skip roles the user lacks, and duplicate names get `~1`, `~2`.
 */
export function listEmojis(context: ExpressionContext): SearchEmoji[] {
    const cached = emojiLists.get(context)
    if (cached) return cached
    const taken = new Map<string, number>()
    const list: SearchEmoji[] = []
    for (const emoji of context.unicode?.all ?? []) {
        list.push(applySkinTone(emoji, context.skinTone) as SearchEmoji)
        for (const name of emoji.names) taken.set(name, 1)
    }
    const currentGuildId = context.guildId ?? context.channel?.guildId
    const guilds = [...context.guilds].sort(
        (a, b) =>
            Number(b.id === currentGuildId) - Number(a.id === currentGuildId),
    )
    for (const guild of guilds) {
        const usable = guild.emojis
            .filter(emoji => isEmojiUsableByRoles(emoji, guild.memberRoleIds))
            .sort((a, b) => compareStrings(a.name, b.name))
        for (const emoji of usable) {
            const count = taken.get(emoji.name) ?? 0
            taken.set(emoji.name, count + 1)
            const custom: CustomEmoji & { originalName?: string } = {
                ...emoji,
                type: 'custom',
                guildId: guild.id,
            }
            if (count > 0) {
                custom.originalName = emoji.name
                custom.name = `${emoji.name}~${count}`
            }
            list.push(custom)
        }
    }
    emojiLists.set(context, list)
    return list
}

/**
 * Scores an emoji result as the reference does.
 * Score is `1 + exact (4) + whole word (2) + prefix (1)`, times `max(1, frecencyScore / 100)`.
 * Ties sort by name, then `listEmojis` order (the sort is stable).
 */
function rank(
    emojis: SearchEmoji[],
    query: string,
    count: number,
    context: ExpressionContext,
): SearchEmoji[] {
    if (emojis.length === 0) return emojis
    const lower = query.toLowerCase()
    const escaped = escapeRegex(lower)
    const prefix = new RegExp(`^${escaped}`, 'i')
    const word = new RegExp(`(^|_|[A-Z])${escaped}s?([A-Z]|_|$)`)
    const scored = emojis.map(emoji => {
        const name = emojiName(emoji)
        const lowered = name.toLowerCase()
        const base =
            1 +
            (lowered === lower ? 4 : 0) +
            (word.test(lowered) ? 2 : 0) +
            (prefix.test(name) ? 1 : 0)
        const frecency = context.emojiScore?.(emojiKey(emoji)) ?? null
        return {
            emoji,
            name,
            score:
                frecency === null ? base : base * Math.max(1, frecency / 100),
        }
    })
    scored.sort((a, b) => b.score - a.score || compareStrings(a.name, b.name))
    const sorted = scored.map(item => item.emoji)
    return count > 0 ? sorted.slice(0, count) : sorted
}

export interface EmojiSearchOptions {
    /** Cap on `unlocked` (0 or absent: all). */
    count?: number
    /** Defaults to the context's intention, then CHAT. */
    intention?: number
    /** Defaults to every name containing the query, ignoring `_` and case. */
    matchComparator?: (name: string) => boolean
    /** Unicode emojis only (the reference's `showOnlyUnicode`). */
    showOnlyUnicode?: boolean
    /** Allow emojis of other guilds in intentions that refuse them. Defaults to true as in the reference. */
    includeExternalGuilds?: boolean
}

/**
 * Searches emojis by name and alias, ranked by `rank` and split into usable and Nitro locked.
 * Default match is a case-insensitive substring ignoring underscores (`searchWithoutFetchingLatest`).
 */
export function searchEmojis(
    query: string,
    context: ExpressionContext,
    options: EmojiSearchOptions = {},
): EmojiSearchResult {
    const needle = query.toLowerCase().replace(/[ _]/g, '')
    const matches =
        options.matchComparator ??
        ((name: string) =>
            name.replaceAll('_', '').toLowerCase().includes(needle))
    const usage: UsageContext = {
        ...context,
        intention:
            options.intention ?? context.intention ?? EmojiIntention.CHAT,
        forceIncludeExternalGuilds: options.includeExternalGuilds ?? true,
    }
    const unlocked: SearchEmoji[] = []
    const locked: SearchEmoji[] = []
    for (const emoji of listEmojis(context)) {
        const names = emoji.type === 'unicode' ? emoji.names : [emoji.name]
        if (!names.some(matches)) continue
        const reason = getEmojiUnavailableReason(emoji, usage)
        if (reason === EmojiDisabledReason.PREMIUM_LOCKED) {
            if (!options.showOnlyUnicode) locked.push(emoji)
            continue
        }
        if (reason !== null) continue
        if (options.showOnlyUnicode && emoji.type !== 'unicode') continue
        unlocked.push(emoji)
    }
    return {
        unlocked: rank(unlocked, query, options.count ?? 0, context),
        locked: rank(locked, query, 0, context),
    }
}

// Stickers ----------------------------------------------------------------

type MetadataKind = 'name' | 'tag' | 'emoji' | 'guild' | 'pack'
interface Metadata {
    kind: MetadataKind
    value: string
}

const PRIORITY: Record<MetadataKind, number> = {
    name: 11,
    emoji: 6,
    tag: 1,
    guild: 8,
    pack: 8,
}
/** Kinds that also match by substring. */
const SUBSTRING_KINDS: ReadonlySet<MetadataKind> = new Set([
    'guild',
    'pack',
    'name',
])
const EXACT_MULTIPLIER = 10
const PREFIX_MULTIPLIER = 7
const SUBSTRING_MULTIPLIER = 5

const stripDiacritics = (text: string) =>
    text.normalize('NFD').replace(/\p{M}/gu, '')

/** What a guild sticker can be found by: name, tags, the emojis the tags name, and the guild's name. */
function guildStickerMetadata(
    sticker: Sticker,
    guild: ContextGuild | undefined,
    context: ExpressionContext,
): Metadata[] {
    const items: Metadata[] = [
        { kind: 'name', value: sticker.name.trim().toLowerCase() },
    ]
    for (const tag of (sticker.tags ?? '').split(',')) {
        const value = tag.trim().toLowerCase()
        if (!value) continue
        items.push({ kind: 'tag', value })
        // The tag is the name of a unicode emoji; the emoji and its skin tone variants find the sticker too.
        const emoji = context.unicode?.byName.get(value)
        if (emoji) {
            items.push({ kind: 'emoji', value: emoji.surrogates })
            for (const child of Object.values(emoji.diversityChildren))
                items.push({ kind: 'emoji', value: child.surrogates })
        }
    }
    const guildName = guild?.name.trim().toLowerCase()
    if (guildName) items.push({ kind: 'guild', value: guildName })
    return items
}

function packStickerMetadata(
    sticker: Sticker,
    context: ExpressionContext,
): Metadata[] {
    const items: Metadata[] = [
        { kind: 'name', value: sticker.name.trim().toLowerCase() },
    ]
    const pack = sticker.pack_id && context.packNames?.[sticker.pack_id]
    if (pack) items.push({ kind: 'pack', value: pack })
    return items
}

export interface StickerSearchResult {
    sticker: Sticker
    /** The metadata value that matched best. */
    comparator: string
    score: number
    sendability: number
}

export interface StickerSearchOptions {
    /** `sendable` (default, what suggestions show), `unsendable`, or `all`. */
    show?: 'sendable' | 'unsendable' | 'all'
    /** Substring and prefix matches besides exact ones. Default true. */
    partial?: boolean
}

/**
 * Searches guild and pack stickers by name, tags, related emoji, guild name and pack name.
 * A value scores `multiplier * priority`.
 * Priorities: name 11, guild or pack 8, emoji 6, tag 1.
 * Multipliers: exact 10x, prefix 7x, substring 5x.
 * The best value wins, times `frecency / 100` for used stickers. Returns best first.
 */
export function searchStickers(
    query: string,
    context: ExpressionContext,
    options: StickerSearchOptions = {},
): StickerSearchResult[] {
    const lowered = stripDiacritics(query.toLocaleLowerCase())
    if (lowered === '') return []
    const exact = query.toLocaleLowerCase()
    const partial = options.partial ?? true
    const escaped = escapeRegex(lowered)
    const prefix = new RegExp(`^${escaped}`, 'i')
    const contains = new RegExp(escaped, 'i')
    const show = options.show ?? 'sendable'
    const packKnownIds = new Set(
        (context.standardStickers ?? []).map(sticker => sticker.id),
    )

    const candidates: Array<{ sticker: Sticker; metadata: Metadata[] }> = []
    const memberGuilds = new Set(context.guilds.map(guild => guild.id))
    for (const guild of context.guilds)
        for (const sticker of guild.stickers)
            candidates.push({
                sticker,
                metadata: guildStickerMetadata(sticker, guild, context),
            })
    for (const sticker of context.standardStickers ?? [])
        candidates.push({
            sticker,
            metadata: packStickerMetadata(sticker, context),
        })

    const results: StickerSearchResult[] = []
    const seen = new Set<string>()
    for (const { sticker, metadata } of candidates) {
        if (seen.has(sticker.id)) continue
        const sendability = getStickerSendability(sticker, context, {
            packKnown: packKnownIds.has(sticker.id),
            isMember: sticker.guild_id
                ? memberGuilds.has(sticker.guild_id)
                : true,
        })
        if (
            show !== 'all' &&
            (sendability === StickerSendability.SENDABLE) !==
                (show === 'sendable')
        )
            continue
        let best = 0
        let comparator = ''
        for (const { kind, value } of metadata) {
            const priority = PRIORITY[kind]
            let score = 0
            if (value === exact || value === lowered)
                score = EXACT_MULTIPLIER * priority
            else if (partial) {
                if (prefix.test(value)) score = PREFIX_MULTIPLIER * priority
                else if (SUBSTRING_KINDS.has(kind) && contains.test(value))
                    score = SUBSTRING_MULTIPLIER * priority
            }
            if (score > best) {
                best = score
                comparator = value
            }
        }
        const frecency = context.stickerScore?.(sticker.id) ?? null
        if (frecency !== null) best *= frecency / 100
        if (best > 0) {
            seen.add(sticker.id)
            results.push({ sticker, comparator, score: best, sendability })
        }
    }
    return results.sort((a, b) => b.score - a.score)
}

// Suggestions -------------------------------------------------------------

/**
 * Two-letter words that may suggest emojis (`EnglishEmojiSuggestionsConstants`).
 * Other words need three letters, and common words never suggest.
 */
export const SHORT_QUERY_ALLOWLIST: ReadonlySet<string> = new Set([
    'aw',
    'bi',
    'dr',
    'ew',
    'ez',
    'gg',
    'go',
    'ha',
    'hi',
    'hm',
    'no',
    'np',
    'oh',
    'ok',
    'or',
    'tm',
    'tv',
    'ty',
    'wp',
    'xd',
    'yo',
])
export const QUERY_DENYLIST: ReadonlySet<string> = new Set([
    'about',
    'all',
    'and',
    'any',
    'are',
    'been',
    'but',
    'can',
    'could',
    'for',
    'from',
    'get',
    'had',
    'has',
    'have',
    'her',
    'his',
    'how',
    'into',
    'its',
    'just',
    'new',
    'not',
    'now',
    'our',
    'see',
    'should',
    'some',
    'take',
    'than',
    'that',
    'the',
    'their',
    'them',
    'then',
    'there',
    'these',
    'they',
    'this',
    'those',
    'too',
    'very',
    'was',
    'were',
    'what',
    'when',
    'where',
    'which',
    'who',
    'will',
    'with',
    'would',
    'you',
    'your',
])

/** Characters the `:` autocomplete accepts in a name: 2 to this many (`EMOJI_MAX_LENGTH`). */
export const EMOJI_NAME_MAX_LENGTH = 32
export const EMOJI_NAME_MIN_LENGTH = 2
/** Emojis per `:` autocomplete when stickers are listed beside them / when they are not. */
export const COLON_EMOJI_COUNT_WITH_STICKERS = 10
export const COLON_EMOJI_COUNT = 50
/** `MAX_SUGGESTIONS_LARGE` of the reference's suggestion bar. */
export const MAX_BAR_SUGGESTIONS = 12

export interface EmojiSuggestions {
    /** `colon` is the `:name` autocomplete. `word` is the suggestion bar for a plain word. */
    kind: 'colon' | 'word'
    /** The text matched, without the colon. */
    query: string
    /** Range in the text to replace when a suggestion is picked (includes the colon for `colon`). */
    start: number
    end: number
    unlocked: SearchEmoji[]
    locked: SearchEmoji[]
    /** Sendable stickers; only for `colon`. */
    stickers: StickerSearchResult[]
}

export interface SuggestionOptions {
    /** Text right of the cursor, so a word is matched whole (the `word` kind). */
    textAfterCursor?: string
    /** Emojis returned. Default: the reference's counts for `colon`, `MAX_BAR_SUGGESTIONS` for `word`. */
    maxCount?: number
    /** `word` kind: fewer unlocked hits than this suggest nothing. Default 1. */
    minUnlockedEmojis?: number
    /** Include stickers for `colon`. Default true. */
    includeStickers?: boolean
}

/** Non-word characters trimmed off both ends of a word before it is a query (everything but letters, digits, `_` and `-`). */
const EDGE_START = /^[^\p{L}\p{N}\p{M}_-]+/u
const EDGE_END = /[^\p{L}\p{N}\p{M}_-]+$/u
/** What is dropped from the query itself. */
const NOT_QUERY = /[^\p{L}\p{N}\p{M}_]/gu
const CAMEL = /([a-z0-9])(?=[A-Z])/g

/** The group order of the reference's `sortSuggestedEmojis`: current guild, other guilds, unicode. */
function groupEmojis(
    emojis: SearchEmoji[],
    guildId: string | null | undefined,
): SearchEmoji[] {
    const current: SearchEmoji[] = []
    const other: SearchEmoji[] = []
    const unicode: SearchEmoji[] = []
    for (const emoji of emojis) {
        if (emoji.type === 'custom') {
            if (guildId && emoji.guildId === guildId) current.push(emoji)
            else other.push(emoji)
        } else unicode.push(emoji)
    }
    return [...current, ...other, ...unicode]
}

/** The `:name` being typed at the end of the text, as the reference's autocomplete sees it. */
export function colonQueryAt(
    textBeforeCursor: string,
): { query: string; start: number } | null {
    const match = /(?:^|\s):([^\s:]*)$/.exec(textBeforeCursor)
    if (!match) return null
    const query = match[1] as string
    if (
        query.length < EMOJI_NAME_MIN_LENGTH ||
        query.length > EMOJI_NAME_MAX_LENGTH
    )
        return null
    return { query, start: textBeforeCursor.length - query.length - 1 }
}

/** The word under the cursor, trimmed of surrounding punctuation, for the suggestion bar. */
export function wordQueryAt(
    textBeforeCursor: string,
    textAfterCursor = '',
): { query: string; start: number; end: number } | null {
    const left = /\S+$/.exec(textBeforeCursor)?.[0] ?? ''
    const right = /^\S+/.exec(textAfterCursor)?.[0] ?? ''
    let word = left + right
    let start = textBeforeCursor.length - left.length
    let end = textBeforeCursor.length + right.length
    if (word === '') {
        // Just after a word and a space: that word is still the one suggested for.
        const previous = /(\S+)\s$/.exec(textBeforeCursor)
        if (!previous) return null
        word = previous[1] as string
        start = previous.index
        end = start + word.length
    }
    const lead = EDGE_START.exec(word)?.[0].length ?? 0
    const trail = EDGE_END.exec(word)?.[0].length ?? 0
    if (word.length - lead - trail > 0) {
        start += lead
        end -= trail
        word = word.slice(lead, word.length - trail)
    }
    return { query: word, start, end }
}

/**
 * Returns what to suggest for the text before the cursor, or null when nothing applies.
 * The caller gates the `word` kind on the "expression suggestions" setting.
 *
 * - `colon`: `:` plus 2 to 32 characters, at the start or after whitespace.
 *   Emojis match by substring, capped at 10 with stickers and 50 without.
 *   Stickers come from `searchStickers`.
 * - `word` (`useEmojiSuggestions`): the lowercased, punctuation-free word being typed.
 *   Skipped for `QUERY_DENYLIST` words, and for under 3 letters unless in `SHORT_QUERY_ALLOWLIST`.
 *   A name part (split on `_`, case changes, spaces) must start with the word.
 *   Groups are current guild, other guilds, unicode. Capped at 12.
 */
export function emojiSuggestionsFor(
    textBeforeCursor: string,
    context: ExpressionContext,
    options: SuggestionOptions = {},
): EmojiSuggestions | null {
    const guildId = context.guildId ?? context.channel?.guildId
    const colon = colonQueryAt(textBeforeCursor)
    if (colon) {
        const includeStickers = options.includeStickers ?? true
        const { unlocked, locked } = searchEmojis(colon.query, context, {
            count:
                options.maxCount ??
                (includeStickers
                    ? COLON_EMOJI_COUNT_WITH_STICKERS
                    : COLON_EMOJI_COUNT),
        })
        return {
            kind: 'colon',
            query: colon.query,
            start: colon.start,
            end: textBeforeCursor.length,
            unlocked,
            locked,
            stickers: includeStickers
                ? searchStickers(colon.query, context)
                : [],
        }
    }

    const span = wordQueryAt(textBeforeCursor, options.textAfterCursor)
    if (!span) return null
    const query = span.query.toLowerCase().replace(NOT_QUERY, '')
    if (QUERY_DENYLIST.has(query)) return null
    if (!SHORT_QUERY_ALLOWLIST.has(query) && query.length < 3) return null
    const { unlocked, locked } = searchEmojis(query, context, {
        intention: EmojiIntention.CHAT,
        matchComparator: name =>
            name
                .replace(CAMEL, '$1_')
                .toLowerCase()
                .split(/[_\s]+/)
                .some(part => part.startsWith(query)),
    })
    const shown = groupEmojis(unlocked, guildId).slice(
        0,
        options.maxCount ?? MAX_BAR_SUGGESTIONS,
    )
    if (shown.length < (options.minUnlockedEmojis ?? 1)) return null
    return {
        kind: 'word',
        query,
        start: span.start,
        end: span.end,
        unlocked: shown,
        locked: groupEmojis(locked, guildId),
        stickers: [],
    }
}
