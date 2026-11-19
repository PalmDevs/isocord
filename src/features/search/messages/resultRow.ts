import {
    CHAT_MESSAGE_TYPES,
    MessageType,
    PREVIEW_MESSAGE_TYPES,
} from '../../../core/discord/messages'
import { snowflakeTimestamp } from '../../../core/discord/snowflake'
import { isThread } from '../../../stores/channels/channels'
import { mentionIcon } from '../../chat/rows/buildRows'
import { buildMessageRow, standaloneRow } from '../../chat/rows/rowEncoder'
import { previewText } from '../../messages/preview'
import { highlightSpans, shortTimestamp, truncateContent } from './text'
import type { Session } from '../../../core/session'
import type { Channel } from '../../../stores/channels/channels'
import type { Guild } from '../../../stores/guilds'
import type { Member } from '../../../stores/members'
import type { Message } from '../../../stores/readStates'
import type { User } from '../../../stores/users'
import type { MessageRow } from '../../chat/rows/rows'

/**
 * The rows `IsocordSearchResultsView` draws, sent as JSON and decoded by `SearchRow` in SearchRows.kt.
 * A result carries a chat `MessageRow` without grouping, reply preview, reactions or swipe.
 */
export type SearchRow =
    | {
          type: 'result'
          key: string
          channelId: string
          messageId: string
          /** Server channel results show the channel above the message. */
          channelName?: string
          channelIcon?: string
          /** The channel's server after its name (Notifications tab). */
          guildName?: string
          /** The server's icon at the start of the channel line (Notifications tab); its acronym's first letter without one. */
          guildIconUrl?: string
          guildAcronym?: string
          /** Drawn at a lower opacity: a notification that has been read. */
          read?: boolean
          message: MessageRow
      }
    | { type: 'notice'; key: string; lines: string[] }
    | { type: 'loading'; key: string }

/** Message types the chat draws as a message; the others (joins, pins...) become their one line preview. */

/** A message as the standalone content of a result: the text cut around the query's first word. */
export function resultSource(
    message: Message,
    words: Set<string>,
    lineClamp: number,
): Message {
    const type = message.type ?? MessageType.DEFAULT
    let source = message
    if (!CHAT_MESSAGE_TYPES.has(type))
        source = {
            ...message,
            type: MessageType.DEFAULT,
            ...(PREVIEW_MESSAGE_TYPES.has(type)
                ? {}
                : { content: previewText(message) ?? '' }),
        }
    const cut = truncateContent(source.content ?? '', words, lineClamp)
    return cut == null ? source : { ...source, content: cut }
}

export interface ResultContext {
    guild: Guild | undefined
    members: Record<string, Member> | undefined
    users: Record<string, User>
    channels: Record<string, Channel>
    words: Set<string>
    lineClamp: number
}

/** The icon a server channel is shown with, as the chat's beginning row picks it (ChatBeginningRowIcon). */
export const channelIcon = (
    channels: Record<string, Channel>,
    channel: Channel,
) =>
    isThread(channel) ? (mentionIcon(channels, channel.id) ?? 'thread') : 'text'

/** A result row for a message, with its chat `MessageRow` (undefined when the message builds no message row). */
export function resultRow(
    session: Session,
    message: Message,
    context: ResultContext,
): Omit<SearchRow & { type: 'result' }, 'message'> & {
    message: MessageRow | undefined
} {
    const { channels, words, lineClamp } = context
    const row = buildMessageRow(
        session,
        resultSource(message, words, lineClamp),
        context,
    )
    const channel = channels[message.channel_id]
    const guild = channel?.guild_id != null
    return {
        type: 'result',
        key: message.id,
        channelId: message.channel_id,
        messageId: message.id,
        channelName: guild ? channel.name : undefined,
        channelIcon: guild ? channelIcon(channels, channel) : undefined,
        message: row && {
            ...standaloneRow(row),
            timestamp: shortTimestamp(snowflakeTimestamp(message.id)).text,
            content: highlightSpans(row.content, words),
        },
    }
}
