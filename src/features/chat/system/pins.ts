import { MessageType } from '../../../core/discord/messages'
import { chatLink } from '../links/chatLink'
import { authorValues } from './types'
import type { SystemHandlers } from './types'

/** A message pinned. */
export const pinHandlers: SystemHandlers = {
    // createChannelPinnedMessageSystemMessage; a preview reads like SystemMessageUtils.stringify.
    [MessageType.CHANNEL_PINNED_MESSAGE]: {
        icon: 'pin',
        tint: 'normal',
        content: (message, env) => {
            const values = {
                ...authorValues(message, env),
                // bindOpenPins: the channel details on Pinned Messages.
                pinsOnClick: { url: chatLink.pins(message.channel_id) },
            }
            if (env.plain) return { key: 'chat.system.pinPlain', values }
            const ref = message.message_reference
            if (!ref?.message_id) return { key: 'chat.system.pin', values }
            return {
                key: 'chat.system.pinJump',
                values: {
                    ...values,
                    // bindJumpToMessage.
                    messageOnClick: {
                        url: chatLink.channel(
                            ref.guild_id ?? env.guild?.id,
                            ref.channel_id ?? message.channel_id,
                            ref.message_id,
                        ),
                    },
                },
            }
        },
    },
}
