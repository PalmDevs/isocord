import { flushEnqueuedRing } from './actions'
import { listenForAnswers } from './answerLink'
import { callsStore } from './calls'
import type { Feature } from '../../core/feature'

/**
 * Calls in DMs and group DMs: the calls store, the ring that waits for its call, and answering a ring from native's
 * call screen. Starting is in the DM header (`CallHeaderButton`), the joined call is the voice feature's.
 */
export const callsFeature: Feature = {
    name: 'calls',
    stores: [callsStore],
    setup: session => {
        const offCreate = session.gateway.dispatch.on('CALL_CREATE', call =>
            flushEnqueuedRing(session, call.channel_id),
        )
        const offAnswers = listenForAnswers(session)
        return () => {
            offCreate()
            offAnswers()
        }
    },
}
