import type { Message } from '../readStates'
import type { Reaction } from './messageTypes'

/** What a reaction event says about one reaction. */
export interface ReactionChange {
    emoji: Reaction['emoji']
    /** A super reaction (the event's `burst`). */
    burst: boolean
    /** MESSAGE_REACTION_ADD of a super reaction: its colours. */
    burstColors?: string[]
    /** The current user made or took back the reaction. */
    mine: boolean
    /** Where a reaction that is not in the list yet goes; the end when absent. */
    index?: number
}

export const sameEmoji = (a: Reaction['emoji'], b: Reaction['emoji']) =>
    a.id ? a.id === b.id : !b.id && a.name === b.name

/** Returns a reaction's normal and super counts; one without details is all normal. */
export const reactionCounts = (reaction: Reaction) =>
    reaction.count_details ?? { normal: reaction.count, burst: 0 }

/** Returns whether the user already holds this kind of the reaction. */
const holds = (reaction: Reaction | undefined, burst: boolean) =>
    burst ? reaction?.me_burst === true : reaction?.me === true

/** Changes one reaction by `delta` of its kind. Returns undefined when it has none left. */
function changed(
    reaction: Reaction,
    { burst, burstColors, mine }: ReactionChange,
    delta: 1 | -1,
): Reaction | undefined {
    const details = reactionCounts(reaction)
    const count_details = {
        normal: details.normal + (burst ? 0 : delta),
        burst: details.burst + (burst ? delta : 0),
    }
    const count = reaction.count + delta
    if (count <= 0) return undefined
    const flag = delta > 0
    return {
        ...reaction,
        count,
        count_details,
        me: mine && !burst ? flag : reaction.me,
        me_burst: mine && burst ? flag : reaction.me_burst,
        burst_colors: reaction.burst_colors ?? burstColors,
    }
}

/**
 * MESSAGE_REACTION_ADD. Our own reaction is shown before the server confirms it (chat/reactions.ts), so its
 * echo changes nothing.
 */
export function withReactionAdded(
    message: Message,
    change: ReactionChange,
): Message {
    const reactions = message.reactions ?? []
    const current = reactions.find(reaction =>
        sameEmoji(reaction.emoji, change.emoji),
    )
    if (change.mine && holds(current, change.burst)) return message
    if (!current) {
        const added = changed(
            {
                emoji: change.emoji,
                count: 0,
                me: false,
                count_details: { normal: 0, burst: 0 },
            },
            change,
            1,
        )
        if (!added) return message
        const at = change.index ?? reactions.length
        return {
            ...message,
            reactions: [
                ...reactions.slice(0, at),
                added,
                ...reactions.slice(at),
            ],
        }
    }
    return {
        ...message,
        reactions: reactions.map(reaction =>
            reaction === current
                ? (changed(reaction, change, 1) ?? reaction)
                : reaction,
        ),
    }
}

/** MESSAGE_REACTION_REMOVE. The echo of a reaction we already took back changes nothing. */
export function withReactionRemoved(
    message: Message,
    change: ReactionChange,
): Message {
    const reactions = message.reactions ?? []
    const current = reactions.find(reaction =>
        sameEmoji(reaction.emoji, change.emoji),
    )
    if (!current || (change.mine && !holds(current, change.burst)))
        return message
    return {
        ...message,
        reactions: reactions.flatMap(reaction => {
            if (reaction !== current) return [reaction]
            const next = changed(reaction, change, -1)
            return next ? [next] : []
        }),
    }
}

/**
 * MESSAGE_POLL_VOTE_ADD and _REMOVE: one vote more or less on an answer. Our own vote is shown before the server
 * confirms it (chat/polls/pollActions.ts), so its echo changes nothing.
 */
export function withPollVote(
    message: Message,
    answerId: number,
    mine: boolean,
    added: boolean,
): Message {
    const poll = message.poll
    if (!poll) return message
    const counts = poll.results?.answer_counts ?? []
    const current = counts.find(entry => entry.id === answerId)
    if (mine && (current?.me_voted ?? false) === added) return message
    const delta = added ? 1 : -1
    const next = {
        id: answerId,
        count: Math.max(0, (current?.count ?? 0) + delta),
        me_voted: mine ? added : (current?.me_voted ?? false),
    }
    return {
        ...message,
        poll: {
            ...poll,
            results: {
                is_finalized: poll.results?.is_finalized ?? false,
                answer_counts: current
                    ? counts.map(entry => (entry === current ? next : entry))
                    : [...counts, next],
            },
        },
    }
}
