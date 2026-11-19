import { createStore } from 'zustand/vanilla'
import { Endpoint } from '../core/api/paths'
import {
    computeHistory,
    decodeFrecency,
    encodeFavoriteGifs,
    encodeFrecency,
    MAX_FAVORITE_GIFS_SIZE,
    trackUse,
    withPending,
} from '../core/frecency'
import { logger } from '../core/log'
import { base64ToBytes, bytesToBase64 } from '../core/protobuf'
import { defineStore } from '../core/session'
import type { FavoriteGif, PendingUsage, UsageHistory } from '../core/frecency'
import type { Session } from '../core/session'

const log = logger('Frecency')

/**
 * Emoji and sticker frecency, and emoji, sticker and GIF favorites: FrecencyUserSettings, settings-proto type 2. Loaded
 * lazily (`loadFrecency`, the reference's `FrecencyUserSettingsActionCreators.loadIfNecessary`),
 * usage is recorded locally at once and saved later (see `flushFrecency` and the expressions
 * feature's timers). The app-facing API is `src/features/expressions`.
 */

const FRECENCY_SETTINGS = 2

/** The reference's starting history for a user without any, kept local (never saved). */
const DEFAULT_EMOJIS = [
    'thumbsup',
    'eyes',
    'laughing',
    'watermelon',
    'fork_and_knife',
    'yum',
    'weary',
    'tired_face',
    'poop',
    '100',
]
const DEFAULT_REACTIONS = [
    '100',
    '100',
    'thumbsup',
    'thumbsup',
    'thumbsdown',
    'thumbsdown',
    'heart',
    'point_up',
    'eyes',
    'weary',
    'laughing',
    'white_check_mark',
    'x',
]

export type HistoryKind = 'emojis' | 'emojiReactions' | 'stickers'

export interface FrecencyState {
    emojis: UsageHistory
    emojiReactions: UsageHistory
    stickers: UsageHistory
    favoriteEmojis: string[]
    favoriteStickers: string[]
    /** Changed only through `updateFavoriteGifs`, which saves them at once. */
    favoriteGifs: FavoriteGif[]
    /** FavoriteGIFs.hide_tooltip as loaded, written back with the favorites. Not cached. */
    gifTooltipHidden: boolean
    /** Uses not yet saved to the server, replayed onto what a load returns. */
    pending: Record<HistoryKind, PendingUsage[]>
    /** The server's settings were read this launch; nothing is saved before that, so nothing is overwritten. */
    loaded: boolean
}

const emptyPending = (): FrecencyState['pending'] => ({
    emojis: [],
    emojiReactions: [],
    stickers: [],
})

export const frecencyStore = defineStore(
    'frecency',
    () =>
        createStore<FrecencyState>(() => ({
            emojis: {},
            emojiReactions: {},
            stickers: {},
            favoriteEmojis: [],
            favoriteStickers: [],
            favoriteGifs: [],
            gifTooltipHidden: false,
            pending: emptyPending(),
            loaded: false,
        })),
    {
        cache: [
            'emojis',
            'emojiReactions',
            'stickers',
            'favoriteEmojis',
            'favoriteStickers',
            'favoriteGifs',
            'pending',
        ],
        // favoriteGifs was added.
        cacheVersion: 1,
    },
)

const loads = new WeakMap<Session, Promise<void>>()

/** Reads the frecency settings once per session; later calls share the result. Rejects when the request fails (a later call retries). */
export function loadFrecency(session: Session): Promise<void> {
    const store = session.get(frecencyStore)
    if (store.getState().loaded) return Promise.resolve()
    let load = loads.get(session)
    if (!load) {
        load = session.rest
            .get<{ settings: string }>(
                Endpoint.settingsProto(FRECENCY_SETTINGS),
            )
            .then(({ settings }) => {
                const server = decodeFrecency(base64ToBytes(settings))
                store.setState(state => {
                    const emojis = withPending(
                        server.emojis ?? {},
                        state.pending.emojis,
                    )
                    const emojiReactions = withPending(
                        server.emojiReactions ?? {},
                        state.pending.emojiReactions,
                    )
                    const stickers = withPending(
                        server.stickers ?? {},
                        state.pending.stickers,
                    )
                    return {
                        emojis: seed(
                            emojis,
                            DEFAULT_EMOJIS,
                            state.pending.emojis,
                        ),
                        emojiReactions: seed(
                            emojiReactions,
                            DEFAULT_REACTIONS,
                            state.pending.emojiReactions,
                        ),
                        stickers,
                        favoriteEmojis:
                            server.favoriteEmojis ?? state.favoriteEmojis,
                        favoriteStickers:
                            server.favoriteStickers ?? state.favoriteStickers,
                        favoriteGifs: server.favoriteGifs ?? state.favoriteGifs,
                        gifTooltipHidden: server.gifTooltipHidden ?? false,
                        loaded: true,
                    }
                })
            })
            .finally(() => loads.delete(session))
        loads.set(session, load)
    }
    return load
}

