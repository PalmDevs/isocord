// TODO: Move this out of the chat feature

import { useState } from 'react'

/**
 * Merges `items` into the rows on screen: kept rows hold their order, new ones fill the empty slots above them,
 * the rest go below the fold. Rows the new list lacks stay, as the result cap is what drops them.
 */
function merge<T extends { key: string }>(
    shown: T[],
    items: T[],
    visible: number,
): T[] {
    const fresh = new Map(items.map(item => [item.key, item]))
    const kept = shown.map(item => fresh.get(item.key) ?? item)
    const keptKeys = new Set(kept.map(item => item.key))
    const added = items.filter(item => !keptKeys.has(item.key))
    const room = Math.max(visible - kept.length, 0)
    return [...added.slice(0, room), ...kept, ...added.slice(room)]
}

/**
 * Returns the rows to draw for `items`.
 * While `query` stays the same, a change comes from the network (members arriving from the gateway), so the rows
 * on screen stay put: the box grows from its bottom edge, and new rows only take slots that move nothing.
 * Not in the reference, which re-ranks in place and moves rows under the finger.
 */
export function useSteadyRows<T extends { key: string }>(
    items: T[] | null,
    query: string | null,
    visible: number,
) {
    const [held, setHeld] = useState({ query, items, shown: items })
    let shown = held.shown
    if (held.items !== items) {
        shown =
            items && held.shown && query !== null && held.query === query
                ? merge(held.shown, items, visible)
                : items
        setHeld({ query, items, shown })
    }

    return shown
}
