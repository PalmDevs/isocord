import { dmGuild } from '../../native/IsocordConstants'
import { WEB_URL } from '../constants'

/** ChannelUtils.getChannelPermalink: the web link of a channel, or of a message in it. */
export const channelPermalink = (
    guildId: string | undefined,
    channelId: string,
    messageId?: string,
): string =>
    `${WEB_URL}/channels/${guildId ?? dmGuild}/${channelId}${messageId ? `/${messageId}` : ''}`
