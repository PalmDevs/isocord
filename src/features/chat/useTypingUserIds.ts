import { useSessionStore } from '../../core/react'
import { typingStore, typingUserIds } from '../../stores/typing'

/** useTypingUserIds: the users typing in a channel (never the current user), the first `max` of them. */
export function useTypingUserIds(
    channelId: string,
    max = Number.MAX_SAFE_INTEGER,
): readonly string[] {
    const ids = useSessionStore(typingStore, state =>
        typingUserIds(state, channelId),
    )
    return ids.length > max ? ids.slice(0, max) : ids
}
