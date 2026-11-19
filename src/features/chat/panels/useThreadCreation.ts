import { useEffect, useRef, useState } from 'react'
import { dismissComposers } from '../composer'
import { slideTo } from './slide'
import { usePanelLayer } from './usePanelLayer'
import type { DetailsPanel } from './useDetailsPanel'
import type { StackedChat } from './useStackedChat'

/** How long a created thread's chat may take to draw before the creation panel over it goes anyway. */
const HANDOFF_TIMEOUT_MS = 1000

/**
 * Thread creation (CreateThreadView, the reference's CREATE_THREAD screen of the channel stack), over the chat on
 * top: from a message's long press, or the Threads page of the details, which slide away first. Swiping it away
 * or back returns to what is under it.
 */
export function useThreadCreation(
    width: number,
    details: DetailsPanel,
    stack: StackedChat,
) {
    const layer = usePanelLayer(width)
    const { x, openRef, setShown } = layer
    const [create, setCreate] = useState<{
        channelId: string
        messageId?: string
        key: number
    }>()
    const count = useRef(0)
    // The created thread opens stacked under the creation panel, which goes once the thread's chat has drawn, so the
    // switch shows no half-built chat. Back from the thread returns to the chat it was created in (the reference
    // replaces that chat with the thread).
    const [handoff, setHandoff] = useState<string>()
    const closed = () => {
        if (!openRef.current) setCreate(undefined)
    }
    const show = (id: string, messageId?: string) => {
        dismissComposers()
        setCreate({ channelId: id, messageId, key: ++count.current })
        setShown(true)
        if (!details.openRef.current) return slideTo(x, width, true, false)
        details.slideAway(() => slideTo(x, width, true, false))
    }
    const close = () => {
        dismissComposers()
        setShown(false)
        slideTo(x, width, false, false, closed)
    }
    /** Removes the creation panel at once. */
    const drop = () => {
        setHandoff(undefined)
        setShown(false)
        setCreate(undefined)
        x.set(width)
    }
    const onCreated = (threadId: string) => {
        stack.showAtOnce(threadId)
        setHandoff(threadId)
    }
    const endHandoff = () => {
        dismissComposers()
        drop()
    }
    // biome-ignore lint/correctness/useExhaustiveDependencies: only a new handoff restarts the timer
    useEffect(() => {
        if (!handoff) return
        const timer = setTimeout(endHandoff, HANDOFF_TIMEOUT_MS)
        return () => clearTimeout(timer)
    }, [handoff])
    const onStackRowsDrawn = (id: string) => {
        if (handoff === id) endHandoff()
    }
    return {
        ...layer,
        create,
        closed,
        show,
        close,
        drop,
        onCreated,
        onStackRowsDrawn,
    }
}

export type ThreadCreation = ReturnType<typeof useThreadCreation>
