import { ChannelType } from '../../../../core/discord/channelType'
import { MessageFlag, MessageType } from '../../../../core/discord/messages'
import { Day, message, sequence } from './build'
import { BOB, ChannelId, GUILD_ID } from './world'
import type { Channel } from '../../../../stores/channels/channels'
import type { FixtureMessage } from './build'

/** The thread the API attaches to a message it was started from: the thread has the message's id. */
const threadOf = (
    parentMessage: FixtureMessage,
    name: string,
    messageCount: number,
    archived = false,
): Channel => ({
    id: parentMessage.id,
    type: ChannelType.PUBLIC_THREAD,
    name,
    guild_id: GUILD_ID,
    parent_id: ChannelId.GENERAL,
    message_count: messageCount,
    thread_metadata: { archived },
})

/** A message with a thread, as the API sends it (HAS_THREAD and `thread`). */
function withThread(
    minute: number,
    content: string,
    name: string,
    messageCount: number,
    archived = false,
): FixtureMessage {
    const parentMessage = message(Day.THREADS, minute, {
        content,
        flags: MessageFlag.HAS_THREAD,
    })
    return {
        ...parentMessage,
        thread: threadOf(parentMessage, name, messageCount, archived),
    }
}

/** The message a thread was started from: 12 messages, none held (no recent message to show). */
const parent = withThread(
    1,
    'A message that started a thread.',
    'Weekend plans',
    12,
)

/** Thread cards: a new thread without messages, and an archived one. */
const threadCards = [
    withThread(2, 'Who wants to review my PR?', 'PR review', 0),
    withThread(3, 'Old discussion', 'Archived chat', 75, true),
]

/**
 * Thread messages. The thread's own system messages (created, recipients) are in the system domain. The starter
 * message is what a thread's first row shows: the parent, quoted.
 */
export const threadMessages = [
    parent,
    ...threadCards,
    ...sequence(
        Day.THREADS,
        [
            {
                author: BOB,
                type: MessageType.THREAD_STARTER_MESSAGE,
                content: '',
                referenced_message: parent,
                message_reference: {
                    message_id: parent.id,
                    channel_id: ChannelId.GENERAL,
                    guild_id: GUILD_ID,
                },
            },
        ],
        60,
    ),
]
