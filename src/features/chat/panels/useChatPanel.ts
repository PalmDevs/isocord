import { useEffect, useRef, useState } from 'react'
import { useAnimatedReaction } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { THREADS_ONLY_CHANNEL_TYPES } from '../../../core/discord/channelType'
import { logger } from '../../../core/log'
import {
    useSession,
    useSessionReady,
    useSessionStore,
} from '../../../core/react'
import { traced } from '../../../core/trace'
import { channelsStore } from '../../../stores/channels/channels'
import { prefetchMemberList } from '../../../stores/memberList'
import { messagesStore } from '../../../stores/messages/messages'
import { loadMessages } from '../../../stores/messages/messageWindows'
import { dismissComposers } from '../composer'
import { slideTo } from './slide'
import { usePanelLayer } from './usePanelLayer'
import type { SharedValue } from 'react-native-reanimated'

// DIAG: stuck Servers chat panel. Remove once found.
const diag = logger('PanelsDiag')

/** Delay between gateway READY and offscreen layout. */
const CHAT_WARMUP_DELAY_MS = 1000
const FIRST_ROWS_BUDGET_MS = 100

type Position = 'closed' | 'moving' | 'open'
interface OpenRequest {
    channelId: string
    account: string
    deadline: number
    swipe: boolean
}

