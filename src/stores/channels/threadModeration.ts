import { Endpoint } from '../../core/api/paths'
import { ChannelFlags } from '../../core/discord/channelFlags'
import type { ThreadMetadata } from '../../core/discord/threads'
import type { Session } from '../../core/session'
import type { Channel } from './channels'

/** The thread's metadata, with the fields the settings edit. */
export const threadMetadataOf = (thread: Channel) =>
    thread.thread_metadata as ThreadMetadata | undefined

/** Patches a thread and puts the result in the store at once, as ThreadActionCreators.patchThread does. */
async function patchThread(
    session: Session,
    thread: Channel,
    body: object,
): Promise<Channel> {
    const updated = await session.rest.patch<Channel>(
        Endpoint.channel(thread.id),
        { body },
    )
    session.gateway.dispatch.emit('THREAD_UPDATE', updated)
    return updated
}

/** ThreadActionCreators.archiveThread: `lock` also locks it. */
export function archiveThread(
    session: Session,
    thread: Channel,
    lock = false,
): Promise<Channel> {
    return patchThread(session, thread, {
        archived: true,
        ...(lock && { locked: true }),
    })
}

/** ThreadActionCreators.unarchiveThread: `unlock` also unlocks it. */
export function unarchiveThread(
    session: Session,
    thread: Channel,
    unlock = false,
): Promise<Channel> {
    return patchThread(session, thread, {
        archived: false,
        ...(unlock && { locked: false }),
    })
}

/**
 * Locks or unlocks (ThreadActionCreators.lockThread, unlockThread). An archived thread is unarchived first, since the
 * server refuses to edit it, and archived again with the new lock state.
 */
async function setLocked(
    session: Session,
    thread: Channel,
    locked: boolean,
): Promise<Channel> {
    const archived = threadMetadataOf(thread)?.archived === true
    if (archived) await unarchiveThread(session, thread, !locked)
    return patchThread(session, thread, { locked, archived })
}

export const lockThread = (session: Session, thread: Channel) =>
    setLocked(session, thread, true)

export const unlockThread = (session: Session, thread: Channel) =>
    setLocked(session, thread, false)

/**
 * ThreadActionCreators.updateFlags: the thread shows the new flags at once, an archived one is unarchived with them,
 * and the old flags come back when the request fails.
 */
async function updateFlags(
    session: Session,
    thread: Channel,
    flags: number,
    unarchive: boolean,
): Promise<void> {
    session.gateway.dispatch.emit('THREAD_UPDATE', { ...thread, flags })
    try {
        await session.rest.patch(Endpoint.channel(thread.id), {
            body: { flags, ...(unarchive && { archived: false }) },
        })
    } catch (error) {
        session.gateway.dispatch.emit('THREAD_UPDATE', thread)
        throw error
    }
}

/** ThreadActionCreators.pin. */
export const pinPost = (session: Session, thread: Channel) =>
    updateFlags(
        session,
        thread,
        (thread.flags ?? 0) | ChannelFlags.PINNED,
        threadMetadataOf(thread)?.archived === true,
    )

/** ThreadActionCreators.unpin. */
export const unpinPost = (session: Session, thread: Channel) =>
    updateFlags(
        session,
        thread,
        (thread.flags ?? 0) & ~ChannelFlags.PINNED,
        false,
    )
