import { ChannelFlags } from '../../core/discord/channelFlags'
import { Permission } from '../../core/discord/permissions'
import { logger } from '../../core/log'
import { showConfirmModal } from '../../design/components/modals/showAlert'
import { t } from '../../i18n'
import { deleteChannel } from '../../stores/channels/channelActions'
import { channelsStore } from '../../stores/channels/channels'
import {
    archiveThread,
    lockThread,
    pinPost,
    threadMetadataOf,
    unarchiveThread,
    unlockThread,
    unpinPost as unpinPostRequest,
} from '../../stores/channels/threadModeration'
import { channelPermissions } from '../../stores/permissions'
import { showToast } from '../toasts'
import { AlertBody } from './AlertBody'
import { isForumPost, threadAccess } from './permissions'
import type { Session } from '../../core/session'
import type { Channel } from '../../stores/channels/channels'

const log = logger('ThreadActions')

const access = (session: Session, thread: Channel) =>
    threadAccess(
        thread,
        channelPermissions(session, thread.id),
        session.userId,
        isForumPost(session, thread),
    )

/** ThreadHooks.useCanManageThread: a moderator, or the owner of a thread that is not locked. */
export const canManageThread = (session: Session, thread: Channel) =>
    access(session, thread).manage

/**
 * ThreadHooks.useCanUnarchiveThread: SEND_MESSAGES_IN_THREADS in the thread and SEND_MESSAGES in its parent. A media
 * thread cannot be unarchived, and a locked one only by a moderator.
 */
export function canUnarchiveThread(session: Session, thread: Channel): boolean {
    const { channels } = session.get(channelsStore).getState()
    const parent = thread.parent_id ? channels[thread.parent_id] : undefined
    if (parent === undefined) return false
    const bits = channelPermissions(session, thread.id)
    const send =
        (bits & Permission.SEND_MESSAGES_IN_THREADS) !== 0n &&
        (bits & Permission.SEND_MESSAGES) !== 0n
    const locked = threadMetadataOf(thread)?.locked === true
    return send && (!locked || access(session, thread).moderator)
}

/** The Close and Open rows: closing needs useCanManageThread, opening useCanUnarchiveThread. */
export const canArchiveThread = (session: Session, thread: Channel) =>
    threadMetadataOf(thread)?.archived
        ? canUnarchiveThread(session, thread)
        : canManageThread(session, thread)

/** The Lock and Unlock rows: useIsThreadModerator. */
export const canLockThread = (session: Session, thread: Channel) =>
    access(session, thread).moderator

/** The Delete row: useIsThreadModerator. */
export const canDeleteThread = canLockThread

/** The Pin Post row: a moderator, on a forum post. */
export const canPinPost = (session: Session, thread: Channel) =>
    access(session, thread).moderator && isForumPost(session, thread)

/** ChannelRecord.hasFlag(PINNED) of a forum post. */
export const isPostPinned = (thread: Channel) =>
    ((thread.flags ?? 0) & ChannelFlags.PINNED) !== 0

/** Runs a write and tells the user when it fails. */
async function attempt(request: Promise<unknown>): Promise<void> {
    try {
        await request
    } catch (error) {
        log.warn('Could not change the thread', error)
        showToast({
            key: 'thread-action-error',
            variant: 'critical',
            content: t('channelSettings.saveError'),
        })
    }
}

/** The Close Thread and Open Thread rows: archiveThread, unarchiveThread. */
export function toggleArchive(
    session: Session,
    thread: Channel,
): Promise<void> {
    return attempt(
        threadMetadataOf(thread)?.archived
            ? unarchiveThread(session, thread)
            : archiveThread(session, thread),
    )
}

/** The Lock and Unlock rows: lockThread, unlockThread. */
export function toggleLock(session: Session, thread: Channel): Promise<void> {
    return attempt(
        threadMetadataOf(thread)?.locked
            ? unlockThread(session, thread)
            : lockThread(session, thread),
    )
}

/** The Unpin Post row: ThreadActionCreators.unpin. */
export const unpinPost = (session: Session, thread: Channel) =>
    attempt(unpinPostRequest(session, thread))

/** The pinned post of the thread's forum, other than the thread (useExistingPin). */
function existingPin(session: Session, thread: Channel): Channel | undefined {
    const { channels } = session.get(channelsStore).getState()
    return Object.values(channels).find(
        channel =>
            channel.id !== thread.id &&
            channel.parent_id === thread.parent_id &&
            isPostPinned(channel),
    )
}

/**
 * The Pin Post row: pins at once, or asks first when the forum has a pinned post, which the pin replaces
 * (ThreadActionCreators.replacePin).
 */
export function confirmPinPost(session: Session, thread: Channel): void {
    const pinned = existingPin(session, thread)
    if (!pinned) {
        void attempt(pinPost(session, thread))
        return
    }
    showConfirmModal({
        key: 'pin-post',
        title: t('threadActions.pinPostTitle'),
        content: <AlertBody textKey="threadActions.pinPostBody" values={{}} />,
        confirmText: t('threadActions.yes'),
        cancelText: t('threadActions.no'),
        variant: 'primary',
        onConfirm: () =>
            attempt(
                unpinPostRequest(session, pinned).then(() =>
                    pinPost(session, thread),
                ),
            ),
    })
}

/** The Delete Thread and Delete Post alert: asks, then deletes the channel. */
export function confirmDeleteThread(session: Session, thread: Channel): void {
    const post = isForumPost(session, thread)
    const name = thread.name ?? ''
    showConfirmModal({
        key: 'delete-thread',
        title: t(
            post ? 'threadActions.deletePost' : 'threadActions.deleteThread',
        ),
        content: (
            <AlertBody
                textKey={
                    post
                        ? 'threadActions.deletePostBody'
                        : 'threadActions.deleteThreadBody'
                }
                // The post alert quotes the title.
                values={
                    post ? { postName: `"${name}"` } : { channelName: name }
                }
            />
        ),
        confirmText: t('threadActions.yes'),
        cancelText: t('threadActions.no'),
        onConfirm: () => attempt(deleteChannel(session, thread.id)),
    })
}
