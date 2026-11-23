import { createStore } from 'zustand/vanilla'
import { Endpoint } from '../core/api/paths'
import { defineStore } from '../core/session'
import type { StickerPack } from '../core/discord/expressionTypes'
import type { Session } from '../core/session'

/**
 * The standard sticker packs (`GET /sticker-packs`), fetched lazily by `ensureStickerPacks` and
 * kept for an hour like the reference (`StickersPackStore.hasLoadedStickerPacks`), also on disk so
 * the picker has them at the next launch.
 */

const MAX_AGE_MS = 60 * 60 * 1000

interface StickerPacksState {
    packs: StickerPack[]
    /** When the packs were fetched, ms; 0 for never. */
    fetchedAt: number
}

export const stickerPacksStore = defineStore(
    'stickerPacks',
    () => createStore<StickerPacksState>(() => ({ packs: [], fetchedAt: 0 })),
    { cache: ['packs', 'fetchedAt'], deferRestore: true },
)

const fetches = new WeakMap<Session, Promise<StickerPack[]>>()

/** The packs, fetching them first when none are held or they are older than an hour. Never fetches twice at once. */
export function ensureStickerPacks(session: Session): Promise<StickerPack[]> {
    const store = session.get(stickerPacksStore)
    const { packs, fetchedAt } = store.getState()
    if (fetchedAt > 0 && Date.now() - fetchedAt < MAX_AGE_MS)
        return Promise.resolve(packs)
    let fetch = fetches.get(session)
    if (!fetch) {
        fetch = session.rest
            .get<{ sticker_packs: StickerPack[] }>(Endpoint.stickerPacks)
            .then(({ sticker_packs }) => {
                store.setState({
                    packs: sticker_packs,
                    fetchedAt: Date.now(),
                })
                return sticker_packs
            })
            .finally(() => fetches.delete(session))
        fetches.set(session, fetch)
    }
    return fetch
}
