import { MessageType } from '../../../core/discord/messages'
import { chatLink } from '../links/chatLink'
import { authorValues } from './types'
import type { Message } from '../../../stores/readStates'
import type { SystemContent, SystemEnv, SystemHandlers } from './types'

/** The poll result embed's fields (parsePollResultSystemMessageEmbed). */
interface PollResult {
    questionText?: string
    victorAnswerId?: string
    victorAnswerText?: string
    victorAnswerVotes: number
    totalVotes: number
    victorEmojiId?: string
    victorEmojiName?: string
}

/** The emoji of a poll without a winner (sadEmojiHook: "frowning"). */
const SAD_EMOJI = '😦'

/** parsePollResultSystemMessageEmbed: the first embed's fields by name, or undefined without fields. */
function parsePollResult(message: Message): PollResult | undefined {
    const fields = message.embeds?.[0]?.fields
    if (!fields) return undefined
    const value = (name: string) =>
        fields.find(field => field.name === name)?.value
    return {
        questionText: value('poll_question_text'),
        victorAnswerId: value('victor_answer_id'),
        victorAnswerText: value('victor_answer_text'),
        victorAnswerVotes: Number.parseInt(
            value('victor_answer_votes') ?? '0',
            10,
        ),
        totalVotes: Number.parseInt(value('total_votes') ?? '0', 10),
        victorEmojiId: value('victor_answer_emoji_id'),
        victorEmojiName: value('victor_answer_emoji_name'),
    }
}

/** createPollResultSystemMessage: who won, and the question that jumps to the poll. */
function pollResultContent(
    message: Message,
    env: SystemEnv,
): SystemContent | undefined {
    const result = parsePollResult(message)
    const ref = message.message_reference
    if (!result || !ref?.message_id) return undefined
    const values = {
        ...authorValues(message, env),
        title: result.questionText ?? '',
        // bindJumpToMessage: the poll's message.
        titleOnClick: {
            url: chatLink.channel(
                ref.guild_id ?? env.guild?.id,
                ref.channel_id ?? message.channel_id,
                ref.message_id,
            ),
        },
    }
    if (result.totalVotes === 0)
        return {
            key: 'chat.system.pollResult.none',
            values: { ...values, sadEmoji: SAD_EMOJI },
        }
    const percentage = `${Math.round((result.victorAnswerVotes / result.totalVotes) * 100)}%`
    if (!result.victorAnswerId)
        return {
            key: 'chat.system.pollResult.tie',
            values: { ...values, percentage },
        }
    // A unicode emoji leads the answer. The reference also draws a custom one, which spans in values cannot carry.
    const emoji = result.victorEmojiId ? undefined : result.victorEmojiName
    const answer = [emoji, result.victorAnswerText].filter(Boolean).join(' ')
    return {
        key: 'chat.system.pollResult.winner',
        values: { ...values, answer, percentage },
    }
}

/** A poll that has closed. */
export const pollHandlers: SystemHandlers = {
    [MessageType.POLL_RESULT]: {
        icon: 'polls',
        tint: 'normal',
        content: pollResultContent,
    },
}
