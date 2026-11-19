import { Endpoint } from '../../../core/api/paths'
import { showConfirmModal } from '../../../design/components/modals/showAlert'
import { t } from '../../../i18n'
import { findMessage, messagesStore } from '../../../stores/messages/messages'
import { toast } from '../composer/toast'
import { PollLinkAction } from '../links/chatLink'
import { openPollVoters } from './PollVotersSheet'
import { getPollState, updatePollState } from './pollState'
import { isPollExpired } from './pollTime'
import type { Session } from '../../../core/session'
import type { Message } from '../../../stores/readStates'
import type { MessageAction } from '../longPress/actions'

/** The answers the user's vote holds now (getCurrentAnswerIds). */
const votedAnswers = (message: Message) =>
    (message.poll?.results?.answer_counts ?? [])
        .filter(count => count.me_voted)
        .map(count => count.id)

/** Whether results show instead of picks, so an answer tap lists its voters (tapShouldOpenVotersModal). */
function tapOpensVoters(session: Session, message: Message): boolean {
    const poll = message.poll
    if (!poll) return false
    return (
        votedAnswers(message).length > 0 ||
        isPollExpired(poll) ||
        getPollState(session, message.id).showResults
    )
}

/** handlePollAnswerTapped: picks or drops an answer, only one unless the poll allows more. */
function tapAnswer(session: Session, message: Message, answerId: number) {
    if (tapOpensVoters(session, message)) {
        openPollVoters(message.channel_id, message.id, answerId)
        return
    }
    const multiselect = message.poll?.allow_multiselect === true
    updatePollState(session, message.id, state => {
        const picked = state.selected.includes(answerId)
        const others = multiselect ? state.selected : []
        return {
            ...state,
            selected: picked
                ? state.selected.filter(id => id !== answerId)
                : [...others.filter(id => id !== answerId), answerId],
        }
    })
}

/**
 * optimisticallySetAnswers: brings the message's recorded vote to `answers` through local MESSAGE_POLL_VOTE events.
 * The diff is taken from the store as it is now, so an echo that already landed is not counted twice.
 */
function setVotes(
    session: Session,
    channelId: string,
    messageId: string,
    answers: number[],
) {
    const message = findMessage(
        session.get(messagesStore).getState(),
        channelId,
        messageId,
    )
    if (!message) return
    const current = votedAnswers(message)
    const event = (answerId: number) => ({
        channel_id: channelId,
        message_id: messageId,
        user_id: session.userId,
        answer_id: answerId,
    })
    const { dispatch } = session.gateway
    for (const id of current.filter(id => !answers.includes(id)))
        dispatch.emit('MESSAGE_POLL_VOTE_REMOVE', event(id))
    for (const id of answers.filter(id => !current.includes(id)))
        dispatch.emit('MESSAGE_POLL_VOTE_ADD', event(id))
}

/**
 * handlePollSubmitVote and submitPollVote: shows the vote at once, then sends it; an empty list removes it. One
 * request at a time (`submitting`). When it fails the vote goes back to what it was and the picks stay.
 */
async function sendVote(session: Session, message: Message, answers: number[]) {
    const { channel_id: channelId, id } = message
    const before = votedAnswers(message)
    updatePollState(session, id, state => ({ ...state, submitting: true }))
    setVotes(session, channelId, id, answers)
    let sent = false
    try {
        // The reference sends the answer ids as strings (its picks are a Set of strings). The docs say integers.
        await session.rest.put(Endpoint.pollAnswers(channelId, id), {
            body: { answer_ids: answers.map(String) },
        })
        sent = true
    } catch {
        setVotes(session, channelId, id, before)
        toast(t('chat.actions.failed'))
    }
    updatePollState(session, id, state => ({
        ...state,
        selected: sent ? [] : state.selected,
        submitting: false,
    }))
}

/** handlePollActionTapped and handlePollAnswerTapped: a poll's answer or action button. */
export function handlePollLink(
    session: Session,
    channelId: string,
    messageId: string,
    action: PollLinkAction,
    answerId: number | undefined,
): void {
    const message = findMessage(
        session.get(messagesStore).getState(),
        channelId,
        messageId,
    )
    if (!message?.poll) return
    switch (action) {
        case PollLinkAction.answer:
            if (answerId !== undefined) tapAnswer(session, message, answerId)
            return
        case PollLinkAction.submit: {
            const { selected, submitting } = getPollState(session, messageId)
            if (!submitting && selected.length > 0)
                void sendVote(session, message, selected)
            return
        }
        case PollLinkAction.remove:
            // handleClearPollVote: Show results stays as it was.
            if (!getPollState(session, messageId).submitting)
                void sendVote(session, message, [])
            return
        case PollLinkAction.results:
            // handleShowVotes: picks are dropped either way.
            updatePollState(session, messageId, state => ({
                ...state,
                selected: [],
                showResults: !state.showResults,
            }))
            return
        case PollLinkAction.voters:
            openPollVoters(
                channelId,
                messageId,
                message.poll.answers[0]?.answer_id,
            )
            return
    }
}

/** Whether the user may end the poll early: their own poll that is still open (usePollMessageContextItemTypes). */
export function canEndPollEarly(session: Session, message: Message): boolean {
    const poll = message.poll
    return (
        poll !== undefined &&
        message.author.id === session.userId &&
        !isPollExpired(poll)
    )
}

/** PollsActionCreators.endPollEarly: asks first, then POST .../expire. The gateway's MESSAGE_UPDATE closes it. */
export function endPollEarly(session: Session, message: Message): void {
    showConfirmModal({
        key: 'poll-end-early',
        title: t('chat.poll.endTitle'),
        content: t('chat.poll.endBody'),
        confirmText: t('chat.poll.endConfirm'),
        variant: 'primary',
        onConfirm: () =>
            session.rest
                .post(Endpoint.pollExpire(message.channel_id, message.id))
                .then(() => undefined)
                .catch(() => toast(t('chat.actions.failed'))),
    })
}

/** The long press sheet's End Poll Now row (ClockXIcon). */
export const endPollAction = (
    session: Session,
    message: Message,
): MessageAction => ({
    key: 'endPoll',
    label: t('chat.poll.endNow'),
    icon: 'ClockXIcon',
    onPress: () => endPollEarly(session, message),
})