function seed(
    history: UsageHistory,
    defaults: string[],
    pending: PendingUsage[],
): UsageHistory {
    if (Object.keys(history).length > 0 || pending.length > 0) return history
    let result = history
    const now = Date.now()
    for (const key of defaults) result = trackUse(result, key, now)
    return result
}

/** Records a use locally; it is saved by `flushFrecency`. */
export function recordUsage(
    session: Session,
    kind: HistoryKind,
    key: string,
): void {
    const timestamp = Date.now()
    session.get(frecencyStore).setState(state => ({
        [kind]: trackUse(state[kind], key, timestamp),
        pending: {
            ...state.pending,
            [kind]: [...state.pending[kind], { key, timestamp }],
        },
    }))
}

const KINDS: HistoryKind[] = ['emojis', 'emojiReactions', 'stickers']

export const hasPendingUsage = (session: Session) => {
    const { pending } = session.get(frecencyStore).getState()
    return KINDS.some(kind => pending[kind].length > 0)
}

const saving = new WeakMap<Session, Promise<void>>()

/**
 * Saves the pending usage: loads the settings first if needed (so nothing is overwritten), then
 * PATCHes the changed histories (the most recent 100 each) to `/users/@me/settings-proto/2`.
 * Pending uses are only dropped once saved. Never throws.
 */
export function flushFrecency(session: Session): Promise<void> {
    const running = saving.get(session)
    if (running) return running
    if (!hasPendingUsage(session)) return Promise.resolve()
    const run = (async () => {
        const store = session.get(frecencyStore)
        await loadFrecency(session)
        const state = store.getState()
        const sent = Object.fromEntries(
            KINDS.map(kind => [kind, state.pending[kind].length]),
        ) as Record<HistoryKind, number>
        const now = Date.now()
        const changes: Parameters<typeof encodeFrecency>[0] = {}
        if (sent.emojis)
            changes.emojis = computeHistory(state.emojis, now, 'emoji')
        if (sent.emojiReactions)
            changes.emojiReactions = computeHistory(
                state.emojiReactions,
                now,
                'emoji',
            )
        if (sent.stickers)
            changes.stickers = computeHistory(state.stickers, now, 'sticker')
        await session.rest.patch(Endpoint.settingsProto(FRECENCY_SETTINGS), {
            body: { settings: bytesToBase64(encodeFrecency(changes)) },
        })
        store.setState(current => ({
            pending: Object.fromEntries(
                KINDS.map(kind => [
                    kind,
                    current.pending[kind].slice(sent[kind]),
                ]),
            ) as FrecencyState['pending'],
        }))
    })()
        .catch(error => log.warn('Saving failed', error))
        .finally(() => saving.delete(session))
    saving.set(session, run)
    return run
}

export type FavoriteGifsUpdate = (gifs: FavoriteGif[]) => {
    gifs: FavoriteGif[]
    hideTooltip?: boolean
}

/** How a favorite GIFs change ended: saved, refused for size, or failed to save. */
export type FavoriteGifsResult = 'saved' | 'full' | 'failed'

const favoriteSaves = new WeakMap<Session, Promise<FavoriteGifsResult>>()

/**
 * Changes the favorite GIFs and PATCHes them at once (FrecencyUserSettingsActionCreators.updateAsync on
 * favoriteGifs). Loads the settings first, so nothing is overwritten, and runs one change at a time.
 * Refuses a list over MAX_FAVORITE_GIFS_SIZE. The store changes once saved. Never throws.
 */
export function updateFavoriteGifs(
    session: Session,
    update: FavoriteGifsUpdate,
): Promise<FavoriteGifsResult> {
    const previous = favoriteSaves.get(session) ?? Promise.resolve('saved')
    const run = previous.then(async (): Promise<FavoriteGifsResult> => {
        const store = session.get(frecencyStore)
        try {
            await loadFrecency(session)
            const state = store.getState()
            const next = update(state.favoriteGifs)
            const hidden = state.gifTooltipHidden || !!next.hideTooltip
            if (
                encodeFavoriteGifs(next.gifs, hidden).length >
                MAX_FAVORITE_GIFS_SIZE
            )
                return 'full'
            await session.rest.patch(
                Endpoint.settingsProto(FRECENCY_SETTINGS),
                {
                    body: {
                        settings: bytesToBase64(
                            encodeFrecency({
                                favoriteGifs: next.gifs,
                                gifTooltipHidden: hidden,
                            }),
                        ),
                    },
                },
            )
            store.setState({
                favoriteGifs: next.gifs,
                gifTooltipHidden: hidden,
            })
            return 'saved'
        } catch (error) {
            log.warn('Saving favorite GIFs failed', error)
            return 'failed'
        }
    })
    favoriteSaves.set(session, run)
    return run
}
