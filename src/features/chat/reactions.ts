import { Endpoint } from '../../core/api/paths'
import { ReactionType } from '../../core/discord/messages'
import { t } from '../../i18n'
import { findMessage, messagesStore } from '../../stores/messages/messages'
import { sameEmoji } from '../../stores/messages/reactionEdits'
import { usersStore } from '../../stores/users'
import { PremiumType } from '../expressions/data/availability'
import { toast } from './composer/toast'
import type { Session } from '../../core/session'
import type { Reaction } from '../../stores/messages/messageTypes'

/** A reaction's emoji as the API and the messages carry it: `id` is null for a Unicode emoji, whose `name` is the character. */
export type ReactionEmoji = Reaction['emoji']

/** ReactionActionCreators.ReactionLocations.MESSAGE: where the reaction was made, sent as `location`. */
const LOCATION = 'Message'

/** The emoji part of a reaction URL (`ReactionUtils.getReactionEmojiURLPart`): `name:id` for custom emojis. */
const emojiPath = (emoji: ReactionEmoji) =>
    encodeURIComponent(
        emoji.id ? `${emoji.name}:${emoji.id}` : (emoji.name ?? ''),
    )

const typeOf = (burst: boolean) =>
    burst ? ReactionType.BURST : ReactionType.NORMAL

/** Whether the current user has reacted to the message with this emoji, as a normal or (`burst`) super reaction. */
function hasReacted(
    session: Session,
    channelId: string,
    messageId: string,
    emoji: ReactionEmoji,
    burst: boolean,
): boolean {
    const message = findMessage(
        session.get(messagesStore).getState(),
        channelId,
        messageId,
    )
    const reaction = message?.reactions?.find(item =>
        sameEmoji(item.emoji, emoji),
    )
    return (burst ? reaction?.me_burst : reaction?.me) === true
}

/** The local copy of the gateway event a reaction request causes. */
const reactionEvent = (
    session: Session,
    channelId: string,
    messageId: string,
    emoji: ReactionEmoji,
    burst: boolean,
) => ({
    channel_id: channelId,
    message_id: messageId,
    user_id: session.userId,
    emoji,
    burst,
})

/**
 * Reacts to a message (PUT .../reactions/{emoji}/@me), a super reaction with `burst`. The reaction shows at once:
 * the gateway's MESSAGE_REACTION_ADD is emitted locally for the current user, and the messages store ignores the
 * server's echo of it. When the request fails the reaction is taken back.
 */
export function addReaction(
    session: Session,
    channelId: string,
    messageId: string,
    emoji: ReactionEmoji,
    burst = false,
): void {
    if (hasReacted(session, channelId, messageId, emoji, burst)) return
    const event = reactionEvent(session, channelId, messageId, emoji, burst)
    session.gateway.dispatch.emit('MESSAGE_REACTION_ADD', event)
    session.rest
        .put(Endpoint.myReaction(channelId, messageId, emojiPath(emoji)), {
            query: { location: LOCATION, type: typeOf(burst) },
        })
        .catch(() => {
            session.gateway.dispatch.emit('MESSAGE_REACTION_REMOVE', event)
            toast(t('chat.actions.failed'))
        })
}

/**
 * Takes the user's reaction back, optimistically like `addReaction`: DELETE .../reactions/{emoji}/{type}/@me
 * (ReactionActionCreators.removeReaction, REACTION_WITH_TYPE).
 */
function removeReaction(
    session: Session,
    channelId: string,
    messageId: string,
    emoji: ReactionEmoji,
    burst: boolean,
): void {
    if (!hasReacted(session, channelId, messageId, emoji, burst)) return
    const event = reactionEvent(session, channelId, messageId, emoji, burst)
    // A reaction the removal empties comes back in its place and colours when the request fails.
    const reactions =
        findMessage(session.get(messagesStore).getState(), channelId, messageId)
            ?.reactions ?? []
    const index = reactions.findIndex(item => sameEmoji(item.emoji, emoji))
    const restore = {
        ...event,
        burst_colors: reactions[index]?.burst_colors,
        restore_index: index < 0 ? undefined : index,
    }
    session.gateway.dispatch.emit('MESSAGE_REACTION_REMOVE', event)
    session.rest
        .delete(
            Endpoint.myReactionOfType(
                channelId,
                messageId,
                emojiPath(emoji),
                typeOf(burst),
            ),
            { query: { location: LOCATION, burst } },
        )
        .catch(() => {
            session.gateway.dispatch.emit('MESSAGE_REACTION_ADD', restore)
            toast(t('chat.actions.failed'))
        })
}

/** Adds the reaction, or takes it back when the user already made it. `burst` toggles the super reaction. */
export function toggleReaction(
    session: Session,
    channelId: string,
    messageId: string,
    emoji: ReactionEmoji,
    burst = false,
): void {
    const act = hasReacted(session, channelId, messageId, emoji, burst)
        ? removeReaction
        : addReaction
    act(session, channelId, messageId, emoji, burst)
}

/** Removes every reaction of every user (needs Manage Messages). The gateway's REMOVE_ALL updates the store. */
export function removeAllReactions(
    session: Session,
    channelId: string,
    messageId: string,
): void {
    session.rest
        .delete(Endpoint.messageReactions(channelId, messageId))
        .catch(() => toast(t('chat.actions.failed')))
}

/** `ReactionRow.key` back to an emoji: the character, or `name:id` for a custom emoji. */
function emojiFromKey(key: string): ReactionEmoji {
    const split = key.lastIndexOf(':')
    return split > 0
        ? { id: key.slice(split + 1), name: key.slice(0, split) }
        : { id: null, name: key }
}

/** Returns a reaction's `ReactionRow.key`: the character, or `name:id` for a custom emoji. */
export const keyOf = (emoji: ReactionEmoji) =>
    emoji.id ? `${emoji.name}:${emoji.id}` : (emoji.name ?? '')

const getMessage = (session: Session, channelId: string, messageId: string) =>
    findMessage(session.get(messagesStore).getState(), channelId, messageId)

/**
 * Taps a reaction chip: reacts with the emoji, or takes the reaction back.
 * A super reaction chip (`burst`) toggles the user's super reaction (MessagesUtils.handleAddOrRemoveReaction).
 * Without Nitro the reference opens the out-of-super-reactions upsell; here it toggles a normal reaction.
 */
export function toggleReactionByKey(
    session: Session,
    channelId: string,
    messageId: string,
    key: string,
    burst = false,
): void {
    const emoji = emojiFromKey(key)
    const reaction = getMessage(session, channelId, messageId)?.reactions?.find(
        item => keyOf(item.emoji) === key,
    )
    const premium =
        (session.get(usersStore).getState().users[session.userId]
            ?.premium_type ?? PremiumType.NONE) !== PremiumType.NONE
    toggleReaction(
        session,
        channelId,
        messageId,
        { ...emoji, animated: reaction?.emoji.animated },
        burst && (reaction?.me_burst === true || premium),
    )
}
