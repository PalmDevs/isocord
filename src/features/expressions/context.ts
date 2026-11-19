import { Permission } from '../../core/discord/permissions'
import { computeHistory } from '../../core/frecency'
import { channelsStore } from '../../stores/channels/channels'
import { expressionsStore } from '../../stores/expressions'
import { frecencyStore, loadFrecency } from '../../stores/frecency'
import { guildsStore } from '../../stores/guilds'
import { can } from '../../stores/permissions'
import { settingsStore } from '../../stores/settings/settingsStore'
import {
    ensureStickerPacks,
    stickerPacksStore,
} from '../../stores/stickerPacks'
import { getUnicodeEmojis, loadUnicodeEmojis } from './data/unicode'
import type { Session } from '../../core/session'
import type { UsageContext } from './data/availability'
import type { ExpressionContext } from './data/search'

/** Everything search, suggestions and availability need, for the channel being typed in (or none). */
export function getExpressionContext(
    session: Session,
    channelId?: string | null,
): ExpressionContext {
    const guilds = session.get(guildsStore).getState().guilds
    const channels = session.get(channelsStore).getState().channels
    const expressions = session.get(expressionsStore).getState()
    const settings = session.get(settingsStore).getState()
    const packs = session.get(stickerPacksStore).getState().packs
    const frecency = session.get(frecencyStore).getState()

    const channel = channelId ? channels[channelId] : undefined
    const guildId = channel?.guild_id ?? null
    let usage: UsageContext['channel'] = null
    if (channel) {
        usage = {
            guildId,
            canUseExternalEmojis: can(
                session,
                channel.id,
                Permission.USE_EXTERNAL_EMOJIS,
            ),
            canUseExternalStickers: can(
                session,
                channel.id,
                Permission.USE_EXTERNAL_STICKERS,
            ),
        }
    }

    // The server list's order: folders first as arranged, then guilds not in one.
    const order = settings.folders.flatMap(folder => folder.guildIds)
    const ordered = [
        ...order.filter(id => expressions.guilds[id]),
        ...Object.keys(expressions.guilds).filter(id => !order.includes(id)),
    ]
    const now = Date.now()
    const emojiScores = computeHistory(frecency.emojis, now, 'emoji')
    const stickerScores = computeHistory(frecency.stickers, now, 'sticker')

    return {
        premiumType: expressions.premiumType,
        guildId,
        channel: usage,
        guilds: ordered.flatMap(id => {
            const held = expressions.guilds[id]
            return held
                ? [
                      {
                          id,
                          name: guilds[id]?.name ?? '',
                          emojis: held.emojis,
                          stickers: held.stickers,
                          memberRoleIds: guilds[id]?.myRoles ?? [],
                      },
                  ]
                : []
        }),
        unicode: getUnicodeEmojis(),
        standardStickers: packs.flatMap(pack => pack.stickers),
        packNames: Object.fromEntries(packs.map(pack => [pack.id, pack.name])),
        emojiScore: key => emojiScores[key]?.score ?? null,
        stickerScore: id => stickerScores[id]?.score ?? null,
        skinTone: settings.textAndImages.diversitySurrogate || null,
    }
}

/** Loads the unicode data, sticker packs and frecency; failures of the requests are ignored (the data just stays absent). */
export async function ensureExpressionData(session: Session): Promise<void> {
    await Promise.allSettled([
        loadUnicodeEmojis(),
        ensureStickerPacks(session),
        loadFrecency(session),
    ])
}
