import { strFromU8, strToU8 } from 'fflate'
import {
    concatBytes,
    int32ToVarint,
    readFields,
    readFixed64s,
    readVarints,
    varintToInt32,
    writeBytesField,
    writeFixed64Field,
    writeFixed64s,
    writePackedVarints,
    writeVarintField,
} from './protobuf'
import { DAY } from './time'

/**
 * Frecency (use count weighted by recency) and the FrecencyUserSettings protobuf (settings-proto type 2).
 * Follows the reference's `Frecency`, `StickersPersistedStore`, `EmojiStore` and
 * `UserSettingsUtils.serializeUsageHistory`.
 *
 *   FrecencyUserSettings { favorite_gifs = 2 { map<string, FavoriteGIF> gifs = 1 }
 *     favorite_stickers = 3 { repeated fixed64 sticker_ids = 1 }
 *     sticker_frecency = 4 { map<fixed64, FrecencyItem> stickers = 1 }
 *     favorite_emojis = 5 { repeated string emojis = 1 }
 *     emoji_frecency = 6 { map<string, FrecencyItem> emojis = 1 }
 *     emoji_reaction_frecency = 13 { map<string, FrecencyItem> emojis = 1 } }
 *   FavoriteGIFs { map<string, FavoriteGIF> gifs = 1; bool hide_tooltip = 2 }
 *   FavoriteGIF { GIFType format = 1; string src = 2; uint32 width = 3; uint32 height = 4; uint32 order = 5 }
 *   FrecencyItem { uint32 total_uses = 1; repeated uint64 recent_uses = 2 (ms); int32 frecency = 3; int32 score = 4 }
 */

export interface FrecencyEntry {
    totalUses: number
    /** Use timestamps in ms, oldest first, at most `MAX_SAMPLES`. */
    recentUses: number[]
    /** -1 until computed. */
    frecency: number
    score: number
}
export type UsageHistory = Record<string, FrecencyEntry>

export interface PendingUsage {
    key: string
    timestamp: number
}

/** Recent uses kept per item. */
const MAX_SAMPLES = 10
/** Items sent to the server per history (`FREQUENCY_ITEM_LIMIT`). */
const SERIALIZED_ITEM_LIMIT = 100
/** How many items the picker's "frequently used" section shows. */
export const FREQUENT_EMOJI_COUNT = 42
export const FREQUENT_STICKER_COUNT = 20

/** What a use is worth by its age in whole days. */
function weight(days: number): number {
    if (days <= 3) return 100
    if (days <= 15) return 70
    if (days <= 30) return 50
    if (days <= 45) return 30
    return days <= 80 ? 10 : 1
}

const emptyEntry = (): FrecencyEntry => ({
    totalUses: 0,
    recentUses: [],
    frecency: -1,
    score: 0,
})

/** Adds one use. Returns a new history (the input is not changed). */
export function trackUse(
    history: UsageHistory,
    key: string,
    timestamp: number,
): UsageHistory {
    const entry = history[key] ?? emptyEntry()
    const recentUses = [...entry.recentUses, timestamp]
        .sort((a, b) => a - b)
        .slice(-MAX_SAMPLES)
    return {
        ...history,
        [key]: {
            totalUses: entry.totalUses + 1,
            recentUses,
            frecency: -1,
            score: 0,
        },
    }
}

/** The score of one entry: every recent use, weighted by age. */
function scoreOf(entry: FrecencyEntry, now: number): number {
    let score = 0
    for (const use of entry.recentUses.slice(-MAX_SAMPLES))
        score += weight(Math.max(0, Math.floor((now - use) / DAY)))
    return score
}

/**
 * Fills `score` and `frecency` of every entry that needs it, dropping those without a positive
 * score. Emoji frecency weighs the use count against the most used item
 * (`trunc(1000 * (uses / maxUses * 0.2 + score / 1000 * 0.8))`); stickers use the reference's
 * default (`ceil(totalUses * score / recentUses)`).
 */
export function computeHistory(
    history: UsageHistory,
    now: number,
    kind: 'emoji' | 'sticker',
): UsageHistory {
    const out: UsageHistory = {}
    let maxUses = 0
    for (const entry of Object.values(history))
        maxUses = Math.max(maxUses, entry.totalUses)
    for (const [key, entry] of Object.entries(history)) {
        const score = scoreOf(entry, now)
        if (score <= 0 || entry.recentUses.length === 0) continue
        const frecency =
            kind === 'emoji'
                ? maxUses > 0
                    ? Math.trunc(
                          1000 *
                              ((entry.totalUses / maxUses) * 0.2 +
                                  (score / 1000) * 0.8),
                      )
                    : 0
                : Math.ceil(entry.totalUses * (score / entry.recentUses.length))
        out[key] = { ...entry, score, frecency }
    }
    return out
}

