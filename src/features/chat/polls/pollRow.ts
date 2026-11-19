import { emojiUrl } from '../../../core/discord/cdn'
import { t } from '../../../i18n'
import { twemojiUrl } from '../emoji'
import { chatLink, PollLinkAction } from '../links/chatLink'
import { isPollExpired, timeLeft } from './pollTime'
import type { MessagePoll } from '../../../stores/messages/messageTypes'
import type { PollActionRow, PollAnswerStyle, PollRow } from '../rows/rows'
import type { PollState } from './pollState'

/** The footer's parts: "12 votes • 3 hours left" (the native PollAction fullTextLabel). */
const FOOTER_JOINER = ' • '

const votesLabel = (count: number) =>
    t(count === 1 ? 'chat.poll.vote' : 'chat.poll.votes', { count })

/** The emoji of an answer, as reaction chips draw theirs. */
function answerEmoji(
    emoji: MessagePoll['answers'][number]['poll_media']['emoji'],
) {
    if (emoji?.id) return { emojiUrl: emojiUrl(emoji.id, emoji.animated, 48) }
    if (emoji?.name)
        return { emoji: emoji.name, emojiUrl: twemojiUrl(emoji.name) }
    return {}
}

/** computeBasicPollChatData: what the user may do with the poll. */
function pollFlags(poll: MessagePoll, state: PollState | undefined) {
    const counts = poll.results?.answer_counts ?? []
    const expiryLabel = timeLeft(poll)
    const expired = isPollExpired(poll)
    const interactive = state !== undefined
    // `editing` is never on here, so a recorded vote is a vote.
    const hasVoted = counts.some(count => count.me_voted)
    const showResults = state?.showResults ?? false
    const canShowVoteCounts = hasVoted || expired || showResults
    return {
        counts,
        expiryLabel,
        expired,
        interactive,
        hasVoted,
        showResults,
        canShowVoteCounts,
        canRemoveVote: hasVoted && !expired,
        canSubmitVote:
            state !== undefined &&
            !state.submitting &&
            state.selected.length > 0 &&
            !hasVoted &&
            !expired,
    }
}
type PollFlags = ReturnType<typeof pollFlags>

/** formatPollMessageChatData's answer style (PollStyles' style sets). */
function answerStyle(
    flags: PollFlags,
    { didSelfVote, isLeader, isSelected }: Record<string, boolean>,
): PollAnswerStyle {
    if (flags.expired) {
        if (isLeader)
            return didSelfVote ? 'victorSelected' : 'victorNotSelected'
        return didSelfVote ? 'loserSelected' : 'notVoted'
    }
    if (didSelfVote) return 'voted'
    if (flags.hasVoted) return 'notVoted'
    if (isSelected) return 'selected'
    if (flags.showResults) return 'notVoted'
    return 'normalVote'
}

/** The primary action: Vote, Remove Vote or Go back to vote. */
function primaryAction(
    messageId: string,
    flags: PollFlags,
): PollActionRow | undefined {
    if (!flags.interactive || flags.expired) return undefined
    if (flags.canRemoveVote)
        return {
            label: t('chat.poll.removeVote'),
            presentation: 'secondaryButton',
            url: chatLink.poll(messageId, PollLinkAction.remove),
        }
    if (flags.showResults)
        return {
            label: t('chat.poll.goBackToVote'),
            presentation: 'secondaryButton',
            url: chatLink.poll(messageId, PollLinkAction.results),
        }
    return {
        label: t('chat.poll.submit'),
        presentation: 'button',
        url: flags.canSubmitVote
            ? chatLink.poll(messageId, PollLinkAction.submit)
            : undefined,
    }
}

/** The votes line (showVoterDetails), or "View original message to interact" outside the poll's chat. */
function secondaryAction(
    messageId: string,
    flags: PollFlags,
    total: number,
): PollActionRow {
    if (!flags.interactive && !flags.expired)
        return { label: t('chat.poll.viewOriginal'), presentation: 'text' }
    return {
        label: [
            votesLabel(total),
            flags.expiryLabel ?? t('chat.poll.closed'),
        ].join(FOOTER_JOINER),
        presentation: 'text',
        url: flags.interactive
            ? chatLink.poll(messageId, PollLinkAction.voters)
            : undefined,
    }
}

/**
 * formatPollMessageChatData: the question, the answers in their styles and the actions. `state` is the user's
 * poll state, absent where the poll cannot be used (a search result or preview: isInteractive).
 */
export function pollRow(
    messageId: string,
    poll: MessagePoll,
    state: PollState | undefined,
): PollRow {
    const flags = pollFlags(poll, state)
    const votes = new Map(flags.counts.map(count => [count.id, count]))
    const total = flags.counts.reduce((sum, count) => sum + count.count, 0)
    const most = Math.max(0, ...flags.counts.map(count => count.count))
    const tapOpensVoters = flags.canShowVoteCounts
    return {
        question: poll.question.text ?? '',
        hint:
            flags.interactive && !flags.expired
                ? t(
                      poll.allow_multiselect
                          ? 'chat.poll.multiselect'
                          : 'chat.poll.single',
                  )
                : undefined,
        interaction:
            tapOpensVoters || !flags.interactive
                ? 'list'
                : poll.allow_multiselect
                  ? 'checkbox'
                  : 'radio',
        showResults: flags.canShowVoteCounts,
        answers: poll.answers.map(answer => {
            const count = votes.get(answer.answer_id)?.count ?? 0
            return {
                text: answer.poll_media.text ?? '',
                ...answerEmoji(answer.poll_media.emoji),
                votes: votesLabel(count),
                percent: total ? Math.round((count / total) * 100) : 0,
                style: answerStyle(flags, {
                    didSelfVote: votes.get(answer.answer_id)?.me_voted === true,
                    isLeader: count > 0 && count >= most,
                    isSelected:
                        state?.selected.includes(answer.answer_id) === true,
                }),
                url: flags.interactive
                    ? chatLink.poll(
                          messageId,
                          PollLinkAction.answer,
                          answer.answer_id,
                      )
                    : undefined,
            }
        }),
        primary: primaryAction(messageId, flags),
        secondary: secondaryAction(messageId, flags, total),
        // Show results, before voting.
        tertiary:
            flags.interactive &&
            !flags.expired &&
            !flags.hasVoted &&
            !flags.showResults
                ? {
                      label: t('chat.poll.showResults'),
                      presentation: 'textButton',
                      url: chatLink.poll(messageId, PollLinkAction.results),
                  }
                : undefined,
    }
}
