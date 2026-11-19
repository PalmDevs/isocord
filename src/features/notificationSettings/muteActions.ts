import { ChannelType } from '../../core/discord/channelType'
import { isPrivate, isThread } from '../../stores/channels/channels'
import {
    muteThread,
    unmuteThread,
} from '../../stores/channels/threadMemberActions'
import {
    muteChannel as muteChannelOverride,
    unmuteChannel as unmuteChannelOverride,
} from '../../stores/settings/notificationActions'
import type { Session } from '../../core/session'
import type { MessageKey } from '../../i18n'
import type { Channel } from '../../stores/channels/channels'

/**
 * MuteSettingsUtils.handleMuteSettingPress: mutes a channel, category, private channel or thread for `seconds`. A
 * thread's mute is its member's (ThreadActionCreators.setNotificationSettings).
 */
export function muteChannel(
    session: Session,
    channel: Channel,
    seconds: number,
): void {
    if (isThread(channel)) void muteThread(session, channel, seconds)
    else muteChannelOverride(session, channel, seconds)
}

/** MuteSettingsUtils.handleUnmutePress, for a thread as well. */
export function unmuteChannel(session: Session, channel: Channel): void {
    if (isThread(channel)) void unmuteThread(session, channel)
    else unmuteChannelOverride(session, channel)
}

/** The label of the row that unmutes: ChannelLongPressActionSheet's unmute buttons. */
export function unmuteKey(channel: Channel, forumPost: boolean): MessageKey {
    if (forumPost) return 'channelActions.unmutePost'
    if (isThread(channel)) return 'channelActions.unmuteThread'
    if (isPrivate(channel)) return 'channelActions.unmuteConversation'
    if (channel.type === ChannelType.GUILD_CATEGORY)
        return 'channelActions.unmuteCategory'
    return 'channelActions.unmuteChannel'
}
