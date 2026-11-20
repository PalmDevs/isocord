import { reactionCounts } from '../../stores/messages/reactionEdits'
import type { DefaultReaction } from '../../core/discord/forum'
import type { Reaction } from '../../stores/messages/messageTypes'

/** A post's reactions to show, and the users behind the rest (additionalNonUniqueReactionCount). */
export interface ForumPostReactionList {
    shown: Reaction[]
    more: number
    /** The first reaction left out, which "+N" opens the reactions sheet on. */
    firstHidden: Reaction | undefined
}

/** Returns a reaction's normal part alone: posts leave super reactions out of their picks. */
function normalPart(reaction: Reaction): Reaction {
    const { normal } = reactionCounts(reaction)
    return {
        ...reaction,
        count: normal,
        count_details: { normal, burst: 0 },
        me_burst: false,
    }
}

/**
 * Returns a post's first `count` reactions (useSomeForumPostReactions). `sorted` orders them by users.
 * A post without reactions shows the forum's default reaction at 0 (useDefaultReactionEmoji).
 * Super reactions are left out, unlike the reference's `count + burst_count`.
 */
export function forumPostReactions(
    reactions: Reaction[] | undefined,
    defaultEmoji: DefaultReaction | null | undefined,
    count: number,
    sorted: boolean,
): ForumPostReactionList {
    const normal = (reactions ?? [])
        .map(normalPart)
        .filter(reaction => reaction.count > 0)
    const all =
        normal.length > 0
            ? normal
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
    const ordered = sorted ? [...all].sort((a, b) => b.count - a.count) : all
    const shown = ordered.slice(0, count)
    const hidden = ordered.slice(count)
    const more = hidden.reduce((sum, reaction) => sum + reaction.count, 0)
    return { shown, more, firstHidden: hidden[0] }
}
