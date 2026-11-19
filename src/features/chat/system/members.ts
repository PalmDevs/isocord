import { MessageType } from '../../../core/discord/messages'
import { snowflakeTimestamp } from '../../../core/discord/snowflake'
import { isThread } from '../../../stores/channels/channels'
import { authorValues } from './types'
import type { MessageKey } from '../../../i18n'
import type { Message } from '../../../stores/readStates'
import type { SystemEnv, SystemHandlers } from './types'

/** SystemMessageUtils.getSystemMessageUserJoinMobile's welcome lines. */
const JOIN_KEYS: MessageKey[] = [
    'chat.system.join.1',
    'chat.system.join.2',
    'chat.system.join.3',
    'chat.system.join.4',
    'chat.system.join.5',
    'chat.system.join.6',
    'chat.system.join.7',
    'chat.system.join.8',
    'chat.system.join.9',
    'chat.system.join.10',
    'chat.system.join.11',
    'chat.system.join.12',
    'chat.system.join.13',
]

/** Picks the welcome line by the message's send time, so a message always reads the same. */
const joinKey = (messageId: string): MessageKey =>
    JOIN_KEYS[snowflakeTimestamp(messageId) % JOIN_KEYS.length] ??
    'chat.system.join.1'

/** The user a recipient message names: the first mention. */
const otherValues = (message: Message, env: SystemEnv) => {
    const other = message.mentions?.[0]
    return other
        ? {
              otherUsername: env.name(other),
              otherUsernameOnClick: env.userLink(other),
          }
        : undefined
}

const inThread = (message: Message, env: SystemEnv) => {
    const channel = env.channel(message.channel_id)
    return channel !== undefined && isThread(channel)
}

/** Members joining and leaving: the server join, and group DM and thread recipients. */
export const memberHandlers: SystemHandlers = {
    // createUserJoinSystemMessage. The variant with the app's `actor` needs a field the client does not keep.
    [MessageType.USER_JOIN]: {
        icon: 'arrowRight',
        tint: 'positive',
        content: (message, env) =>
            message.author.bot
                ? {
                      key: 'chat.system.botJoin',
                      values: {
                          appName: env.name(message.author),
                          appNameOnClick: env.userLink(message.author),
                      },
                  }
                : {
                      key: joinKey(message.id),
                      values: authorValues(message, env),
                      // The reference offers the sticker reply on every join message not sent by an app.
                      wave: true,
                  },
    },
    // createAddRecipientSystemMessage.
    [MessageType.RECIPIENT_ADD]: {
        icon: 'arrowRight',
        tint: 'positive',
        content: (message, env) => {
            const other = otherValues(message, env)
            if (!other) return undefined
            return {
                key: inThread(message, env)
                    ? 'chat.system.recipientAdd.thread'
                    : 'chat.system.recipientAdd.group',
                values: { ...authorValues(message, env), ...other },
            }
        },
    },
    // createRemoveRecipientSystemMessage: leaving when the author removed themselves.
    [MessageType.RECIPIENT_REMOVE]: {
        icon: 'arrowLeft',
        tint: 'danger',
        content: (message, env) => {
            const thread = inThread(message, env)
            if (message.mentions?.[0]?.id === message.author.id)
                return {
                    key: thread
                        ? 'chat.system.recipientLeave.thread'
                        : 'chat.system.recipientLeave.group',
                    values: authorValues(message, env),
                }
            const other = otherValues(message, env)
            if (!other) return undefined
            return {
                key: thread
                    ? 'chat.system.recipientRemove.thread'
                    : 'chat.system.recipientRemove.group',
                values: { ...authorValues(message, env), ...other },
            }
        },
    },
}
