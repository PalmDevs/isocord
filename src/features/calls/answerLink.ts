import { Linking } from 'react-native'
import { logger } from '../../core/log'
import { linkKind, linkScheme } from '../../native/IsocordConstants'
import { answerCall } from './actions'
import type { Session } from '../../core/session'

const log = logger('Calls')

/** `isocord://call/<channel>`: what native opens when the user answers a ringing call (`Links.call`). */
const CALL_LINK = `${linkScheme}${linkKind.call}/`

/**
 * Joins the call of an answer link, from the one that started the app or one that reaches it running. Returns the
 * cleanup. The channel opener of MainTabs ignores these links.
 */
export function listenForAnswers(session: Session): () => void {
    const answer = (url: string | null | undefined) => {
        if (!url?.startsWith(CALL_LINK)) return
        const channelId = url.slice(CALL_LINK.length)
        if (!channelId) return
        answerCall(session, channelId).catch(error =>
            log.warn('Answer failed', error),
        )
    }
    void Linking.getInitialURL().then(answer)
    const subscription = Linking.addEventListener('url', event =>
        answer(event.url),
    )
    return () => subscription.remove()
}
