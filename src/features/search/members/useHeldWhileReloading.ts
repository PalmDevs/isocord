import { useState } from 'react'

/**
 * Returns `value`, or while it is undefined the last value seen for the same `key`. A member list dropped by a
 * reconnect (ChannelMemberStore's CONNECTION_OPEN reset) stays on screen until its rows come back, so the list is not
 * swapped for placeholders and keeps its scroll position. Departs from the reference, which shows placeholders.
 */
export function useHeldWhileReloading<T>(
    key: string,
    value: T | undefined,
): T | undefined {
    const [held, setHeld] = useState<{ key: string; value: T }>()
    // Kept while rendering, React's pattern for information from previous renders.
    if (value !== undefined && (held?.key !== key || held.value !== value))
        setHeld({ key, value })
    return value ?? (held?.key === key ? held.value : undefined)
}
