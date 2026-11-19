import { MessageType } from '../../../core/discord/messages'
import { chatLink } from '../links/chatLink'
import type { SystemHandlers } from './types'

/** A thread started from a channel, and a thread's first message. */
export const threadHandlers: SystemHandlers = {
    // createThreadStarterSystemMessage: only when the parent message did not come with it. Otherwise buildRows
    // draws the parent as the thread's first message.
    [MessageType.THREAD_STARTER_MESSAGE]: {
        icon: 'thread',
        tint: 'normal',
        content: () => ({
            key: 'chat.system.threadStarterUnloaded',
            values: {},
        }),
    },
    // createNewThreadSystemMessage. SystemMessageUtils.stringify gives only the thread name; a preview keeps the sentence.
    [MessageType.THREAD_CREATED]: {
        icon: 'thread',
        tint: 'normal',
        content: (message, env) => {
            const threadId = message.message_reference?.channel_id
            const thread = threadId ? env.channel(threadId) : undefined
            return {
                key: 'chat.system.thread',
                values: {
                    actorName: env.name(message.author),
                    actorHook: env.userLink(message.author),
                    threadName: thread?.name ?? message.content ?? '',
                    // bindOpenThreadChannel: the thread opens like a channel link.
                    ...(threadId && {
                        threadOnClick: {
                            url: chatLink.channel(
                                thread?.guild_id ?? env.guild?.id,
                                threadId,
                            ),
                        },
                    }),
                },
            }
        },
    },
}
