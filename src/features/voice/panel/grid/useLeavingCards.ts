import { useState } from 'react'
import type { CardFrame } from './gridLayout'

/** A card on screen: still in the call, or leaving at its last frame (TransitionStates.YEETED). */
export interface ShownCard<T> {
    key: string
    item: T
    frame: CardFrame
    leaving: boolean
}

/** Returns a signature of the cards and their frames, to tell when they changed. */
const signatureOf = <T>(cards: readonly ShownCard<T>[]) =>
    cards
        .map(({ key, frame }) =>
            [key, frame.x, frame.y, frame.width, frame.height].join(':'),
        )
        .join()

/**
 * VoicePanelCardView's transition group: returns `cards` and the ones that left, which stay at their last frame
 * until `remove` drops them once their exit has played. A card that comes back stops leaving.
 */
export function useLeavingCards<T>(cards: readonly ShownCard<T>[]) {
    const signature = signatureOf(cards)
    const [previous, setPrevious] = useState({ signature, cards })
    const [leaving, setLeaving] = useState<readonly ShownCard<T>[]>([])
    // Adjusted while rendering, so a leaving card never unmounts for a render.
    if (previous.signature !== signature) {
        const keys = new Set(cards.map(card => card.key))
        const gone = previous.cards.filter(card => !keys.has(card.key))
        setPrevious({ signature, cards })
        setLeaving(current => [
            ...current.filter(card => !keys.has(card.key)),
            ...gone.map(card => ({ ...card, leaving: true })),
        ])
    }
    const keys = new Set(cards.map(card => card.key))
    return {
        shown: [...cards, ...leaving.filter(card => !keys.has(card.key))],
        remove: (key: string) =>
            setLeaving(current => current.filter(card => card.key !== key)),
    }
}