/** The tab's own chat panel. Cold slides carry a placeholder until its contents draw. */
export function useChatPanel({
    width,
    selectedChannelId,
    tabFocused,
    active,
    dragging,
    dropOverlays,
}: {
    width: number
    selectedChannelId?: string
    tabFocused: boolean
    active: boolean
    dragging: SharedValue<boolean>
    /** Removes the stacked chat and the thread creation over this chat. */
    dropOverlays: () => void
}) {
    const layer = usePanelLayer(width)
    const { x, open, openRef, setShown } = layer
    const session = useSession()
    const ready = useSessionReady()
    // resolveChannelScreens: the foreground chat follows a channel route.
    const [openedChannel, setOpenedChannel] = useState<string>()
    const channelId = selectedChannelId ?? openedChannel
    const [openRequest, setOpenRequest] = useState<OpenRequest>()
    const pendingOpenRequest = useRef<OpenRequest>(undefined)
    const waitingForRows =
        openRequest !== undefined &&
        openRequest.channelId === channelId &&
        openRequest.account === session.userId
    const channelType = useSessionStore(channelsStore, state =>
        channelId ? state.channels[channelId]?.type : undefined,
    )
    const hasChannel = channelType !== undefined
    const forum = hasChannel && THREADS_ONLY_CHANNEL_TYPES.has(channelType)
    const historyNeedsLoad = useSessionStore(messagesStore, state => {
        const history = channelId ? state.channels[channelId] : undefined
        return !history || (history.stale === true && !history.error)
    })
    const historyAvailable = useSessionStore(messagesStore, state => {
        const history = channelId ? state.channels[channelId] : undefined
        return (
            history !== undefined &&
            (history.messages.length > 0 ||
                history.error ||
                (!history.loading && !history.stale && !history.hasMore))
        )
    })

    // MainTabsNavigatorPanel: CHANNEL_PRELOAD for the selected background channel.
    const loadHistory = ready || open || waitingForRows
    useEffect(() => {
        if (
            active &&
            loadHistory &&
            channelId &&
            hasChannel &&
            !forum &&
            historyNeedsLoad
        )
            traced(
                'js:chat:history-preload',
                () => void loadMessages(session, channelId),
            )
    }, [
        active,
        loadHistory,
        channelId,
        hasChannel,
        forum,
        historyNeedsLoad,
        session,
    ])

    const [position, setPosition] = useState<Position>('closed')
    useAnimatedReaction(
        (): Position => {
            if (dragging.get()) return 'moving'
            const offset = x.get()
            if (offset === 0) return 'open'
            if (offset === width) return 'closed'
            return 'moving'
        },
        (next, previous) => {
            if (next !== previous) scheduleOnRN(setPosition, next)
        },
    )
    const [build, setBuild] = useState<{
        id: string
        account: string
        forum: boolean
    }>()
    const drawnBuild = useRef<typeof build>(undefined)
    const built = build?.id === channelId && build?.account === session.userId
    if (
        build &&
        (build.account !== session.userId ||
            build.forum !== forum ||
            (build.forum && build.id !== channelId) ||
            !hasChannel)
    )
        setBuild(undefined)
    const listChannelId =
        !forum && !build?.forum && build?.account === session.userId
            ? build.id
            : undefined
    const [drawn, setDrawn] = useState(false)
    const [exposed, setExposed] = useState(false)
    const rowsVisible = built && exposed
    const settled = open && position === 'open'
    const awaitingRows =
        active && !rowsVisible && (open || position !== 'closed')
    // Time spent sliding or mounting cached rows does not count as loading history.
    const awaitingHistory = settled && (forum || !historyAvailable)
    const [skeletonChannel, setSkeletonChannel] = useState<string>()
    if (skeletonChannel !== undefined && skeletonChannel !== channelId)
        setSkeletonChannel(undefined)
    useEffect(() => {
        if (!awaitingRows || !channelId) {
            setSkeletonChannel(undefined)
            return
        }
        if (!awaitingHistory || skeletonChannel === channelId) return
        const timer = setTimeout(() => {
            traced('js:chat:show-skeleton', () => setSkeletonChannel(channelId))
        }, FIRST_ROWS_BUDGET_MS)
        return () => clearTimeout(timer)
    }, [awaitingRows, awaitingHistory, channelId, skeletonChannel])

    const [warmupSession, setWarmupSession] = useState<typeof session>()
    useEffect(() => {
        if (!ready) return
        const timer = setTimeout(
            () => setWarmupSession(session),
            CHAT_WARMUP_DELAY_MS,
        )
        return () => clearTimeout(timer)
    }, [ready, session])

    // MainTabsNavigatorPanel: warm the new background channel after selection.
    useEffect(() => {
        if (!active || !channelId || !hasChannel || built) return
        const mount = (traceName: string) =>
            traced(traceName, () => {
                setDrawn(false)
                setExposed(false)
                setBuild({ id: channelId, account: session.userId, forum })
            })
        if (
            (waitingForRows || (open && !dragging.get())) &&
            (historyAvailable || forum)
        ) {
            mount(
                listChannelId
                    ? 'js:chat:switch-list-channel'
                    : waitingForRows
                      ? 'js:chat:mount-before-slide'
                      : 'js:chat:mount-after-slide',
            )
            return
        }
        if (
            open ||
            position !== 'closed' ||
            !ready ||
            warmupSession !== session ||
            !historyAvailable ||
            forum
        )
            return

        const idle = requestIdleCallback(() => {
            if (!openRef.current && x.get() === width && !dragging.get())
                mount('js:chat:idle-mount')
        })
        return () => cancelIdleCallback(idle)
    }, [
        active,
        built,
        channelId,
        forum,
        hasChannel,
        historyAvailable,
        listChannelId,
        open,
        openRef,
        position,
        ready,
        session,
        waitingForRows,
        warmupSession,
        width,
        x,
        dragging,
    ])
    const onRowsDrawn = (id: string) => {
        if (!built || id !== channelId || drawn) return
        drawnBuild.current = build
        setDrawn(true)
        if (openRef.current && !pendingOpenRequest.current && !exposed)
            traced('js:chat:rows-exposed', () => setExposed(true))
    }
    // MainTabsChannelScreenStack: only expose completed content.
    useEffect(() => {
        if (!built || !drawn || exposed || waitingForRows) return
        const closed =
            position === 'closed' &&
            !dragging.get() &&
            x.get() === width &&
            !openRef.current
        if (open || closed)
            traced('js:chat:rows-exposed', () => setExposed(true))
    }, [
        built,
        drawn,
        exposed,
        waitingForRows,
        open,
        position,
        dragging,
        x,
        width,
        openRef,
    ])

    // GuildSubscriptionsStore: prefetch the member list for the opened channel.
    useEffect(() => {
        if (built && open && channelId) prefetchMemberList(session, channelId)
    }, [session, built, open, channelId])

    const [openingSlide, setOpeningSlide] = useState<{
        rowsReady: boolean
        swipe: boolean
    }>()
    useEffect(() => {
        if (!openingSlide) return
        setOpeningSlide(undefined)
        if (!openRef.current) return
        const { rowsReady, swipe } = openingSlide
        traced(
            `js:chat:slide-${swipe ? 'swipe' : 'tap'}-${rowsReady ? 'ready' : 'placeholder'}`,
            () => slideTo(x, width, true, swipe),
        )
    }, [openingSlide, openRef, width, x])

    // MainTabsChannelScreenStack: first draw and placeholder reveal.
    useEffect(() => {
        if (!openRequest) return
        if (!waitingForRows || !active || !hasChannel) {
            if (pendingOpenRequest.current === openRequest) {
                pendingOpenRequest.current = undefined
                if (openRequest.swipe && !openRef.current)
                    slideTo(x, width, false, true)
            }
            setOpenRequest(undefined)
            return
        }
        const reveal = (rowsReady: boolean) => {
            if (pendingOpenRequest.current !== openRequest) return
            pendingOpenRequest.current = undefined
            setOpenRequest(undefined)
            if (rowsReady)
                traced('js:chat:rows-exposed', () => setExposed(true))
            else setSkeletonChannel(openRequest.channelId)
            setShown(true)
            setOpeningSlide({ rowsReady, swipe: openRequest.swipe })
        }
        if (built && drawn) return reveal(true)
        const remaining = openRequest.deadline - performance.now()
        const timer = setTimeout(
            () => reveal(built && drawnBuild.current === build),
            Math.max(0, remaining),
        )
        return () => clearTimeout(timer)
    }, [
        openRequest,
        waitingForRows,
        active,
        hasChannel,
        build,
        built,
        drawn,
        openRef,
        setShown,
        width,
        x,
    ])
    const requestOpening = (id: string, swipe = false) => {
        if (openRef.current || pendingOpenRequest.current) return
        traced(swipe ? 'js:chat:swipe-request' : 'js:chat:tap-request', () => {
            const request = {
                channelId: id,
                account: session.userId,
                deadline: performance.now() + FIRST_ROWS_BUDGET_MS,
                swipe,
            }
            pendingOpenRequest.current = request
            setOpenRequest(request)
        })
    }

    const [tapPending, setTapPending] = useState(false)
    // The channel selection and its tap commit together.
    useEffect(() => {
        if (!tapPending || !active || !channelId || !hasChannel) return
        setTapPending(false)
        requestOpening(channelId)
    })

    // A message to scroll to in the channel opened with `openChat`.
    const [jump, setJump] = useState<{ channelId: string; messageId: string }>()
    const show = (id?: string, messageId?: string) => {
        dropOverlays()
        if (id) setOpenedChannel(id)
        setJump(id && messageId ? { channelId: id, messageId } : undefined)
        pendingOpenRequest.current = undefined
        setOpenRequest(undefined)
        if (!openRef.current) setTapPending(true)
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
        pendingOpenRequest.current = undefined
        setOpenRequest(undefined)
        setOpeningSlide(undefined)
        setTapPending(false)
        setShown(false)
        slideTo(x, width, false, false)
    }
    return {
        ...layer,
        channelId,
        hasChannel,
        built,
        listChannelId,
        drawn: rowsVisible,
        showSkeleton: awaitingRows && skeletonChannel === channelId,
        settled,
        forum,
        waitingForRows,
        waitingForSwipe: waitingForRows && openRequest.swipe,
        jump,
        openChat,
        openFromSwipe: (id: string) => requestOpening(id, true),
        close,
        onRowsDrawn,
    }
}

export type ChatPanelState = ReturnType<typeof useChatPanel>
