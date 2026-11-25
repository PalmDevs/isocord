import { Endpoint } from '../../core/api/paths'
import { ApiError } from '../../core/api/rest'
import { logger } from '../../core/log'
import { defineStore } from '../../core/session'
import { canViewChannel } from '../permissions'
import { channelsStore, holdThread, isThread } from './channels'
import { threadsStore } from './threads'
import type { Session } from '../../core/session'
import type { Channel } from './channels'

const log = logger('LinkedChannels')

/**
 * LazyLoadedThreadManager: the channels a message links to that the client does not hold, fetched once each.
 * Holds the ids asked for; READY drops held threads, so it starts over (the reference's CONNECTION_OPEN).
 */
export const linkedChannelsStore = defineStore('linkedChannels', session => {
    const asked = new Set<string>()
    session.gateway.dispatch.on('READY', () => asked.clear())
    return asked
})

/** Fetches a channel and holds it when it is a viewable thread. Resolves whether it was held. */
async function fetchThread(session: Session, id: string): Promise<boolean> {
    const channel = await session.rest.get<Channel>(Endpoint.channel(id))
    // The reference only adds threads (THREAD_CREATE). It would hold any other channel already.
    if (!isThread(channel) || !canViewChannel(session, channel)) return false
    holdThread(session, channel)
    return true
}

/**
 * Holds a tapped channel the client does not hold, from the active threads or the API. Resolves whether it can open.
 * The reference navigates to the channel route, which loads the thread (handleMessagesTapChannel).
 */
export async function holdLinkedChannel(
    session: Session,
    id: string,
): Promise<boolean> {
    const existing = session.get(channelsStore).getState().channels[id]
    if (existing) return canViewChannel(session, existing)
    const active = session.get(threadsStore).getState().active[id]
    if (active) {
        if (!canViewChannel(session, active)) return false
        holdThread(session, active)
        return true
    }
    try {
        return await fetchThread(session, id)
    } catch (error) {
        // No access or no such channel.
        if (!(error instanceof ApiError))
            log.warn(`Could not load linked channel: ${error}`)
        return false
    }
}

/**
 * LazyLoadedThreadManager.loadThread: fetches channels the client does not hold, such as archived or unjoined threads
 * and posts. A thread the user can see is held, which rebuilds the rows that link to it. One they cannot see stays
 * unknown and is not asked for again.
 */
export function loadLinkedChannels(session: Session, ids: Iterable<string>) {
    if (session.gateway.state !== 'connected') return
    const asked = session.get(linkedChannelsStore)
    const { channels } = session.get(channelsStore).getState()
    for (const id of ids) {
        if (channels[id] || asked.has(id)) continue
        asked.add(id)
        fetchThread(session, id).catch(error => {
            // No access or no such channel stays unknown. Anything else may work at the next build.
            if (error instanceof ApiError) return
            log.warn(`Could not load linked channel: ${error}`)
            asked.delete(id)
        })
    }
}
