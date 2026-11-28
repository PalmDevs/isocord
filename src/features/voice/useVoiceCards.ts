import { useState } from 'react'

/** A voice card's identity: its React key, and the channel it shows. */
export interface VoiceCardSlot {
    key: number
    channelId: string
}

interface VoiceCards {
    /** The call's card, null when not in a call. */
    call: VoiceCardSlot | null
    /** An ended call's card, while its exit plays. */
    ended: VoiceCardSlot | null
    /** The key of the pre-join's card. Joining hands it to the call, so the card morphs instead of remounting. */
    preJoinKey: number
    /** The channel of the pre-join last shown. */
    preJoinChannelId: string | null
    nextKey: number
}

/** Returns the cards after the call moved to `channelId`: joined from the pre-join, ended, moved or started. */
function afterCallChange(cards: VoiceCards, channelId: string | null) {
    const { call, preJoinKey, nextKey } = cards
    if (channelId === null) return { ...cards, call: null, ended: call }
    if (channelId === cards.preJoinChannelId)
        return {
            ...cards,
            call: { key: preJoinKey, channelId },
            ended: call ?? cards.ended,
            preJoinKey: nextKey,
            nextKey: nextKey + 1,
        }
    // A move by the server keeps the call's card and its state.
    if (call) return { ...cards, call: { key: call.key, channelId } }
    return { ...cards, call: { key: nextKey, channelId }, nextKey: nextKey + 1 }
}

/**
 * Returns the voice cards' identities for the call in `callChannelId` and the pre-join shown for
 * `preJoinChannelId`. `clearEnded` drops an ended call's card once its exit has played.
 */
export function useVoiceCards(
    callChannelId: string | null,
    preJoinChannelId: string | null,
) {
    const [cards, setCards] = useState<VoiceCards>(() => ({
        call: callChannelId ? { key: 0, channelId: callChannelId } : null,
        ended: null,
        preJoinKey: 1,
        preJoinChannelId,
        nextKey: 2,
    }))
    // Adjusted while rendering, so a joining pre-join's card never unmounts for a render.
    const callMoved = (cards.call?.channelId ?? null) !== callChannelId
    if (callMoved || cards.preJoinChannelId !== preJoinChannelId) {
        const next = callMoved ? afterCallChange(cards, callChannelId) : cards
        setCards({ ...next, preJoinChannelId })
    }
    return {
        ...cards,
        clearEnded: (key: number) =>
            setCards(current =>
                current.ended?.key === key
                    ? { ...current, ended: null }
                    : current,
            ),
    }
}