/** Keys by frecency, best first. */
export const rankedKeys = (history: UsageHistory): string[] =>
    Object.entries(history)
        .sort((a, b) => b[1].frecency - a[1].frecency)
        .map(([key]) => key)

/** Applies usages not yet saved on top of a history loaded from the server. */
export function withPending(
    history: UsageHistory,
    pending: readonly PendingUsage[],
): UsageHistory {
    let result = history
    for (const usage of pending)
        result = trackUse(result, usage.key, usage.timestamp)
    return result
}

/** Decoded FrecencyUserSettings: what the expression picker needs of it. */
export interface DecodedFrecency {
    emojis?: UsageHistory
    emojiReactions?: UsageHistory
    stickers?: UsageHistory
    favoriteEmojis?: string[]
    favoriteStickers?: string[]
    favoriteGifs?: FavoriteGif[]
    /** FavoriteGIFs.hide_tooltip, written back with the favorite GIFs. */
    gifTooltipHidden?: boolean
}

/** GIFType of a FavoriteGIF: a still or animated image, or a video. */
export const GifFormat = { NONE: 0, IMAGE: 1, VIDEO: 2 } as const
export type GifFormatValue = (typeof GifFormat)[keyof typeof GifFormat]

/** The most FavoriteGIFs may take, encoded (UserSettingsConstants.MAX_FAVORITE_GIFS_SIZE). */
export const MAX_FAVORITE_GIFS_SIZE = 762_880

/** A favorited GIF: the link sent (the map key), the media shown, its size and when it was added (`order`). */
export interface FavoriteGif {
    url: string
    src: string
    format: number
    width: number
    height: number
    order: number
}

function decodeFavoriteGifs(
    bytes: Uint8Array,
): Pick<DecodedFrecency, 'favoriteGifs' | 'gifTooltipHidden'> {
    const gifs: FavoriteGif[] = []
    let hidden = false
    for (const [number, entry] of readFields(bytes)) {
        if (number === 2 && typeof entry === 'bigint') hidden = entry !== 0n
        if (number !== 1 || !(entry instanceof Uint8Array)) continue
        const gif: FavoriteGif = {
            url: '',
            src: '',
            format: 0,
            width: 0,
            height: 0,
            order: 0,
        }
        for (const [field, raw] of readFields(entry)) {
            if (field === 1 && raw instanceof Uint8Array)
                gif.url = strFromU8(raw)
            else if (field === 2 && raw instanceof Uint8Array) {
                for (const [n, value] of readFields(raw)) {
                    if (n === 2 && value instanceof Uint8Array)
                        gif.src = strFromU8(value)
                    else if (typeof value !== 'bigint') continue
                    else if (n === 1) gif.format = Number(value)
                    else if (n === 3) gif.width = Number(value)
                    else if (n === 4) gif.height = Number(value)
                    else if (n === 5) gif.order = Number(value)
                }
            }
        }
        if (gif.url) gifs.push(gif)
    }
    return { favoriteGifs: gifs, gifTooltipHidden: hidden }
}

/** Writes a FavoriteGIFs message, each GIF keyed by its link. */
export function encodeFavoriteGifs(
    gifs: FavoriteGif[],
    tooltipHidden: boolean,
): Uint8Array {
    return concatBytes([
        ...gifs.map(gif =>
            writeBytesField(
                1,
                concatBytes([
                    writeBytesField(1, strToU8(gif.url)),
                    writeBytesField(
                        2,
                        concatBytes([
                            writeVarintField(1, BigInt(gif.format)),
                            writeBytesField(2, strToU8(gif.src)),
                            writeVarintField(3, BigInt(gif.width)),
                            writeVarintField(4, BigInt(gif.height)),
                            writeVarintField(5, BigInt(gif.order)),
                        ]),
                    ),
                ]),
            ),
        ),
        writeVarintField(2, tooltipHidden ? 1n : 0n),
    ])
}

function decodeItem(bytes: Uint8Array): FrecencyEntry {
    const entry = emptyEntry()
    for (const [number, value] of readFields(bytes)) {
        if (number === 1 && typeof value === 'bigint')
            entry.totalUses = Number(value)
        else if (number === 2) {
            // Packed, as proto3 writes it; a lone unpacked varint is accepted too.
            if (value instanceof Uint8Array)
                entry.recentUses.push(...readVarints(value).map(Number))
            else entry.recentUses.push(Number(value))
        } else if (number === 4 && typeof value === 'bigint')
            entry.score = varintToInt32(value)
    }
    // Recomputed on use, like the reference's overwriteHistory.
    entry.frecency = -1
    entry.recentUses = entry.recentUses.filter(use => use > 0)
    return entry
}

