import { useNavigation } from '@react-navigation/native'
import { useEffect } from 'react'
import { ChannelType } from '../../core/discord/channelType'
import { Permission } from '../../core/discord/permissions'
import { useSession, useSessionStore } from '../../core/react'
import {
    channelsStore,
    isForumPost as isForumPostOf,
    isThread,
} from '../../stores/channels/channels'
import { threadMetadataOf } from '../../stores/channels/threadModeration'
import {
    channelPermissions,
    useChannelPermissions,
} from '../../stores/permissions'
import type { Session } from '../../core/session'
import type { Channel } from '../../stores/channels/channels'

/** The types the long press sheet duplicates (isGuildTextChannelType, forum-like, voice). A category makes a new channel. */
const DUPLICABLE_TYPES: ReadonlySet<number> = new Set([
    ChannelType.GUILD_TEXT,
    ChannelType.GUILD_ANNOUNCEMENT,
    ChannelType.GUILD_VOICE,
    ChannelType.GUILD_FORUM,
    ChannelType.GUILD_MEDIA,
])

const has = (permissions: bigint, permission: bigint) =>
    (permissions & permission) === permission

/** What the user may do in a thread, from their `permissions` there. */
export interface ThreadAccess {
    /** ThreadHooks.useIsThreadModerator: MANAGE_THREADS. */
    moderator: boolean
    /** ThreadHooks.useCanManageThread: a moderator, or the owner while the thread is not locked. */
    manage: boolean
    /** ChannelSettingsUtils.getIsChannelNameSettingEditable. */
    nameEditable: boolean
}

/** Returns the rules of ThreadHooks and ChannelSettingsUtils for a thread. */
export function threadAccess(
    thread: Channel,
    permissions: bigint,
    userId: string,
    forumPost: boolean,
): ThreadAccess {
    const moderator = has(permissions, Permission.MANAGE_THREADS)
    const owner = thread.owner_id === userId
    const locked = threadMetadataOf(thread)?.locked === true
    const manage = moderator || (!locked && owner)
    return {
        moderator,
        manage,
        nameEditable: forumPost ? manage : manage || owner,
    }
}

/** ChannelRecord.isForumPost, for a thread in the store. */
export function isForumPost(session: Session, thread: Channel): boolean {
    const { channels } = session.get(channelsStore).getState()
    return isForumPostOf(thread, channels[thread.parent_id ?? ''])
}

/** Returns `isForumPost`, updated when the parent changes. */
export function useIsForumPost(thread: Channel): boolean {
    return useSessionStore(channelsStore, state =>
        isForumPostOf(thread, state.channels[thread.parent_id ?? '']),
    )
}

/** A guild channel the user manages, or a thread they may edit. A DM has the permission bit too, so the guild is checked first. */
function manages(
    channel: Channel | undefined,
    permissions: bigint,
    userId: string,
): boolean {
    if (channel?.guild_id === undefined) return false
    if (isThread(channel))
        return threadAccess(channel, permissions, userId, false).manage
    return has(permissions, Permission.MANAGE_CHANNELS)
}

/**
 * ChannelLongPressActionSheet's `canManageChannel`: the Edit Channel and Edit Category rows. A thread follows
 * useCanManageThread, for the sheet's Edit row.
 */
export function canEditChannel(session: Session, channel: Channel): boolean {
    return manages(
        channel,
        channelPermissions(session, channel.id),
        session.userId,
    )
}

/** ChannelLongPressActionSheet: the Duplicate Channel row, for who can manage the channel and a type that has one. */
export function canDuplicateChannel(
    session: Session,
    channel: Channel,
): boolean {
    return (
        canEditChannel(session, channel) && DUPLICABLE_TYPES.has(channel.type)
    )
}

/**
 * Returns the channel while the user may manage it. The screen goes back when the channel is gone or the permission
 * is lost.
 */
export function useManagedChannel(channelId: string): Channel | undefined {
    const navigation = useNavigation()
    const channel = useSessionStore(
        channelsStore,
        state => state.channels[channelId],
    )
    const { userId } = useSession()
    const allowed = manages(channel, useChannelPermissions(channelId), userId)
    useEffect(() => {
        if (!allowed) navigation.goBack()
    }, [allowed, navigation])
    return allowed ? channel : undefined
}
