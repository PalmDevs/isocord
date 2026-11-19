import { Endpoint } from '../../../core/api/paths'
import { logger } from '../../../core/log'
import { expressionsStore } from '../../../stores/expressions'
import { stickerPacksStore } from '../../../stores/stickerPacks'
import { openStickerInfo } from '../../expressions/picker/stickerInfoSheet'
import { stickerIdOf } from '../media'
import type { Sticker } from '../../../core/discord/expressionTypes'
import type { Session } from '../../../core/session'

const log = logger('ChatLinks')

/** A sticker of the user's servers or of the standard packs, by id. */
function knownSticker(session: Session, id: string): Sticker | undefined {
    for (const guild of Object.values(
        session.get(expressionsStore).getState().guilds,
    )) {
        const sticker = guild.stickers.find(item => item.id === id)
        if (sticker) return sticker
    }
    for (const pack of session.get(stickerPacksStore).getState().packs) {
        const sticker = pack.stickers.find(item => item.id === id)
        if (sticker) return sticker
    }
    return undefined
}

/**
 * handleOpenSticker: a tapped sticker in a message opens its details sheet (showStickerDetailActionSheet). A sticker
 * from elsewhere is fetched first (GET /stickers/:id, read-only), as the sheet needs its pack or server.
 */
export async function openMessageSticker(
    session: Session,
    url: string,
): Promise<void> {
    const id = stickerIdOf(url)
    if (!id) return
    const known = knownSticker(session, id)
    if (known) {
        openStickerInfo(known)
        return
    }
    try {
        openStickerInfo(await session.rest.get<Sticker>(Endpoint.sticker(id)))
    } catch (error) {
        log.warn(`Sticker ${id} failed to load`, error)
    }
}