function decodeMap(bytes: Uint8Array, fixedKey: boolean): UsageHistory {
    const history: UsageHistory = {}
    for (const [number, value] of readFields(bytes)) {
        if (number !== 1 || !(value instanceof Uint8Array)) continue
        let key: string | undefined
        let item: FrecencyEntry | undefined
        for (const [field, raw] of readFields(value)) {
            if (field === 1 && raw instanceof Uint8Array)
                key = fixedKey ? readFixed64s(raw)[0] : strFromU8(raw)
            else if (field === 2 && raw instanceof Uint8Array)
                item = decodeItem(raw)
        }
        if (key !== undefined) history[key] = item ?? emptyEntry()
    }
    return history
}

/** Reads a FrecencyUserSettings message (from `GET /users/@me/settings-proto/2` or a settings update). */
export function decodeFrecency(bytes: Uint8Array): DecodedFrecency {
    const out: DecodedFrecency = {}
    for (const [number, value] of readFields(bytes)) {
        if (!(value instanceof Uint8Array)) continue
        if (number === 2) Object.assign(out, decodeFavoriteGifs(value))
        else if (number === 3) {
            out.favoriteStickers = readFields(value).flatMap(([n, raw]) =>
                n === 1 && raw instanceof Uint8Array ? readFixed64s(raw) : [],
            )
        } else if (number === 4) out.stickers = decodeMap(value, true)
        else if (number === 5) {
            out.favoriteEmojis = readFields(value).flatMap(([n, raw]) =>
                n === 1 && raw instanceof Uint8Array ? [strFromU8(raw)] : [],
            )
        } else if (number === 6) out.emojis = decodeMap(value, false)
        else if (number === 13) out.emojiReactions = decodeMap(value, false)
    }
    return out
}

function encodeItem(entry: FrecencyEntry): Uint8Array {
    return concatBytes([
        writeVarintField(1, BigInt(entry.totalUses)),
        writeBytesField(
            2,
            writePackedVarints(
                entry.recentUses.filter(use => use > 0).map(BigInt),
            ),
        ),
        writeVarintField(3, int32ToVarint(entry.frecency)),
        writeVarintField(4, int32ToVarint(Math.round(entry.score))),
    ])
}

/** The most recently used `limit` entries, as the reference trims before saving. */
function newest(history: UsageHistory, limit: number) {
    const last = (entry: FrecencyEntry) => entry.recentUses.at(-1) ?? 0
    return Object.entries(history)
        .sort((a, b) => last(b[1]) - last(a[1]))
        .slice(0, limit)
}

function encodeMap(
    number: number,
    history: UsageHistory,
    fixedKey: boolean,
): Uint8Array {
    const entries = newest(history, SERIALIZED_ITEM_LIMIT).map(([key, entry]) =>
        writeBytesField(
            1,
            concatBytes([
                fixedKey
                    ? writeFixed64Field(1, key)
                    : writeBytesField(1, strToU8(key)),
                writeBytesField(2, encodeItem(entry)),
            ]),
        ),
    )
    return writeBytesField(number, concatBytes(entries))
}

/**
 * The fields to PATCH: only what is given, since the server replaces each present message as a
 * whole (so an absent one is left alone). Histories must be computed (`computeHistory`).
 */
export function encodeFrecency(changes: DecodedFrecency): Uint8Array {
    const parts: Uint8Array[] = []
    if (changes.stickers) parts.push(encodeMap(4, changes.stickers, true))
    if (changes.emojis) parts.push(encodeMap(6, changes.emojis, false))
    if (changes.emojiReactions)
        parts.push(encodeMap(13, changes.emojiReactions, false))
    if (changes.favoriteGifs)
        parts.push(
            writeBytesField(
                2,
                encodeFavoriteGifs(
                    changes.favoriteGifs,
                    changes.gifTooltipHidden ?? false,
                ),
            ),
        )
    if (changes.favoriteStickers)
        parts.push(
            writeBytesField(
                3,
                writeBytesField(1, writeFixed64s(changes.favoriteStickers)),
            ),
        )
    if (changes.favoriteEmojis)
        parts.push(
            writeBytesField(
                5,
                concatBytes(
                    changes.favoriteEmojis.map(name =>
                        writeBytesField(1, strToU8(name)),
                    ),
                ),
            ),
        )
    return concatBytes(parts)
}
