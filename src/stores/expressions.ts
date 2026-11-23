import { createStore } from 'zustand/vanilla'
import { defineStore } from '../core/session'
import { dataModeOf } from './guilds'
import type { GuildEmoji, Sticker } from '../core/discord/expressionTypes'
import type { RawGuild } from './guilds'

/**
 * Holds the custom emojis and stickers of the user's guilds.
 * Sources are READY, GUILD_CREATE (full or `partial_updates`), GUILD_EMOJIS_UPDATE and GUILD_STICKERS_UPDATE.
 * The app-facing API is `src/features/expressions`.
 *
 * Each list saves its newest item `version`, which the channels store folds into IDENTIFY `client_state`.
 * `0` means the server gave none. `null` means the list is held and empty, which constrains nothing.
 */

export interface GuildExpressions {
    emojis: GuildEmoji[]
    stickers: Sticker[]
    emojiVersion: number | null
    stickerVersion: number | null
}

declare module '../core/gateway/events' {
    interface GatewayEvents {
        GUILD_EMOJIS_UPDATE: { guild_id: string; emojis: GuildEmoji[] }
        GUILD_STICKERS_UPDATE: { guild_id: string; stickers: Sticker[] }
    }
}
declare module './guilds' {
    interface RawGuild {
        emojis?: GuildEmoji[]
        stickers?: Sticker[]
    }
    interface PartialUpdates {
        emojis?: GuildEmoji[]
        stickers?: Sticker[]
        deleted_emoji_ids?: string[]
        deleted_sticker_ids?: string[]
    }
}

interface ExpressionsState {
    guilds: Record<string, GuildExpressions>
    /** The current user's `premium_type`, which decides emoji and sticker availability. */
    premiumType: number
}

/** Newest item version; null for an empty list, 0 when the items carry none. */
const versionOf = (items: Array<{ version?: number }>): number | null =>
    items.length === 0
        ? null
        : items.reduce((max, item) => Math.max(max, item.version ?? 0), 0)

/** Version after replacing a list: only claimed on top of a version already held. */
const nextVersion = (
    previous: number | null | undefined,
    items: Array<{ version?: number }>,
): number | null => {
    if (previous === 0 || previous === undefined) return 0
    const newest = versionOf(items)
    return newest === null
        ? previous
        : newest === 0
          ? 0
          : Math.max(previous ?? 0, newest)
}

/** The cache part of `premiumType`. Guild parts are keyed by guild id. */
const USER_PART = '@me'

