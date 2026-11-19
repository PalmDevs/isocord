import { useEffect, useState } from 'react'
import { useSession, useSessionStore } from '../../../core/react'
import { channelsStore } from '../../../stores/channels/channels'
import { prefetchMemberList } from '../../../stores/memberList'
import { dismissComposers } from '../composer'
import { DRAW_TIMEOUT_MS, slideTo } from './slide'
import { usePanelLayer } from './usePanelLayer'

/**
 * A channel stacked over the chat (a channel mention, message link or forwarded message's source), scrolled to a
 * message when the link names one. It slides in from the right like the chat, and swiping it away or back returns
 * to the chat under it.
 */
export function useStackedChat(width: number, resetDetails: () => void) {
    const layer = usePanelLayer(width)
    const { x, openRef, setShown } = layer
    const [stack, setStack] = useState<{
        channelId: string
        jump?: { messageId: string }
    }>()
    const [waiting, setWaiting] = useState(false)
    const session = useSession()
    const hasChannel = useSessionStore(
        channelsStore,
        state => stack !== undefined && stack.channelId in state.channels,
    )
    const closed = () => {
        if (!openRef.current) setStack(undefined)
    }
    const reveal = () => {
        setWaiting(false)
        slideTo(x, width, true, false)
    }
    const show = (id: string, messageId?: string) => {
        dismissComposers()
        resetDetails()
        // A new object for every request, so the same message can be jumped to again.
        setStack({ channelId: id, jump: messageId ? { messageId } : undefined })
        // Already showing: the stacked chat switches channels in place.
        if (!openRef.current) setWaiting(true)
        setShown(true)
    }
    const close = () => {
        dismissComposers()
        resetDetails()
        setWaiting(false)
        setShown(false)
        slideTo(x, width, false, false, closed)
    }
    /** Removes the stacked chat at once (the chat under it closes or shows another channel). */
    const drop = () => {
        setWaiting(false)
        setShown(false)
        setStack(undefined)
        x.set(width)
    }
    /** Shows a chat that is already drawn elsewhere, without waiting for it. */
    const showAtOnce = (id: string) => {
        setStack({ channelId: id })
        setWaiting(false)
        setShown(true)
        x.set(0)
    }
    // Like opening the chat: the slide waits for the stacked chat's first rows, or the timeout.
    // biome-ignore lint/correctness/useExhaustiveDependencies: reveal only needs to run when waiting starts
    useEffect(() => {
        if (!waiting) return
        const timer = setTimeout(reveal, DRAW_TIMEOUT_MS)
        return () => clearTimeout(timer)
    }, [waiting])
    const onRowsDrawn = (id: string) => {
        if (waiting && id === stack?.channelId) reveal()
    }
    useEffect(() => {
        if (stack) prefetchMemberList(session, stack.channelId)
    }, [session, stack])
    // The stacked chat's channel went away: back to the chat under it.
    // biome-ignore lint/correctness/useExhaustiveDependencies: drop only uses refs, setters and shared values
    useEffect(() => {
        if (stack && !hasChannel) drop()
    }, [stack, hasChannel])
    return {
        ...layer,
        stack,
        hasChannel,
        closed,
        show,
        close,
        drop,
        showAtOnce,
        onRowsDrawn,
    }
}

export type StackedChat = ReturnType<typeof useStackedChat>
