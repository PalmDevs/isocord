import { useEffect, useRef, useState } from 'react'
import { cancelAnimation, makeMutable } from 'react-native-reanimated'
import { useSession, useSessionStore } from '../../../core/react'
import { channelsStore } from '../../../stores/channels/channels'
import { prefetchMemberList } from '../../../stores/memberList'
import { dismissComposers } from '../composer'
import { DRAW_TIMEOUT_MS, slideTo } from './slide'
import type { SharedValue } from 'react-native-reanimated'

export interface StackedEntry {
    key: number
    channelId: string
    jump?: { messageId: string }
    x: SharedValue<number>
    open: boolean
    openRef: { current: boolean }
    waiting: boolean
    waitingRef: { current: boolean }
}

function findLastOpen(entries: StackedEntry[]): StackedEntry | undefined {
    for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i]
        if (entry?.openRef.current) return entry
    }
    return undefined
}

/**
 * Channels stacked over the chat (channel mentions, message links, forum posts or created threads). Each opens in
 * its own sliding panel so swiping right or back returns through the stack.
 */
export function useStackedChat(width: number, resetDetails: () => void) {
    const session = useSession()
    const [entries, setEntries] = useState<StackedEntry[]>([])
    const entriesRef = useRef(entries)
    const nextKey = useRef(0)
    const timersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>())
    const openRef = useRef(false)
    const topOpenRef = useRef<StackedEntry | undefined>(undefined)

    const syncEntries = (next: StackedEntry[]) => {
        entriesRef.current = next
        const topOpen = findLastOpen(next)
        topOpenRef.current = topOpen
        openRef.current = topOpen !== undefined
        setEntries(next)
    }

    const clearTimer = (key: number) => {
        const timer = timersRef.current.get(key)
        if (!timer) return
        clearTimeout(timer)
        timersRef.current.delete(key)
    }

    const reveal = (key: number) => {
        clearTimer(key)
        const current = entriesRef.current
        const entry = current.find(item => item.key === key)
        if (!entry?.waitingRef.current || !entry.openRef.current) return
        entry.waitingRef.current = false
        syncEntries(
            current.map(item =>
                item.key === key ? { ...item, waiting: false } : item,
            ),
        )
        slideTo(entry.x, width, true, false)
    }

    const closed = (key: number) => {
        clearTimer(key)
        const current = entriesRef.current
        const entry = current.find(item => item.key === key)
        if (!entry || entry.openRef.current) return
        cancelAnimation(entry.x)
        syncEntries(current.filter(item => item.key !== key))
    }

    const show = (id: string, messageId?: string) => {
        dismissComposers()
        resetDetails()
        const current = entriesRef.current
        const last = current.at(-1)
        // Ignore a second tap on the same channel before its slide starts.
        if (last?.waitingRef.current && last.channelId === id) {
            if (messageId)
                syncEntries(
                    current.map(item =>
                        item.key === last.key
                            ? { ...item, jump: { messageId } }
                            : item,
                    ),
                )
            return
        }
        const key = ++nextKey.current
        const entry: StackedEntry = {
            key,
            channelId: id,
            jump: messageId ? { messageId } : undefined,
            x: makeMutable(width),
            open: true,
            openRef: { current: true },
            waiting: true,
            waitingRef: { current: true },
        }
        syncEntries([...current, entry])
        timersRef.current.set(
            key,
            setTimeout(() => reveal(key), DRAW_TIMEOUT_MS),
        )
    }

    /** Switches the topmost open panel to `id` in place (used when picking a channel in its details). */
    const replace = (id: string) => {
        dismissComposers()
        resetDetails()
        const target = topOpenRef.current
        if (!target) return show(id)
        clearTimer(target.key)
        cancelAnimation(target.x)
        target.openRef.current = true
        target.waitingRef.current = false
        target.x.set(0)
        syncEntries(
            entriesRef.current.map(item =>
                item.key === target.key
                    ? {
                          ...item,
                          channelId: id,
                          jump: undefined,
                          open: true,
                          waiting: false,
                      }
                    : item,
            ),
        )
    }

    /** Jumps the topmost open panel to `messageId` in place (used when jumping from its details). */
    const jumpTo = (messageId?: string) => {
        const target = topOpenRef.current
        if (!target || !messageId) return
        syncEntries(
            entriesRef.current.map(item =>
                item.key === target.key
                    ? { ...item, jump: { messageId } }
                    : item,
            ),
        )
    }

    const setEntryShown = (key: number, shown: boolean) => {
        const current = entriesRef.current
        const entry = current.find(item => item.key === key)
        if (!entry) return
        entry.openRef.current = shown
        syncEntries(
            current.map(item =>
                item.key === key ? { ...item, open: shown } : item,
            ),
        )
    }

    const close = (key = topOpenRef.current?.key) => {
        if (key === undefined) return
        const current = entriesRef.current
        const entry = current.find(item => item.key === key)
        if (!entry) return
        const wasWaiting = entry.waitingRef.current
        clearTimer(key)
        dismissComposers()
        resetDetails()
        entry.waitingRef.current = false
        entry.openRef.current = false
        if (wasWaiting) {
            cancelAnimation(entry.x)
            syncEntries(current.filter(item => item.key !== key))
            return
        }
        syncEntries(
            current.map(item =>
                item.key === key
                    ? { ...item, open: false, waiting: false }
                    : item,
            ),
        )
        slideTo(entry.x, width, false, false, () => closed(key))
    }

    /** Removes every stacked panel at once (the chat under them closes or shows another channel). */
    const drop = () => {
        for (const key of [...timersRef.current.keys()]) clearTimer(key)
        for (const entry of entriesRef.current) {
            entry.openRef.current = false
            entry.waitingRef.current = false
            cancelAnimation(entry.x)
            entry.x.set(width)
        }
        syncEntries([])
    }

    /** Shows a chat that is already drawn elsewhere, without waiting for it. */
    const showAtOnce = (id: string) => {
        const key = ++nextKey.current
        const entry: StackedEntry = {
            key,
            channelId: id,
            x: makeMutable(0),
            open: true,
            openRef: { current: true },
            waiting: false,
            waitingRef: { current: false },
        }
        syncEntries([...entriesRef.current, entry])
    }

    const onRowsDrawn = (key: number, id: string) => {
        const entry = entriesRef.current.find(item => item.key === key)
        if (entry?.waitingRef.current && entry.channelId === id) reveal(key)
    }

    const topOpen = findLastOpen(entries)
    const topOpenChannelId = topOpen?.channelId
    useEffect(() => {
        if (topOpenChannelId) prefetchMemberList(session, topOpenChannelId)
    }, [session, topOpenChannelId])

    // Any channel that went away drops its panel and everything stacked above it.
    const missingKey = useSessionStore(
        channelsStore,
        state =>
            entries.find(entry => !(entry.channelId in state.channels))?.key,
    )
    // biome-ignore lint/correctness/useExhaustiveDependencies: drop only uses refs, setters and shared values
    useEffect(() => {
        if (missingKey === undefined) return
        const current = entriesRef.current
        const index = current.findIndex(entry => entry.key === missingKey)
        if (index === -1) return
        for (const entry of current.slice(index)) {
            clearTimer(entry.key)
            entry.openRef.current = false
            entry.waitingRef.current = false
            cancelAnimation(entry.x)
            entry.x.set(width)
        }
        syncEntries(current.slice(0, index))
    }, [missingKey, width])

    useEffect(() => {
        return () => {
            for (const timer of timersRef.current.values()) clearTimeout(timer)
            timersRef.current.clear()
            for (const entry of entriesRef.current) cancelAnimation(entry.x)
        }
    }, [])

    return {
        entries,
        top: entries.at(-1),
        topOpen,
        topOpenRef,
        open: topOpen !== undefined,
        openRef,
        waiting: entries.some(entry => entry.waiting),
        closed,
        setEntryShown,
        show,
        replace,
        jumpTo,
        close,
        drop,
        showAtOnce,
        onRowsDrawn,
    }
}

export type StackedChat = ReturnType<typeof useStackedChat>