export const expressionsStore = defineStore(
    'expressions',
    session => {
        const store = createStore<ExpressionsState>(() => ({
            guilds: {},
            premiumType: 0,
        }))
        const { dispatch } = session.gateway

        const withGuildId = (stickers: Sticker[], guildId: string) =>
            stickers.map(sticker => ({ ...sticker, guild_id: guildId }))

        const merge = <T extends { id: string }>(
            held: T[],
            changes: T[] | undefined,
            deleted: string[] | undefined,
        ): T[] => {
            const gone = new Set(deleted)
            const byId = new Map(
                held.filter(item => !gone.has(item.id)).map(i => [i.id, i]),
            )
            for (const item of changes ?? []) byId.set(item.id, item)
            return [...byId.values()]
        }

        /** The guild's expressions after READY / GUILD_CREATE, `previous` when the payload carries none. */
        const apply = (
            raw: RawGuild,
            previous: GuildExpressions | undefined,
        ): GuildExpressions | undefined => {
            const mode = dataModeOf(raw)
            if (mode === 'unavailable') return previous
            if (mode === 'partial') {
                // Partial data only makes sense on top of what it was cut against.
                if (!previous) return undefined
                const changes = raw.partial_updates
                const emojis = merge(
                    previous.emojis,
                    changes?.emojis,
                    changes?.deleted_emoji_ids,
                )
                const stickers = merge(
                    previous.stickers,
                    raw.partial_updates?.stickers
                        ? withGuildId(raw.partial_updates.stickers, raw.id)
                        : undefined,
                    changes?.deleted_sticker_ids,
                )
                return {
                    emojis,
                    stickers,
                    emojiVersion: nextVersion(previous.emojiVersion, emojis),
                    stickerVersion: nextVersion(
                        previous.stickerVersion,
                        stickers,
                    ),
                }
            }
            // Full: what the payload carries replaces, what it lacks keeps its data but loses its version.
            const emojis = raw.emojis ?? previous?.emojis ?? []
            const stickers = raw.stickers
                ? withGuildId(raw.stickers, raw.id)
                : (previous?.stickers ?? [])
            return {
                emojis,
                stickers,
                emojiVersion: raw.emojis ? versionOf(raw.emojis) : 0,
                stickerVersion: raw.stickers ? versionOf(raw.stickers) : 0,
            }
        }

        dispatch.on('READY', ready => {
            const previous = store.getState().guilds
            const guilds: Record<string, GuildExpressions> = {}
            for (const raw of ready.guilds ?? []) {
                const held = apply(raw, previous[raw.id])
                if (held) guilds[raw.id] = held
            }
            const premiumType = ready.user.premium_type
            store.setState({
                guilds,
                ...(typeof premiumType === 'number' ? { premiumType } : {}),
            })
        })
        dispatch.on('GUILD_CREATE', raw => {
            const held = apply(raw, store.getState().guilds[raw.id])
            if (held)
                store.setState(state => ({
                    guilds: { ...state.guilds, [raw.id]: held },
                }))
        })
        dispatch.on('GUILD_DELETE', ({ id }) =>
            store.setState(state => {
                const { [id]: _removed, ...guilds } = state.guilds
                return { guilds }
            }),
        )
        dispatch.on('USER_UPDATE', user => {
            const premiumType = (user as { premium_type?: number }).premium_type
            if (user.id === session.userId && typeof premiumType === 'number')
                store.setState({ premiumType })
        })

        // An update carries the whole list, so a deletion shows only as a missing item.
        dispatch.on('GUILD_EMOJIS_UPDATE', ({ guild_id, emojis }) =>
            store.setState(state => {
                const held = state.guilds[guild_id]
                return {
                    guilds: {
                        ...state.guilds,
                        [guild_id]: {
                            emojis,
                            stickers: held?.stickers ?? [],
                            emojiVersion: nextVersion(
                                held?.emojiVersion,
                                emojis,
                            ),
                            stickerVersion: held?.stickerVersion ?? 0,
                        },
                    },
                }
            }),
        )
        dispatch.on('GUILD_STICKERS_UPDATE', ({ guild_id, stickers }) =>
            store.setState(state => {
                const held = state.guilds[guild_id]
                const list = withGuildId(stickers, guild_id)
                return {
                    guilds: {
                        ...state.guilds,
                        [guild_id]: {
                            emojis: held?.emojis ?? [],
                            stickers: list,
                            emojiVersion: held?.emojiVersion ?? 0,
                            stickerVersion: nextVersion(
                                held?.stickerVersion,
                                list,
                            ),
                        },
                    },
                }
            }),
        )
        // The answer to requestDeletedIds: whatever is not listed is gone.
        dispatch.on(
            'DELETED_ENTITY_IDS',
            ({ guild_id, emojis: keepEmojis, stickers: keepStickers }) =>
                store.setState(state => {
                    const held = state.guilds[guild_id]
                    if (!held || (!keepEmojis && !keepStickers)) return state
                    const emojiIds = new Set(keepEmojis)
                    const stickerIds = new Set(keepStickers)
                    return {
                        guilds: {
                            ...state.guilds,
                            [guild_id]: {
                                ...held,
                                emojis: keepEmojis
                                    ? held.emojis.filter(e =>
                                          emojiIds.has(e.id),
                                      )
                                    : held.emojis,
                                stickers: keepStickers
                                    ? held.stickers.filter(s =>
                                          stickerIds.has(s.id),
                                      )
                                    : held.stickers,
                            },
                        },
                    }
                }),
        )

        return store
    },
    {
        cache: ['guilds', 'premiumType'],
        // One entry per guild, so an emoji change rewrites only its guild.
        cacheParts: {
            split: ({ guilds = {}, premiumType = 0 }) => ({
                ...guilds,
                [USER_PART]: { premiumType },
            }),
            join: ({ [USER_PART]: user, ...guilds }) => ({
                guilds: guilds as Record<string, GuildExpressions>,
                ...(user as Pick<ExpressionsState, 'premiumType'> | undefined),
            }),
        },
        // 1: saved per guild.
        cacheVersion: 1,
        deferRestore: true,
    },
)

/** Returns the newest version of a guild's emojis and stickers, 0 when they carry none, undefined when not held. */
export function expressionsVersion(
    state: ExpressionsState,
    guildId: string,
): number | undefined {
    const held = state.guilds[guildId]
    if (!held) return undefined
    return Math.max(held.emojiVersion ?? 0, held.stickerVersion ?? 0)
}
