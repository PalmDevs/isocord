import { Endpoint } from '../../../core/api/paths'
import type { Session } from '../../../core/session'

/** Discord shows typing for 10 seconds. The reference client renews it every 8 (0.8 of that). */
const TYPING_INTERVAL = 8000

/** When each channel was last told the user is typing, by session. */
const lastTyping = new WeakMap<Session, Map<string, number>>()

/** Tells the server the user is typing, at most once per interval and channel. */
export function startTyping(session: Session, channelId: string): void {
    let sent = lastTyping.get(session)
    if (!sent) {
        sent = new Map()
        lastTyping.set(session, sent)
    }
    const now = Date.now()
    if (now - (sent.get(channelId) ?? 0) < TYPING_INTERVAL) return
    sent.set(channelId, now)
    session.rest.post(Endpoint.channelTyping(channelId)).catch(() => {
        // Only a courtesy. The next keystroke after the interval tries again.
        sent.delete(channelId)
    })
}
