import { guildIconUrl } from '../../../core/discord/cdn'
import {
    MESSAGE_REFERENCE_FORWARD,
    MessageFlag,
} from '../../../core/discord/messages'
import { Permission } from '../../../core/discord/permissions'
import { snowflakeTimestamp } from '../../../core/discord/snowflake'
import { DAY } from '../../../core/time'
import { t } from '../../../i18n'
import { computeChannelName } from '../../../stores/channels/channelName'
import { can } from '../../../stores/permissions'
import { chatLink } from '../links/chatLink'
import { attachmentRows } from '../media'
import { componentRows } from '../messageComponents/componentRow'
import { pollRow } from '../polls/pollRow'
import { formatShortDate, formatTime, formatWeekday } from '../timestamp'
import { ephemeralIndication, executedCommand } from './interaction'
import type { Session } from '../../../core/session'
import type { Channel } from '../../../stores/channels/channels'
import type { Guild } from '../../../stores/guilds'
import type { MessagePoll } from '../../../stores/messages/messageTypes'
import type { Message } from '../../../stores/readStates'
import type { User } from '../../../stores/users'
import type { ApiComponent } from '../messageComponents/apiComponent'
import type { ComponentInteractions } from '../messageComponents/interactionStore'
import type { PollState } from '../polls/pollState'
import type { InteractionAuthor, InteractionMeta } from './interaction'
import type { EmbedRow, ForwardRow, MessageRow, Span } from './rows'

/** A message's poll as the API sends it. */
export type ApiPoll = MessagePoll
interface ApiSnapshot {
    content?: string
    timestamp?: string
    embeds?: NonNullable<Message['embeds']>
    attachments?: NonNullable<Message['attachments']>
}
/** A message with the fields the API sends that the store's `Message` type leaves out. */
export interface RichMessage extends Message {
    components?: ApiComponent[]
    flags?: number
    /** Messages sent through an application's interaction webhook. */
    application_id?: string
    interaction_metadata?: InteractionMeta
    interaction?: InteractionMeta
    message_snapshots?: Array<{ message: ApiSnapshot }>
    message_reference?: {
        type?: number
        channel_id?: string
        message_id?: string
        guild_id?: string
    }
}

interface RichHelpers {
    spans: (text: string) => Span[]
    embeds: (embeds: NonNullable<Message['embeds']>) => EmbedRow[]
    /** What a forward's footer looks up: where the original was sent. */
    channels: Record<string, Channel>
    users: Record<string, User>
    session: Session
    guild: (id: string) => Guild | undefined
    /** The user's state of the message's poll; undefined where the poll cannot be used. */
    pollState: (messageId: string) => PollState | undefined
    /** How a user is drawn in the interaction line: name, colours and avatar. */
    author: (user: InteractionMeta['user'] & {}) => InteractionAuthor
    /** The user's name in the chat, nick first, for a select's picked users. */
    nameOf: (user: User) => string
    /** The chat's server, for a select's picked roles and channels. */
    chatGuild: Guild | undefined
    /** The session's component interactions; undefined where components cannot be used. */
    interactions: ComponentInteractions | undefined
}

/** DateUtils.calendarFormatCompact: the time today, "Yesterday at" the time, the weekday within a week, else the date. */
function calendarFormatCompact(date: Date): string {
    const time = formatTime(date)
    const startOfDay = (day: Date) =>
        new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime()
    const days = Math.round((startOfDay(date) - startOfDay(new Date())) / DAY)
    if (days === 0) return time
    if (days === -1) return t('chat.yesterday', { time })
    if (days > -7 && days < 0) return formatWeekday(date)
    return formatShortDate(date)
}

/**
 * MessageForward.getForwardInfo (formatMessageForwards.tsx): the footer names the source channel when it is in the
 * same server (or both are DMs) and can be read, else the source server with its icon. Nothing when neither is known.
 */
function forwardOrigin(
    message: Message,
    ref: NonNullable<RichMessage['message_reference']>,
    helpers: RichHelpers,
): { origin: string; iconUrl?: string } | undefined {
    const parent = helpers.channels[message.channel_id]
    const byGuild = (id: string | undefined) => {
        const guild = id ? helpers.guild(id) : undefined
        if (!guild) return undefined
        return {
            origin: guild.name,
            iconUrl: guild.icon
                ? guildIconUrl(guild.id, guild.icon, 16)
                : undefined,
        }
    }
    if (parent && parent.guild_id === ref.guild_id) {
        const source = ref.channel_id
            ? helpers.channels[ref.channel_id]
            : undefined
        if (!source) return byGuild(parent.guild_id)
        if (
            source.guild_id &&
            (!helpers.guild(source.guild_id) ||
                !can(helpers.session, source.id, Permission.VIEW_CHANNEL))
        )
            return undefined
        return { origin: computeChannelName(source, helpers.users, true) }
    }
    return byGuild(ref.guild_id)
}

/** The poll, components, forward and interaction parts of a message row. One call from buildRows. */
export function richParts(
    message: Message,
    helpers: RichHelpers,
): Pick<
    MessageRow,
    | 'poll'
    | 'components'
    | 'forward'
    | 'executedCommand'
    | 'ephemeralIndication'
> {
    const m = message as RichMessage
    const parts: ReturnType<typeof richParts> = {}
    if (m.poll)
        parts.poll = pollRow(
            message.id,
            m.poll,
            message.state ? undefined : helpers.pollState(message.id),
        )
    const { interactions } = helpers
    const components = componentRows(m.components, {
        messageId: message.id,
        spans: helpers.spans,
        interactive: interactions !== undefined && !message.state,
        interaction: interactions?.byMessage[message.id],
        selections: interactions?.selections[message.id],
        lookup: {
            users: helpers.users,
            guild: helpers.chatGuild,
            channels: helpers.channels,
            nameOf: helpers.nameOf,
        },
    })
    if (components.length) parts.components = components

    const snapshot = m.message_snapshots?.[0]?.message
    const ref = m.message_reference
    if (snapshot && ref?.type === MESSAGE_REFERENCE_FORWARD) {
        const sent = ref.message_id
            ? snowflakeTimestamp(ref.message_id)
            : snapshot.timestamp && Date.parse(snapshot.timestamp)
        const timestamp = sent
            ? calendarFormatCompact(new Date(sent))
            : undefined
        const origin = forwardOrigin(message, ref, helpers)
        parts.forward = {
            label: t('chat.forwarded'),
            content: helpers.spans(snapshot.content ?? ''),
            attachments: attachmentRows(snapshot.attachments),
            embeds: helpers.embeds(snapshot.embeds ?? []),
            ...(origin && {
                origin: origin.origin,
                originIconUrl: origin.iconUrl,
                timestamp,
                accessibilityLabel: t('chat.forwardOrigin', {
                    origin: origin.origin,
                    timestamp: timestamp ?? '',
                }),
            }),
            // handleForwardBreadcrumb: a tap on the footer jumps to the original message.
            ...(ref.channel_id && ref.message_id
                ? {
                      url: chatLink.forward(
                          ref.guild_id,
                          ref.channel_id,
                          ref.message_id,
                      ),
                  }
                : {}),
        } satisfies ForwardRow
    }

    parts.executedCommand = executedCommand(m, helpers.author)
    if ((m.flags ?? 0) & MessageFlag.EPHEMERAL)
        parts.ephemeralIndication = ephemeralIndication(message.id)
    return parts
}
