import { ChannelType } from '../../../core/discord/channelType'
import { MessageType } from '../../../core/discord/messages'
import { isThread } from '../../../stores/channels/channels'
import { chatLink } from '../links/chatLink'
import { authorValues } from './types'
import type { Message } from '../../../stores/readStates'
import type { SystemEnv, SystemHandlers } from './types'

const isGroupDm = (message: Message, env: SystemEnv) =>
    env.channel(message.channel_id)?.type === ChannelType.GROUP_DM

/** MessageRecord.isForumPost: a thread of a forum or media channel. */
function isForumPost(message: Message, env: SystemEnv): boolean {
    const channel = env.channel(message.channel_id)
    if (!channel || !isThread(channel) || !channel.parent_id) return false
    const parent = env.channel(channel.parent_id)?.type
    return (
        parent === ChannelType.GUILD_FORUM || parent === ChannelType.GUILD_MEDIA
    )
}

/** "Edit group" (bindOpenGdmCustomizeActionSheet). */
const editGroup = (message: Message) => ({
    onEditGroup: { url: chatLink.editGroup(message.channel_id) },
})

/** A channel, post or group DM renamed or given a new icon. */
export const channelHandlers: SystemHandlers = {
    // createChangeChannelNameSystemMessage.
    [MessageType.CHANNEL_NAME_CHANGE]: {
        icon: 'pencil',
        tint: 'normal',
        content: (message, env) => {
            const values = {
                ...authorValues(message, env),
                channelName: message.content ?? '',
            }
            if (isGroupDm(message, env))
                return {
                    key: message.content
                        ? 'chat.system.groupName'
                        : 'chat.system.groupNameRemoved',
                    values: { ...values, ...editGroup(message) },
                }
            return {
                key: isForumPost(message, env)
                    ? 'chat.system.postTitle'
                    : 'chat.system.channelName',
                values,
            }
        },
    },
    // createChangeChannelIconSystemMessage.
    [MessageType.CHANNEL_ICON_CHANGE]: {
        icon: 'pencil',
        tint: 'normal',
        content: (message, env) =>
            isGroupDm(message, env)
                ? {
                      key: 'chat.system.groupIconEdit',
                      values: {
                          ...authorValues(message, env),
                          ...editGroup(message),
                      },
                  }
                : {
                      key: 'chat.system.groupIcon',
                      values: authorValues(message, env),
                  },
    },
}
