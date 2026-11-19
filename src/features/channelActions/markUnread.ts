import { Endpoint } from '../../core/api/paths'
import { messagesStore } from '../../stores/messages/messages'
import { markMessageUnread, readStatesStore } from '../../stores/readStates'
import type { Session } from '../../core/session'
import type { Message } from '../../stores/readStates'

/** The newest message and the one before it: enough to place the marker and count the mention. */
const NEWEST_PAGE = 2

/**
 * markChannelUnread: marks a channel's newest message unread, counting its mentions like `markUnread`. Uses the
 * loaded messages, else fetches the newest two (the reference counts 0 when none are loaded).
 */
export async function markChannelUnread(
    session: Session,
    channelId: string,
): Promise<void> {
    const last = session.get(readStatesStore).getState().lastMessageIds[
        channelId
    ]
    if (!last) return
    const loaded =
        session.get(messagesStore).getState().channels[channelId]?.messages ??
        []
    const messages = loaded.some(message => message.id === last)
        ? loaded
        : await session.rest
              .get<Message[]>(Endpoint.channelMessages(channelId), {
                  query: { limit: NEWEST_PAGE },
              })
              .catch(() => [])
    if (messages.some(message => message.id === last))
        markMessageUnread(session, channelId, last, messages)
}
