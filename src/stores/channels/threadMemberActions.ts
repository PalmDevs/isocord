// Writes of the user's membership of a thread, as the reference's ThreadActionCreators do.

import { Endpoint } from '../../core/api/paths'
import { logger } from '../../core/log'
import { muteSettings } from '../settings/notificationActions'
import { channelsStore } from './channels'
import type {
    ThreadMember,
    ThreadNotificationChange,
} from '../../core/discord/threadMember'
import type { Session } from '../../core/session'
import type { Channel } from './channels'

const log = logger('ThreadMembers')

/** The `location` the reference sends when changing a thread's settings joins it (analytics only). */
const SETTINGS_JOIN_LOCATION = 'Change Notification Settings'

/** JoinedThreadsStore.hasJoined: the user is a member of the thread. */
export const isThreadJoined = (thread: Channel): boolean =>
    thread.member !== undefined

/**
 * ThreadActionCreators.joinThread: asks to join. The gateway's THREAD_MEMBER_UPDATE puts the membership in the
 * store. Resolves false when the request fails.
 */
export async function joinThread(
    session: Session,
    thread: Channel,
    location?: string,
): Promise<boolean> {
    try {
        await session.rest.post(Endpoint.myThreadMember(thread.id), {
            query: { location },
        })
        return true
    } catch (error) {
        log.warn('Could not join the thread', error)
        return false
    }
}

/**
 * ThreadActionCreators.leaveThread: asks to leave. The gateway's THREAD_MEMBERS_UPDATE takes the thread off the list.
 * Resolves false when the request fails.
 */
export async function leaveThread(
    session: Session,
    thread: Channel,
    location?: string,
): Promise<boolean> {
    try {
        await session.rest.delete(Endpoint.myThreadMember(thread.id), {
            query: { location },
        })
        return true
    } catch (error) {
        log.warn('Could not leave the thread', error)
        return false
    }
}

/** Puts a change into the thread's membership, joined or not yet, as the gateway's update will. */
function applyChange(
    session: Session,
    thread: Channel,
    change: ThreadNotificationChange,
): void {
    session.get(channelsStore).setState(state => {
        const held = state.channels[thread.id]
        if (!held) return state
        const member: ThreadMember = {
            flags: 0,
            join_timestamp: new Date().toISOString(),
            ...held.member,
            ...change,
        }
        return {
            channels: { ...state.channels, [thread.id]: { ...held, member } },
        }
    })
}

/**
 * ThreadActionCreators.setNotificationSettings: joins the thread first when the user has not, applies the change at
 * once, then saves it.
 */
export async function setThreadNotificationSettings(
    session: Session,
    thread: Channel,
    change: ThreadNotificationChange,
): Promise<void> {
    if (
        !isThreadJoined(thread) &&
        !(await joinThread(session, thread, SETTINGS_JOIN_LOCATION))
    )
        return
    applyChange(session, thread, change)
    try {
        await session.rest.patch(Endpoint.myThreadMemberSettings(thread.id), {
            body: change,
        })
    } catch (error) {
        log.warn('Could not save the thread settings', error)
    }
}

/** MuteSettingsUtils.handleMuteSettingPress for a thread: mutes it for `seconds`. */
export function muteThread(
    session: Session,
    thread: Channel,
    seconds: number,
): Promise<void> {
    return setThreadNotificationSettings(session, thread, muteSettings(seconds))
}

/** MuteSettingsUtils.handleUnmutePress for a thread. */
export function unmuteThread(session: Session, thread: Channel): Promise<void> {
    return setThreadNotificationSettings(session, thread, { muted: false })
}
