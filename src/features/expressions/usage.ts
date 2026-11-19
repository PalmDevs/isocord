import {
    computeHistory,
    FREQUENT_EMOJI_COUNT,
    FREQUENT_STICKER_COUNT,
    rankedKeys,
} from '../../core/frecency'
import { frecencyStore, recordUsage } from '../../stores/frecency'
import { getEmojiUnavailableReason } from './data/availability'
import { listEmojis } from './data/search'
import type { Session } from '../../core/session'
import type { ExpressionContext, SearchEmoji } from './data/search'
import type { AnyEmoji, Sticker } from './data/types'

/** The key frecency and favorites use: the id of a custom emoji, the first name of a unicode one. */
const keyOf = (emoji: AnyEmoji | string) =>
    typeof emoji === 'string'
        ? emoji
        : emoji.type === 'custom'
          ? emoji.id
          : emoji.uniqueName

/** Records an emoji use (sent in a message, or `reaction` for a reaction); saved later. */
export function recordEmojiUsage(
    session: Session,
    emoji: AnyEmoji | string,
    options: { reaction?: boolean } = {},
): void {
    recordUsage(
        session,
        options.reaction ? 'emojiReactions' : 'emojis',
        keyOf(emoji),
    )
}

export function recordStickerUsage(
    session: Session,
    sticker: Pick<Sticker, 'id'> | string,
): void {
    recordUsage(
        session,
        'stickers',
        typeof sticker === 'string' ? sticker : sticker.id,
    )
}

/** The best ranked emojis of a history that can be used in the context. */
function frequentEmojis(
    session: Session,
    kind: 'emojis' | 'emojiReactions',
    context: ExpressionContext,
    count: number,
): SearchEmoji[] {
    const history = computeHistory(
        session.get(frecencyStore).getState()[kind],
        Date.now(),
        'emoji',
    )
    const byKey = new Map<string, SearchEmoji>()
    for (const emoji of listEmojis(context))
        byKey.set(emoji.type === 'custom' ? emoji.id : emoji.uniqueName, emoji)
    return rankedKeys(history)
        .flatMap(key => {
            const emoji = byKey.get(key)
            return emoji && getEmojiUnavailableReason(emoji, context) === null
                ? [emoji]
                : []
        })
        .slice(0, count)
}

/** The most used emojis that can be used in the context, best first (42, like the reference). */
export const getFrequentEmojis = (
    session: Session,
    context: ExpressionContext,
    count = FREQUENT_EMOJI_COUNT,
): SearchEmoji[] => frequentEmojis(session, 'emojis', context, count)

/**
 * The most used reaction emojis, best first (`EmojiStore.getFrequentlyUsedReactionEmojisWithoutFetchingLatest`;
 * the history is the user's `emoji_reaction_frecency`, seeded with the reference's defaults). Pass a context
 * with the REACTION intention.
 */
export const getFrequentReactionEmojis = (
    session: Session,
    context: ExpressionContext,
    count = FREQUENT_EMOJI_COUNT,
): SearchEmoji[] => frequentEmojis(session, 'emojiReactions', context, count)

/** Ids of the most used stickers, best first (20); look them up in the context's stickers. */
export function getFrequentStickerIds(
    session: Session,
    count = FREQUENT_STICKER_COUNT,
): string[] {
    const history = computeHistory(
        session.get(frecencyStore).getState().stickers,
        Date.now(),
        'sticker',
    )
    return rankedKeys(history).slice(0, count)
}

export const getFavoriteEmojiKeys = (session: Session): string[] =>
    session.get(frecencyStore).getState().favoriteEmojis
export const getFavoriteStickerIds = (session: Session): string[] =>
    session.get(frecencyStore).getState().favoriteStickers
