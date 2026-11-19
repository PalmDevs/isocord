import { useEffect, useRef, useState } from 'react'
import { logger } from '../../../core/log'
import { useSession, useSessionStore } from '../../../core/react'
import { afterSplash } from '../../../core/startup'
import { channelsStore } from '../../../stores/channels/channels'
import { prefetchMemberList } from '../../../stores/memberList'
import { dismissComposers } from '../composer'
import { DRAW_TIMEOUT_MS, slideTo } from './slide'
import { usePanelLayer } from './usePanelLayer'

// DIAG: stuck Servers chat panel. Remove once found.
const diag = logger('PanelsDiag')

/** How long after the splash the idle callback may wait before the selected chat is built. */
const FIRST_BUILD_IDLE_MS = 1500
/** How long a newly selected channel may wait for idle before its chat is built. */
const BUILD_IDLE_MS = 1000

/**
 * The selected chat is built offscreen ahead of time, but not during startup: building it blocks the UI
 * thread for a few hundred ms, which held the launch splash on screen. It waits until the real UI has
 * replaced the splash and the app is idle, or for a tap.
 */
function useAfterFirstPaint() {
    const [afterFirstPaint, setAfterFirstPaint] = useState(false)
    useEffect(() => {
        let idle: number | undefined
        const cancel = afterSplash(() => {
            idle = requestIdleCallback(() => setAfterFirstPaint(true), {
                timeout: FIRST_BUILD_IDLE_MS,
            })
        })
        return () => {
            cancel()
            if (idle !== undefined) cancelIdleCallback(idle)
        }
    }, [])
    return afterFirstPaint
}

/**
 * The tab's own chat panel: the selected or opened channel, the offscreen build of it, and the slide in that
 * waits for its first rows.
 */
export function useChatPanel({
    width,
    selectedChannelId,
    tabFocused,
    dropOverlays,
}: {
    width: number
    selectedChannelId?: string
    tabFocused: boolean
    /** Removes the stacked chat and the thread creation over this chat. */
    dropOverlays: () => void
}) {
    const layer = usePanelLayer(width)
    const { x, open, setShown } = layer
    const afterFirstPaint = useAfterFirstPaint()
    const session = useSession()
    const [openedChannel, setOpenedChannel] = useState<string>()
    const channelId = selectedChannelId ?? openedChannel
    const hasChannel = useSessionStore(
        channelsStore,
        state => channelId !== undefined && channelId in state.channels,
    )

    // The channel the offscreen chat is built for. While the chat is closed, a newly selected channel (a server
    // switch picks its last or default channel) is built once the app is idle, so the switch itself isn't held
    // up by the chat's first layout. An open chat, or a tap that opens it, builds it at once.
    const [builtChannelId, setBuiltChannelId] = useState(channelId)
    if (open && builtChannelId !== channelId) setBuiltChannelId(channelId)
    useEffect(() => {
        if (open || builtChannelId === channelId) return
        const idle = requestIdleCallback(() => setBuiltChannelId(channelId), {
            timeout: BUILD_IDLE_MS,
        })
        return () => cancelIdleCallback(idle)
    }, [open, channelId, builtChannelId])
    // The channel details' member list is subscribed to as the chat opens, so the details don't build it
    // mid-slide (the reference subscribes the selected channel's list on selection, GuildSubscriptionsStore).
    useEffect(() => {
        if (open && channelId) prefetchMemberList(session, channelId)
    }, [session, open, channelId])
    const hasBuiltChannel = useSessionStore(
        channelsStore,
        state =>
            builtChannelId !== undefined && builtChannelId in state.channels,
    )

    // The channel whose rows the native list last reported drawing; a tap waits for it so the heavy first
    // layout does not land in the middle of the slide. Swipes do not wait: the chat is built on selection when idle, or as the swipe starts.
    const drawnChannel = useRef<string>(undefined)
    const [waiting, setWaiting] = useState(false)
    const reveal = () => {
        diag.debug(`reveal ${channelId}`)
        setWaiting(false)
        slideTo(x, width, true, false)
    }
    // The native list starts over when the channel changes.
    // biome-ignore lint/correctness/useExhaustiveDependencies: reset on every channel change
    useEffect(() => {
        drawnChannel.current = undefined
    }, [channelId])
    // Runs after the commit that carries a newly selected channel, so `channelId` is current here.
    // biome-ignore lint/correctness/useExhaustiveDependencies: reveal only needs to run when waiting starts or the channel changes
    useEffect(() => {
        if (!waiting) return
        if (!channelId || drawnChannel.current === channelId) return reveal()
        const timer = setTimeout(reveal, DRAW_TIMEOUT_MS)
        return () => clearTimeout(timer)
    }, [waiting, channelId])
    const onRowsDrawn = (id: string) => {
        drawnChannel.current = id
        if (waiting && id === channelId) reveal()
    }

    // A message to scroll to in the channel opened with `openChat`.
    const [jump, setJump] = useState<{ channelId: string; messageId: string }>()
    const show = (id?: string, messageId?: string) => {
        dropOverlays()
        if (id) setOpenedChannel(id)
        setJump(id && messageId ? { channelId: id, messageId } : undefined)
        setShown(true)
        setWaiting(true)
    }
    // An open requested while the tab was not selected (another tab's chat linked here) runs once it is.
    const [pendingOpen, setPendingOpen] = useState<{
        id?: string
        messageId?: string
    }>()
    const openChat = (id?: string, messageId?: string) => {
        diag.debug(
            `openChat ${id ?? channelId} tabFocused=${tabFocused} open=${open} hasChannel=${hasChannel}`,
        )
        if (tabFocused) show(id, messageId)
        else setPendingOpen({ id, messageId })
    }
    useEffect(() => {
        if (!pendingOpen || !tabFocused) return
        diag.debug(`pending open ${pendingOpen.id ?? channelId} runs`)
        setPendingOpen(undefined)
        show(pendingOpen.id, pendingOpen.messageId)
    })
    /** Slides the chat away. */
    const close = () => {
        dismissComposers()
        setWaiting(false)
        setShown(false)
        slideTo(x, width, false, false)
    }
    return {
        ...layer,
        channelId,
        hasChannel,
        builtChannelId,
        setBuiltChannelId,
        hasBuiltChannel,
        built: afterFirstPaint || open,
        jump,
        openChat,
        close,
        onRowsDrawn,
    }
}

export type ChatPanelState = ReturnType<typeof useChatPanel>
