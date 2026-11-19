import { useRef, useState } from 'react'
import { dismissComposers } from '../composer'
import { slideTo } from './slide'
import { usePanelLayer } from './usePanelLayer'
import type { SearchTab } from '../../search/types'

/** Longest the slide-in waits for the details to be ready (the topic's height, the selected page's layout). */
const READY_TIMEOUT_MS = 400

/** The channel details panel, slid in over the chat from its header or a swipe. */
export function useDetailsPanel(width: number) {
    const layer = usePanelLayer(width)
    const { x, openRef } = layer
    const [mounted, setMounted] = useState(false)
    const [search, setSearch] = useState(false)
    const [guildSearch, setGuildSearch] = useState(false)
    const [tab, setTab] = useState<SearchTab>()
    // Remounts the details, so each opening starts from the buttons and an empty search.
    const [key, setKey] = useState(0)
    // The slide-in is held until the details say they are ready (the native topic has no height before).
    const slidePending = useRef(false)
    // The pages beside the selected one wait for the slide to end: built during it, they dropped its frames.
    const [waiting, setWaiting] = useState(false)
    const readyTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
    const startSlide = () => {
        if (!slidePending.current) return
        slidePending.current = false
        slideTo(x, width, true, false, () => setWaiting(false))
    }
    const setShown = (show: boolean) => {
        layer.setShown(show)
        if (show) setMounted(true)
    }
    const closed = () => {
        if (openRef.current) return
        setKey(k => k + 1)
        setMounted(false)
    }
    const show = (
        initialSearch = false,
        initialGuildSearch = false,
        initialTab?: SearchTab,
    ) => {
        // A second tap while sliding in would remount the shown details, blank until the topic measures again.
        if (openRef.current) return
        dismissComposers()
        setSearch(initialSearch)
        setGuildSearch(initialGuildSearch)
        setTab(initialTab)
        setKey(k => k + 1)
        setShown(true)
        slidePending.current = true
        setWaiting(true)
        // A timer left from an earlier open would start this slide early.
        clearTimeout(readyTimer.current)
        readyTimer.current = setTimeout(() => {
            startSlide()
        }, READY_TIMEOUT_MS)
    }
    const close = () => {
        slidePending.current = false
        setWaiting(false)
        setShown(false)
        slideTo(x, width, false, false, closed)
    }
    /** Slides the details away, then runs `then` (a channel pick, the thread creation). */
    const slideAway = (then: () => void) => {
        slidePending.current = false
        setWaiting(false)
        setShown(false)
        slideTo(x, width, false, false, () => {
            closed()
            then()
        })
    }
    /** Removes the details at once. */
    const reset = () => {
        slidePending.current = false
        setWaiting(false)
        layer.setShown(false)
        setMounted(false)
        x.set(width)
    }
    return {
        ...layer,
        setShown,
        mounted,
        search,
        guildSearch,
        tab,
        key,
        waiting,
        closed,
        startSlide,
        show,
        close,
        slideAway,
        reset,
    }
}

export type DetailsPanel = ReturnType<typeof useDetailsPanel>
