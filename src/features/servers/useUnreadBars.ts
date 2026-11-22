import { useState } from 'react'
import type { ViewToken } from '@shopify/flash-list'

/** An unread or mentioned row with its index in the full FlashList data. */
export interface BarRow {
    index: number
    mention: boolean
}

export interface UnreadBarsState {
    /** The out-of-view target and which edge points at it, or null while everything is visible. */
    target: { row: BarRow; edge: 'top' | 'bottom' } | null
    /** FlashList's onViewableItemsChanged; pass it straight to the list. */
    onViewableItemsChanged: (info: {
        viewableItems: Array<Pick<ViewToken<unknown>, 'index'>>
    }) => void
    /** FlashList's viewabilityConfig for the handler above. */
    viewabilityConfig: {
        itemVisiblePercentThreshold: number
        minimumViewTime: number
    }
    /** Updates visibility for a list with an overlay. */
    setVisibleRange: (first: number, last: number) => void
    /** Scrolls the list to the current target, centered (the reference's scrollToLocation). */
    jump: (scrollToIndex: (index: number) => void) => void
}

// ChannelsUnreadBars visibility cutoff for partially clipped rows.
export const UNREAD_BAR_VISIBLE_FRACTION = 0.75

// RedesignChannelListConstants.VIEWABILITY_CONFIG: 25 ms settled.
const VIEWABILITY = {
    itemVisiblePercentThreshold: UNREAD_BAR_VISIBLE_FRACTION * 100,
    minimumViewTime: 25,
} as const

/** Finds the ChannelsUnreadBars target among offscreen rows. */
export function findUnreadBarTarget(
    rows: readonly BarRow[],
    firstVisible: number,
    lastVisible: number,
): UnreadBarsState['target'] {
    let top: BarRow | undefined
    let bottom: BarRow | undefined
    for (const row of rows) {
        if (row.index < firstVisible && (row.mention || !top?.mention)) {
            top = row
        } else if (
            row.index > lastVisible &&
            (!bottom || (row.mention && !bottom.mention))
        ) {
            bottom = row
        }
    }
    if (top && (top.mention || !bottom?.mention))
        return { row: top, edge: 'top' }
    if (bottom) return { row: bottom, edge: 'bottom' }
    return null
}

/** Wires a channel or conversation list to the unread bars. */
export function useUnreadBars(rows: BarRow[]): UnreadBarsState {
    const [range, setRange] = useState<{ first: number; last: number } | null>(
        null,
    )
    const target = range && findUnreadBarTarget(rows, range.first, range.last)
    const setVisibleRange = (first: number, last: number) => {
        setRange(previous => {
            if (first > last) return null
            if (previous?.first === first && previous.last === last)
                return previous
            return { first, last }
        })
    }

    return {
        target,
        onViewableItemsChanged: ({ viewableItems }) => {
            const indexes = viewableItems
                .map(token => token.index)
                .filter((index): index is number => index !== null)
            setVisibleRange(Math.min(...indexes), Math.max(...indexes))
        },
        viewabilityConfig: VIEWABILITY,
        setVisibleRange,
        jump: scrollToIndex => {
            if (target) scrollToIndex(target.row.index)
        },
    }
}
