import {
    ChannelType,
    READABLE_CHANNEL_TYPES,
} from '../../core/discord/channelType'
import { t } from '../../i18n'
import {
    channelsStore,
    isPrivate,
    isThread,
} from '../../stores/channels/channels'
import { ackChannel } from '../../stores/readStates'
import { copy } from '../chat/longPress/messageActionRows'
import {
    openMuteSheet,
    openNotificationSettings,
    unmuteChannel,
} from '../notificationSettings'
import { markChannelUnread } from './markUnread'
import type { NavigationProp, ParamListBase } from '@react-navigation/native'
import type { Session } from '../../core/session'
import type { IconName } from '../../design/icons/Icon'
import type { MessageKey } from '../../i18n'
import type { Channel } from '../../stores/channels/channels'

export type ChannelActionNavigation = Pick<
    NavigationProp<ParamListBase>,
    'navigate'
>

export interface ChannelAction {
    key: string
    label: string
    icon: IconName
    isDestructive?: boolean
    onPress: () => void
}

export interface ChannelActionEnv {
    session: Session
    channel: Channel
    navigation: ChannelActionNavigation
    developerMode: boolean
    /** The channel's or category's own mute (UserGuildSettingsStore.isChannelMuted), a thread's own mute. */
    muted: boolean
    hasUnread: boolean
    /** useCanMarkChannelUnread: the channel has a newest message and is no category. */
    canMarkUnread: boolean
    pinned: boolean
    /** ChannelRecord.isForumPost: the thread is a post of a forum or media channel. */
    forumPost: boolean
}

export const isCategory = (channel: Channel) =>
    channel.type === ChannelType.GUILD_CATEGORY
export const isGuildChannel = (channel: Channel) =>
    channel.guild_id !== undefined

/** The label of the mute row: Mute or Unmute for a category, conversation, post, thread or channel. */
function muteKey(
    channel: Channel,
    muted: boolean,
    forumPost: boolean,
): MessageKey {
    if (isCategory(channel))
        return muted
            ? 'channelActions.unmuteCategory'
            : 'channelActions.muteCategory'
    if (isPrivate(channel))
        return muted
            ? 'channelActions.unmuteConversation'
            : 'channelActions.muteConversation'
    if (forumPost)
        return muted ? 'channelActions.unmutePost' : 'channelActions.mutePost'
    if (isThread(channel))
        return muted
            ? 'channelActions.unmuteThread'
            : 'channelActions.muteThread'
    return muted ? 'channelActions.unmuteChannel' : 'channelActions.muteChannel'
}

/** ReadStateActionCreators.ackChannel: a category reads its readable channels and their threads. */
function markRead(session: Session, channel: Channel): void {
    if (!isCategory(channel)) {
        ackChannel(session, channel.id)
        return
    }
    const { channels } = session.get(channelsStore).getState()
    for (const child of Object.values(channels)) {
        const parent = channels[child.parent_id ?? '']
        if (
            READABLE_CHANNEL_TYPES.has(child.type) &&
            (child.parent_id === channel.id || parent?.parent_id === channel.id)
        )
            ackChannel(session, child.id)
    }
}

/** The "mark-as-read" rows: Mark Unread, Mark As Read. Shared by channels, categories and threads. */
export function readActions(env: ChannelActionEnv): ChannelAction[] {
    const { session, channel, hasUnread, canMarkUnread } = env
    const actions: ChannelAction[] = []
    if (!hasUnread && canMarkUnread)
        actions.push({
            key: 'markUnread',
            label: t('channelActions.markUnread'),
            icon: 'ChatMarkUnreadIcon',
            onPress: () => void markChannelUnread(session, channel.id),
        })
    if (READABLE_CHANNEL_TYPES.has(channel.type) || isCategory(channel))
        actions.push({
            key: 'markRead',
            label: t('chat.markAsRead'),
            icon: 'EyeIcon',
            onPress: () => markRead(session, channel),
        })
    return actions
}

/** The mute rows: Mute or Unmute, then Notification Settings of a guild channel or thread. */
export function muteActions(env: ChannelActionEnv): ChannelAction[] {
    const { session, channel, muted, forumPost } = env
    const actions: ChannelAction[] = [
        {
            key: 'mute',
            label: t(muteKey(channel, muted, forumPost)),
            icon: muted ? 'BellIcon' : 'BellSlashIcon',
            onPress: () =>
                muted
                    ? unmuteChannel(session, channel)
                    : openMuteSheet(channel.id),
        },
    ]
    if (isGuildChannel(channel))
        actions.push({
            key: 'notificationSettings',
            label: t(
                forumPost
                    ? 'threadActions.notifications'
                    : 'channelActions.notificationSettings',
            ),
            icon: 'ChannelNotificationIcon',
            onPress: () => openNotificationSettings(channel.id),
        })
    return actions
}

/** The developer row: Copy Channel ID, or Copy Thread ID of a thread or post. */
export function copyIdAction({
    channel,
    developerMode,
}: ChannelActionEnv): ChannelAction[] {
    if (!developerMode) return []
    return [
        {
            key: 'copyId',
            label: t(
                isThread(channel)
                    ? 'channelActions.copyThreadId'
                    : 'channelActions.copyChannelId',
            ),
            icon: 'IdIcon',
            onPress: () => copy(channel.id, 'id'),
        },
    ]
}
