import { useCallback, useEffect, useState } from 'react'
import { compareSnowflakes } from '../../../core/discord/snowflake'
import { useSession } from '../../../core/react'
import { showToast } from '../../../design/components/overlays/toastStore'
import { t } from '../../../i18n'
import { messagesStore, revealMessage } from '../../../stores/messages/messages'
import { jumpToMessage } from '../../../stores/messages/messageWindows'
import { readStatesStore } from '../../../stores/readStates'
import { relationshipsStore } from '../../../stores/relationships'
import { hiddenReasonOf } from '../rows/buildRows'
import type { Session } from '../../../core/session'

type JumpResult = Awaited<ReturnType<typeof jumpToMessage>>

/** Makes every scroll request of the native list distinct. */
let scrollNonce = 0

/** Toasts why a jump failed. A cancelled one (another jump took over) says nothing. */
function toastJumpFailure(result: Exclude<JumpResult, 'loaded'>) {
    if (result === 'cancelled') return
    showToast({
        content: t(
            result === 'missing' ? 'chat.jump.notFound' : 'chat.loadFailed',
        ),
        variant: 'critical',
    })
}

/** Opens the blocked or ignored messages group a jump lands in. The reference leaves it folded. */
function revealIfHidden(
    session: Session,
    channelId: string,
    messageId: string,
) {
    const message = session
        .get(messagesStore)
        .getState()
        .channels[channelId]?.messages.find(item => item.id === messageId)
    if (!message) return
    const relationship = session.get(relationshipsStore).getState().byId[
        message.author.id
    ]
    if (hiddenReasonOf(relationship))
        revealMessage(session, channelId, messageId)
}

/**
 * Scroll requests for the native list. One for another chat is ignored there, and a new chat drops the old one.
 * `jump` is a message to scroll to once the chat is open.
 */
export function useChatScroll(channelId: string, jump?: { messageId: string }) {
    const session = useSession()
    const [scrollTarget, setScrollTarget] = useState<{
        scrollKey: string
        messageId?: string
        nonce: number
        flash: boolean
    }>()
    // biome-ignore lint/correctness/useExhaustiveDependencies: reset on every channel change
    useEffect(() => setScrollTarget(undefined), [channelId])
    /** Scrolls to a message, `null` meaning the bottom. */
    const scrollTo = (messageId: string | null, flash = false) => {
        if (messageId) revealIfHidden(session, channelId, messageId)
        setScrollTarget({
            scrollKey: channelId,
            messageId: messageId ?? undefined,
            nonce: ++scrollNonce,
            flash,
        })
    }
    // Keeps its identity: the jump effect below depends on it.
    /** Scrolls to a message, loading the window around it first when it is not loaded; a toast when it is gone. */
    const scrollToMessage = useCallback(
        async (messageId: string) => {
            const result = await jumpToMessage(session, channelId, messageId)
            if (result !== 'loaded') return toastJumpFailure(result)
            revealIfHidden(session, channelId, messageId)
            setScrollTarget({
                scrollKey: channelId,
                messageId,
                nonce: ++scrollNonce,
                flash: true,
            })
        },
        [session, channelId],
    )
    useEffect(() => {
        if (jump) void scrollToMessage(jump.messageId)
    }, [jump, scrollToMessage])
    /** MessagesUtils scrollToNewMessages: the window around the read marker, scrolled to the message after it. */
    const scrollToNewMessages = async () => {
        const ack = session.get(readStatesStore).getState().acks[channelId]
        if (!ack) return
        const result = await jumpToMessage(session, channelId, ack)
        if (result !== 'loaded') return toastJumpFailure(result)
        const loaded =
            session.get(messagesStore).getState().channels[channelId]
                ?.messages ?? []
        // Newest first: the message just before the marker's is the oldest unread.
        const index = loaded.findIndex(
            message => compareSnowflakes(message.id, ack) <= 0,
        )
        scrollTo(loaded[index - 1]?.id ?? ack)
    }
    return { scrollTarget, scrollTo, scrollToMessage, scrollToNewMessages }
}
