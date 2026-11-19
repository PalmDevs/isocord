import type { DefaultReaction } from '../../core/discord/forum'
import type { Reaction } from '../../stores/messages/messageTypes'

/** A post's reactions to show, and the users behind the rest (additionalNonUniqueReactionCount). */
export interface ForumPostReactionList {
    shown: Reaction[]
    more: number
    /** The first reaction left out, which "+N" opens the reactions sheet on. */
    firstHidden: Reaction | undefined
}

const burstOf = (reaction: Reaction) => reaction.count_details?.burst ?? 0

/**
 * Returns a post's first `count` reactions (useSomeForumPostReactions). `sorted` orders them by users, then
 * super reactions. A post without reactions shows the forum's default reaction at 0 (useDefaultReactionEmoji).
 * `count` here holds normal and super reactions together, the reference's `count + burst_count`.
 */
export function forumPostReactions(
    reactions: Reaction[] | undefined,
    defaultEmoji: DefaultReaction | null | undefined,
    count: number,
    sorted: boolean,
): ForumPostReactionList {
    const all =
        reactions && reactions.length > 0
            ? reactions
            : defaultEmoji?.emoji_name || defaultEmoji?.emoji_id
              ? [
                    {
                        emoji: {
                            id: defaultEmoji.emoji_id ?? null,
                            name: defaultEmoji.emoji_name ?? null,
                        },
                        count: 0,
                        me: false,
                        me_burst: false,
                    },
                ]
              : []
    const ordered = sorted
        ? [...all].sort((a, b) => b.count - a.count || burstOf(b) - burstOf(a))
        : all
    const shown = ordered.slice(0, count)
    const hidden = ordered.slice(count)
    const more = hidden.reduce((sum, reaction) => sum + reaction.count, 0)
    return { shown, more, firstHidden: hidden[0] }
}
