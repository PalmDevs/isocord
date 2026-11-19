import { channelPermalink } from '../../core/discord/permalink'
import { t } from '../../i18n'
import {
    isThreadJoined,
    joinThread,
    leaveThread,
} from '../../stores/channels/threadMemberActions'
import {
    canArchiveThread,
    canDeleteThread,
    canEditChannel,
    canLockThread,
    canPinPost,
    confirmDeleteThread,
    confirmPinPost,
    isPostPinned,
    openEditChannel,
    toggleArchive,
    toggleLock,
    unpinPost,
} from '../channelSettings'
import { copy } from '../chat/longPress/messageActionRows'
import { copyIdAction, muteActions, readActions } from './rows'
import type { ChannelAction, ChannelActionEnv } from './rows'

/** ThreadActionCreators.joinThread and leaveThread: the `location` of the long press sheet. */
const CONTEXT_MENU_LOCATION = 'Context Menu'

/** The Join Thread, Follow Post and their leave rows (ThreadLongPressActionSheet, LongPressForumPostActionSheet). */
function membershipAction({
    session,
    channel,
    forumPost,
}: ChannelActionEnv): ChannelAction {
    if (isThreadJoined(channel))
        return {
            key: 'leave',
            label: t(
                forumPost
                    ? 'threadActions.unfollowPost'
                    : 'threadActions.leaveThread',
            ),
            icon: 'UserMinusIcon',
            isDestructive: !forumPost,
            onPress: () =>
                void leaveThread(session, channel, CONTEXT_MENU_LOCATION),
        }
    return {
        key: 'join',
        label: t(
            forumPost ? 'threadActions.followPost' : 'threadActions.joinThread',
        ),
        icon: forumPost ? 'BellIcon' : 'GroupPlusIcon',
        onPress: () => void joinThread(session, channel, CONTEXT_MENU_LOCATION),
    }
}

/** The Close and Open row, then Lock and Unlock. */
function stateActions(env: ChannelActionEnv): ChannelAction[] {
    const { session, channel, forumPost } = env
    const actions: ChannelAction[] = []
    if (canArchiveThread(session, channel)) {
        const archived = channel.thread_metadata?.archived === true
        const key = archived
            ? forumPost
                ? 'threadActions.openPost'
                : 'threadActions.openThread'
            : forumPost
              ? 'threadActions.closePost'
              : 'threadActions.closeThread'
        actions.push({
            key: 'archive',
            label: t(key),
            icon: archived ? 'ClockIcon' : 'XLargeIcon',
            onPress: () => void toggleArchive(session, channel),
        })
    }
    if (canLockThread(session, channel)) {
        const locked = channel.thread_metadata?.locked === true
        const key = locked
            ? forumPost
                ? 'threadActions.unlockPost'
                : 'threadActions.unlockThread'
            : forumPost
              ? 'threadActions.lockPost'
              : 'threadActions.lockThread'
        actions.push({
            key: 'lock',
            label: t(key),
            icon: locked ? 'LockUnlockedIcon' : 'LockIcon',
            onPress: () => void toggleLock(session, channel),
        })
    }
    return actions
}

/** The "channel-actions" section: membership, Close, Lock, Edit Thread or Post Settings, Copy Link. */
function channelRows(env: ChannelActionEnv): ChannelAction[] {
    const { session, channel, navigation, forumPost } = env
    const actions: ChannelAction[] = [
        membershipAction(env),
        ...stateActions(env),
    ]
    if (canEditChannel(session, channel))
        actions.push({
            key: 'edit',
            label: t(
                forumPost
                    ? 'channelSettings.postSettingsTitle'
                    : 'threadActions.editThread',
            ),
            icon: forumPost ? 'SettingsIcon' : 'PencilIcon',
            onPress: () => openEditChannel(navigation, channel.id),
        })
    actions.push({
        key: 'copyLink',
        label: t('chat.linkOptions.copyLink'),
        icon: 'LinkIcon',
        onPress: () =>
            copy(channelPermalink(channel.guild_id, channel.id), 'link'),
    })
    return actions
}

/** The "admin-actions" section: Pin Post or Unpin Post of a post, then the destructive Delete. */
function adminRows(env: ChannelActionEnv): ChannelAction[] {
    const { session, channel, forumPost } = env
    const actions: ChannelAction[] = []
    if (canPinPost(session, channel)) {
        const pinned = isPostPinned(channel)
        actions.push({
            key: 'pinPost',
            label: t(
                pinned ? 'threadActions.unpinPost' : 'threadActions.pinPost',
            ),
            icon: 'PinIcon',
            onPress: () =>
                pinned
                    ? void unpinPost(session, channel)
                    : confirmPinPost(session, channel),
        })
    }
    if (canDeleteThread(session, channel))
        actions.push({
            key: 'delete',
            label: t(
                forumPost
                    ? 'threadActions.deletePost'
                    : 'threadActions.deleteThread',
            ),
            icon: 'TrashIcon',
            isDestructive: true,
            onPress: () => confirmDeleteThread(session, channel),
        })
    return actions
}

/**
 * getActionSheetButtons of ThreadLongPressActionSheet and LongPressForumPostActionSheet: Mark As Read, the thread
 * rows, notifications, admin rows, then the developer row. Favorites, voice and Edit Tags are left out.
 */
export function threadActionGroups(env: ChannelActionEnv): ChannelAction[][] {
    return [
        readActions(env),
        channelRows(env),
        muteActions(env),
        adminRows(env),
        copyIdAction(env),
    ]
}
