import { ChannelType } from '../../core/discord/channelType'
import { useSessionStore } from '../../core/react'
import { channelsStore, isForumPost } from '../../stores/channels/channels'
import type { IconName } from '../../design/icons/Icon'
import type { Channel } from '../../stores/channels/channels'

const CHANNEL_ICONS: Record<number, IconName> = {
    [ChannelType.GUILD_VOICE]: 'VoiceNormalIcon',
    [ChannelType.GUILD_ANNOUNCEMENT]: 'AnnouncementsIcon',
    [ChannelType.GUILD_STAGE_VOICE]: 'StageIcon',
    [ChannelType.GUILD_FORUM]: 'ForumIcon',
    [ChannelType.GUILD_MEDIA]: 'ImageIcon',
    [ChannelType.ANNOUNCEMENT_THREAD]: 'ThreadIcon',
    [ChannelType.PUBLIC_THREAD]: 'ThreadIcon',
    [ChannelType.PRIVATE_THREAD]: 'ThreadLockIcon',
}

/** getChannelIconComponent: a forum post's icon. */
const FORUM_POST_ICON: IconName = 'ChatIcon'

/** The icon a guild channel is shown with, in the channel list and the chat header. */
export function channelIcon(type: number): IconName {
    return CHANNEL_ICONS[type] ?? 'TextIcon'
}

/** Returns the channel's icon, the forum post icon when its parent is a forum. */
export function useChannelIcon(channel: Channel | undefined): IconName {
    return useSessionStore(channelsStore, state =>
        channel && isForumPost(channel, state.channels[channel.parent_id ?? ''])
            ? FORUM_POST_ICON
            : channelIcon(channel?.type ?? 0),
    )
}
