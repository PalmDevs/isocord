import { emojiUrl } from '../../../core/discord/cdn'
import { ChannelType } from '../../../core/discord/channelType'
import {
    INTERACTION_MESSAGE_TYPES,
    MessageFlag,
    MessageType,
} from '../../../core/discord/messages'
import { RelationshipType } from '../../../core/discord/relationships'
import {
    compareSnowflakes,
    snowflakeTimestamp,
} from '../../../core/discord/snowflake'
import { MINUTE } from '../../../core/time'
import {
    avatarUrl,
    cdnSize,
} from '../../../design/components/avatars/avatarUrl'
import { t } from '../../../i18n'
import { avatarSize } from '../../../native/NativeIsocordConstants'
import { computeChannelName } from '../../../stores/channels/channelName'
import { isForumPost, isThread } from '../../../stores/channels/channels'
import { isThreadJoined } from '../../../stores/channels/threadMemberActions'
import { reactionCounts } from '../../../stores/messages/reactionEdits'
import { displayName } from '../../../stores/users'
import { forumPostReactions } from '../../forum/forumPostReactions'
import { tagEmojiUrl } from '../../forum/tagEmojiUrl'
import {
    authorAvatarUrl,
    authorStyle,
    clanTag,
    decorationUrl,
    roleColors,
} from '../author'
import { burstColors } from '../burstColors'
import { twemojiUrl } from '../emoji'
import { chatLink, PostLinkAction } from '../links/chatLink'
import {
    attachmentRows,
    embedRows,
    hasOnlySimpleEmbed,
    stickerRows,
} from '../media'
import { NO_POLL_STATE } from '../polls/pollState'
import { keyOf } from '../reactions'
import { systemRow } from '../system'
import { calendarTimestamp, formatLongDate, sameDay } from '../timestamp'
import { isJumbo, parseEmbedTitle, parseMarkdown, toSpans } from './markdown'
import { messagePreview } from './messagePreview'
import { richParts } from './rich'
import { threadEmbedRow } from './threadEmbed'
import type { Session } from '../../../core/session'
import type { Channel } from '../../../stores/channels/channels'
import type { Guild } from '../../../stores/guilds'
import type { Member } from '../../../stores/members'
import type {
    ChannelMessages,
    Reaction,
} from '../../../stores/messages/messageTypes'
import type { Message } from '../../../stores/readStates'
import type { Relationship } from '../../../stores/relationships'
import type { User } from '../../../stores/users'
import type { EmbedSpans } from '../media'
import type { ComponentInteractions } from '../messageComponents/interactionStore'
import type { PollState } from '../polls/pollState'
import type { SystemEnv } from '../system'
import type { InteractionAuthor, InteractionMeta } from './interaction'
import type { MarkdownNode, MentionResolver } from './markdown'
import type { RichMessage } from './rich'
import type {
    ChatRow,
    HiddenGroupRow,
    MessageRow,
    PostActionsRow,
    ReplyRow,
    Span,
    SystemRow,
} from './rows'
import type { ThreadEmbedSources } from './threadEmbed'

export interface RowContext {
    /** The user's session: their id, and their permissions for forward footers. */
    session: Session
    guild: Guild | undefined
    /** Members of the guild, by user id. */
    members: Record<string, Member> | undefined
    users: Record<string, User>
    channels: Record<string, Channel>
    /** Every guild, for forwards from another server (their footer names it); the chat's own is `guild`. */
    guilds?: Record<string, Guild>
    /** Last message the user has read; the "NEW" divider goes after it. */
    ackedId?: string
    /** The channel shown; the welcome row at the top of its history depends on it. */
    channel?: Channel
    /** Whether the user may add reactions to the message (the long press sheet's check). */
    canReact?: (message: Message) => boolean
    /** What swiping the message does: reply, reply and edit, or nothing (see `messageSwipeActions`). */
    swipeActions?: (message: Message) => MessageRow['swipe']
    /** Called with each mentioned or linked channel the client does not hold, so it can be fetched. */
    onUnknownChannel?: (channelId: string) => void
    /** The active threads, by id (ActiveThreadsStore), for thread cards. */
    threads?: Record<string, Channel>
    /** The newest message of each active thread, by thread id (ThreadMessageStore). */
    threadMessages?: Record<string, Message>
    /** The user's poll states, by message id. Absent where polls cannot be used (search, previews). */
    polls?: Record<string, PollState>
    /** The session's component interactions. Absent where buttons and selects cannot be used (search, previews). */
    interactions?: ComponentInteractions
    /** A forum post's first message from the post list's fetch, for its action bar while history lacks it. */
    forumPostStarter?: Message
    /** Why a user's messages fold into a group (message.blocked, message.ignored). Absent where nothing folds. */
    hiddenReason?: (userId: string) => HiddenReason | undefined
}

export type HiddenReason = 'blocked' | 'ignored'

/** Returns why a user's messages are hidden: blocked first, then ignored (createChannelStream). */
export function hiddenReasonOf(
    relationship: Relationship | undefined,
): HiddenReason | undefined {
    if (relationship?.type === RelationshipType.BLOCKED) return 'blocked'
    if (relationship?.user_ignored) return 'ignored'
    return undefined
}

/** EmojiConstants MAX_REACTIONS: distinct reactions a message holds. */
const MAX_REACTIONS = 20

/** The avatar before the interaction line, as the reply preview's. */
const INTERACTION_AVATAR_SIZE = 64

/** Messages closer together than this, from one author, share a header. */
const GROUP_WINDOW = 7 * MINUTE

const isUserMessage = (message: Message) =>
    message.type === undefined ||
    message.type === MessageType.DEFAULT ||
    message.type === MessageType.REPLY ||
    INTERACTION_MESSAGE_TYPES.has(message.type)

// Message objects are replaced when edited, so the parse can be cached on the object itself.
const parsed = new WeakMap<Message, MarkdownNode[]>()
export function parse(message: Message): MarkdownNode[] {
    let nodes = parsed.get(message)
    if (!nodes) {
        nodes = parseMarkdown(message.content ?? '')
        parsed.set(message, nodes)
    }
    return nodes
}

// The reference's link nodes (the parser calls bare urls, <urls> and masked links all "link").
const LINK_TYPES = new Set(['link', 'autolink', 'url'])

const children = (node: MarkdownNode): MarkdownNode[] =>
    Array.isArray(node.content) ? node.content : []
const findNode = (
    nodes: MarkdownNode[],
    test: (node: MarkdownNode) => boolean,
): boolean => nodes.some(node => test(node) || findNode(children(node), test))
const hasLink = (node: MarkdownNode) =>
    findNode(children(node), child => LINK_TYPES.has(child.type))

/** checkSpoilerEmbeds: a link written inside a spoiler hides the media it embeds. */
export const hasSpoilerLink = (nodes: MarkdownNode[]) =>
    findNode(nodes, node => node.type === 'spoiler' && hasLink(node))

/** "Welcome to #channel" / "the beginning of your DM history", shown once all history is loaded. */
function welcomeRow(
    channel: Channel,
    users: Record<string, User>,
    channels: Record<string, Channel>,
): ChatRow | undefined {
    if (channel.type === ChannelType.DM) {
        const recipient = users[channel.recipient_ids?.[0] ?? '']
        if (!recipient) return undefined
        return {
            type: 'welcome',
            key: 'welcome',
            avatarUrl: avatarUrl(recipient, 256),
            title: displayName(recipient),
            handle: recipient.username,
            subtitle: t('chat.beginning.dm', { name: recipient.username }),
        }
    }
    if (channel.type === ChannelType.GROUP_DM) {
        const name = computeChannelName(channel, users)
        return {
            type: 'welcome',
            key: 'welcome',
            glyph: '@',
            title: name,
            subtitle: t('chat.beginning.group', { name }),
        }
    }
    if (!channel.name) return undefined
    if (isThread(channel)) {
        // ChatBeginningRow for a thread or post: the name alone, and a post's applied tags.
        const parent = channels[channel.parent_id ?? '']
        const tags = isForumPost(channel, parent)
            ? (channel.applied_tags ?? []).flatMap(
                  tagId =>
                      parent?.available_tags
                          ?.filter(tag => tag.id === tagId)
                          .map(tag => ({
                              id: tag.id,
                              name: tag.name,
                              emojiUrl: tagEmojiUrl(tag),
                          })) ?? [],
              )
            : []
        return {
            type: 'welcome',
            key: 'welcome',
            icon: mentionIcon(channels, channel.id) ?? 'thread',
            title: channel.name,
            tags: tags.length > 0 ? tags : undefined,
        }
    }
    return {
        type: 'welcome',
        key: 'welcome',
        // ChatBeginningRowIcon: the text icon for every channel that is not a thread.
        icon: 'text',
        title: t('chat.beginning.title', { name: channel.name }),
        subtitle: t('chat.beginning.channel', { name: channel.name }),
    }
}

/** getTagProperties: a forum post owner's message, when it carries no bot tag. */
function isOriginalPoster(message: Message, context: RowContext): boolean {
    const channel = context.channel
    return (
        !message.author.bot &&
        channel?.owner_id === message.author.id &&
        isForumPost(channel, context.channels[channel.parent_id ?? ''])
    )
}

/** How much of a replied-to message the preview line keeps. */
const REPLY_TEXT_LIMIT = 200

/**
 * A message's spans as the one line of a reply preview. The reference parses it with the inline reply rules, which
 * leave out block quotes, code blocks and line breaks: those become plain text on one line, and mentions, emoji,
 * links and the other inline markup stay.
 */
export function replySpans(spans: Span[]): Span[] {
    const out: Span[] = []
    let length = 0
    for (const span of spans) {
        if (length >= REPLY_TEXT_LIMIT) break
        const {
            block,
            quote,
            heading,
            subtext,
            token,
            list,
            bullet,
            number,
            lastNumber,
            ...rest
        } = span
        const inline: Span = block ? { ...rest, code: true } : rest
        if (span.emoji) {
            out.push(inline)
            length += 1
            continue
        }
        let text = span.text.replace(/\s+/g, ' ')
        // The line starts without spaces; a space left at a span's end can lead the next.
        if (out.length === 0 || out.at(-1)?.text.endsWith(' '))
            text = text.trimStart()
        if (!text) continue
        text = text.slice(0, REPLY_TEXT_LIMIT - length)
        out.push({ ...inline, text })
        length += text.length
    }
    const last = out.at(-1)
    if (last && !last.emoji) last.text = last.text.trimEnd()
    return out.filter(span => span.emoji || span.text)
}

const MENTION_ICONS: Record<number, string> = {
    [ChannelType.GUILD_VOICE]: 'voice',
    [ChannelType.GUILD_STAGE_VOICE]: 'stage',
    [ChannelType.GUILD_FORUM]: 'forum',
    [ChannelType.GUILD_MEDIA]: 'media',
    [ChannelType.GUILD_ANNOUNCEMENT]: 'announcement',
}

/**
 * ChannelUtils.getMentionIconType for the channel types we know: threads are `thread` (`post` in a forum or media
 * channel). The NSFW, spoiler and locked variants need channel flags and permissions, which are not tracked.
 */
export function mentionIcon(
    channels: Record<string, Channel>,
    id: string,
): string | undefined {
    const channel = channels[id]
    if (!channel) return undefined
    if (isThread(channel)) {
        const parent = channel.parent_id
            ? channels[channel.parent_id]
            : undefined
        return parent?.type === ChannelType.GUILD_FORUM ||
            parent?.type === ChannelType.GUILD_MEDIA
            ? 'post'
            : 'thread'
    }
    return MENTION_ICONS[channel.type] ?? 'text'
}

/**
 * Whether a message mentions the user and is highlighted for it: by name (a reply ping lists the replied-to author
 * too), @everyone or @here, or a role the user has.
 */
export const mentionsUser = (
    message: Message,
    userId: string,
    myRoles: string[],
): boolean =>
    Boolean(
        message.mention_everyone ||
            message.mentions?.some(user => user.id === userId) ||
            message.mention_roles?.some(role => myRoles.includes(role)),
    )

/** What the row builders of one `buildRows` call share. */
interface RowEnv {
    context: RowContext
    resolver: MentionResolver
    nameOf: (user: User) => string
    /** The user with what the users store knows about them filled in. */
    userOf: (user: User) => User
    spansOf: EmbedSpans
    system: SystemEnv
    threadSources: ThreadEmbedSources
    /** The user who ran a command, as the interaction line draws them. */
    author: (user: NonNullable<InteractionMeta['user']>) => InteractionAuthor
}

/** What mentions resolve against: the viewed guild, its members and the known users and channels. */
export interface MentionSource {
    guild: Guild | undefined
    members: Record<string, Member> | undefined
    users: Record<string, User>
    channels: Record<string, Channel>
    onUnknownChannel?: (id: string) => void
}

/** Returns the names, colours and icons mentions are drawn with, in the message list and in the composer. */
export function mentionResolver(source: MentionSource): MentionResolver {
    const { guild, members, users } = source
    return {
        user: id =>
            users[id]
                ? (members?.[id]?.nick ?? displayName(users[id]))
                : undefined,
        role: id => {
            const role = guild?.roles[id]
            return guild && role?.name
                ? { name: role.name, ...roleColors(guild, role) }
                : undefined
        },
        channel: id => {
            const channel = source.channels[id]
            if (!channel) source.onUnknownChannel?.(id)
            return channel?.name
        },
        channelIcon: id => mentionIcon(source.channels, id),
        guildId: guild?.id,
        channelGuildId: id => source.channels[id]?.guild_id,
        guildName: id => (id === guild?.id ? guild.name : undefined),
    }
}

function makeEnv(context: RowContext): RowEnv {
    const { guild, members, users } = context
    const nameOf = (user: User) =>
        members?.[user.id]?.nick ?? displayName(users[user.id] ?? user)
    const avatarOf = (user: User, size: number) =>
        authorAvatarUrl(
            users[user.id] ?? user,
            members?.[user.id],
            guild?.id,
            size,
        )
    const colorOf = (user: User) => authorStyle(guild, members?.[user.id]).color
    const resolver = mentionResolver(context)
    return {
        context,
        resolver,
        nameOf,
        system: {
            name: nameOf,
            userLink: user => ({
                url: chatLink.user(user.id),
                color: colorOf(user),
            }),
            channel: id => context.channels[id],
            guild,
            plain: false,
            userId: context.session.userId,
            user: id => users[id],
            avatarUrl: avatarOf,
            spans: text => toSpans(parseMarkdown(text), resolver),
        },
        threadSources: {
            thread: id => context.threads?.[id] ?? context.channels[id],
            mostRecent: id => context.threadMessages?.[id],
            name: nameOf,
            color: colorOf,
            avatarUrl: avatarOf,
            preview: message =>
                messagePreview(message, markup =>
                    replySpans(toSpans(parseMarkdown(markup), resolver)),
                ),
        },
        userOf: user => ({ ...users[user.id], ...user }),
        author: user => {
            const style = authorStyle(guild, members?.[user.id])
            const known = { avatar: null, ...user }
            return {
                name: nameOf(known),
                authorColor: style.color,
                authorColors: style.colors,
                avatarUrl: avatarOf(known, INTERACTION_AVATAR_SIZE),
            }
        },
        // Embed titles and field names follow their own markdown rules; everything else the message rules.
        spansOf: (text, title) =>
            toSpans(
                title
                    ? parseEmbedTitle(text, title === 'links')
                    : parseMarkdown(text),
                resolver,
            ),
    }
}

/** The preview of the message a reply answers. */
function replyRow(message: Message, env: RowEnv): ReplyRow | undefined {
    if (message.type !== MessageType.REPLY) return undefined
    const { guild, members } = env.context
    const reference = message.referenced_message
    const ref = message.message_reference
    // Tapping the preview jumps to the replied-to message (see links.ts).
    const url = ref?.message_id
        ? chatLink.channel(
              ref.guild_id ?? guild?.id,
              ref.channel_id ?? message.channel_id,
              ref.message_id,
          )
        : undefined
    // The API sends null for a deleted message and leaves the field out when it could not fetch it.
    if (!reference) {
        return {
            state: 'note',
            text: t(
                reference === null
                    ? 'chat.reply.deleted'
                    : 'chat.reply.unloaded',
            ),
            // A deleted message is gone; one that merely did not load may still be there.
            url: reference === null ? undefined : url,
        }
    }
    // createMessageContent: isBlockedForMessage, then isIgnoredForMessage, as a note.
    const hidden = env.context.hiddenReason?.(reference.author.id)
    if (hidden)
        return { state: 'note', text: t(HIDDEN_REPLY_TEXT[hidden]), url }
    const author = env.userOf(reference.author)
    const member = members?.[author.id]
    const style = authorStyle(guild, member)
    const spans = replySpans(toSpans(parse(reference), env.resolver))
    const text = spans.map(span => span.text).join('')
    const sticker = !text && Boolean(reference.sticker_items?.length)
    // createMessageContent's reply preview: a components message has no text of its own to show.
    const componentsOnly = Boolean(
        ((reference as RichMessage).flags ?? 0) & MessageFlag.IS_COMPONENTS_V2,
    )
    return {
        state: 'loaded',
        authorName: env.nameOf(author),
        authorColor: style.color,
        authorColors: style.colors,
        authorAvatarUrl: authorAvatarUrl(author, member, guild?.id, 64),
        mention: Boolean(message.mentions?.some(user => user.id === author.id)),
        clanTag: clanTag(author),
        text: componentsOnly
            ? t('chat.reply.componentsV2')
            : text ||
              t(sticker ? 'chat.reply.sticker' : 'chat.attachmentReply'),
        attachment: !componentsOnly && !text && !sticker,
        spans: text && !componentsOnly ? spans : undefined,
        url,
    }
}

/**
 * A message's reaction chips. A reaction with super reactions gets its own super chip before the normal one
 * (ReactionView draws one kind per chip, keyed by emoji and isBurstReaction).
 */
export function reactionRows(
    reactions: Reaction[] = [],
): MessageRow['reactions'] {
    return reactions.flatMap(reaction => {
        const chip = {
            key: reaction.emoji.id
                ? `${reaction.emoji.name}:${reaction.emoji.id}`
                : (reaction.emoji.name ?? ''),
            emoji: reaction.emoji.name ?? '',
            emojiUrl: reaction.emoji.id
                ? emojiUrl(reaction.emoji.id, reaction.emoji.animated, 48)
                : reaction.emoji.name
                  ? twemojiUrl(reaction.emoji.name)
                  : undefined,
        }
        const { normal, burst } = reactionCounts(reaction)
        return [
            ...(burst > 0
                ? [
                      {
                          ...chip,
                          count: burst,
                          me: reaction.me_burst === true,
                          burst: true,
                          burstColors: burstColors(reaction.burst_colors),
                      },
                  ]
                : []),
            // A forum's default reaction on a post without any keeps its chip at 0 (useSomeForumPostReactions).
            ...(normal > 0 || burst === 0
                ? [{ ...chip, count: normal, me: reaction.me }]
                : []),
        ]
    })
}

/** Whether the add reaction button follows the reactions: only next to existing ones, below the limit. */
function canAddReaction(message: Message, context: RowContext): boolean {
    const count = message.reactions?.length ?? 0
    // A message without reactions is reacted to from the long-press sheet.
    return (
        count > 0 &&
        count < MAX_REACTIONS &&
        (context.canReact?.(message) ?? false)
    )
}

/** The text of a message, or none when it is only a link to the media it embeds. */
function contentSpans(
    message: Message,
    nodes: MarkdownNode[],
    embeds: ReturnType<typeof embedRows>,
    env: RowEnv,
): Span[] {
    if (!isUserMessage(message))
        return [
            {
                // A system message without a handler (system/index.ts).
                text: message.content || t('chat.system.unsupported'),
                italic: true,
            },
        ]
    // A message that is only one link, to the image or GIF it embeds, shows just the media
    // (hasOnlySimpleEmbed and isSingleLinkContent; the link is not compared with the embed's url).
    const onlyMediaLink =
        embeds.length === 1 &&
        embeds[0]?.media &&
        hasOnlySimpleEmbed(message.embeds) &&
        nodes.length === 1 &&
        nodes[0] !== undefined &&
        LINK_TYPES.has(nodes[0].type)
    return onlyMediaLink ? [] : toSpans(nodes, env.resolver)
}

function messageRow(
    message: Message,
    date: Date,
    grouped: boolean,
    env: RowEnv,
): MessageRow {
    const { context } = env
    const { guild, members, users } = context
    const nodes = parse(message)
    // A link written inside a spoiler hides what it embeds too (checkSpoilerEmbeds).
    const embeds = embedRows(
        message.embeds,
        env.spansOf,
        hasSpoilerLink(nodes) ? t('chat.media.spoiler') : undefined,
    )
    const content = contentSpans(message, nodes, embeds, env)
    const author = env.userOf(message.author)
    const member = members?.[author.id]
    const style = authorStyle(guild, member)
    const row: MessageRow = {
        type: 'message',
        key: message.id,
        id: message.id,
        grouped,
        authorName: env.nameOf(message.author),
        authorColor: style.color,
        authorColors: style.colors,
        avatarUrl: authorAvatarUrl(
            author,
            member,
            guild?.id,
            cdnSize(avatarSize),
        ),
        avatarDecorationUrl: decorationUrl(author, member),
        clanTag: clanTag(author),
        roleIcon: style.roleIcon,
        bot: Boolean(message.author.bot),
        originalPoster: isOriginalPoster(message, context)
            ? t('chat.originalPoster')
            : undefined,
        timestamp: calendarTimestamp(date),
        silent: isSilent(message) ? t('chat.silentMessage') : undefined,
        content,
        edited: message.edited_timestamp ? t('chat.edited') : undefined,
        jumbo: isUserMessage(message) && isJumbo(content),
        mentioned: mentionsUser(
            message,
            context.session.userId,
            guild?.myRoles ?? [],
        ),
        reply: replyRow(message, env),
        swipe: context.swipeActions?.(message),
        attachments: attachmentRows(message.attachments),
        embeds,
        stickers: stickerRows(message.sticker_items),
        addReaction: canAddReaction(message, context),
        reactions: reactionRows(message.reactions),
        thread: threadEmbedRow(message, guild?.id, env.threadSources),
        ...richParts(message, {
            spans: text => toSpans(parseMarkdown(text), env.resolver),
            embeds: list => embedRows(list, env.spansOf),
            pollState: id =>
                context.polls && (context.polls[id] ?? NO_POLL_STATE),
            author: env.author,
            channels: context.channels,
            users,
            session: context.session,
            guild: id => (id === guild?.id ? guild : context.guilds?.[id]),
            nameOf: env.nameOf,
            chatGuild: guild,
            interactions: context.interactions,
        }),
    }
    if (message.state) {
        row.status = message.state
        if (message.state === 'failed') row.statusLabel = t('chat.failed')
    }
    return row
}

/**
 * A thread's first message: the message it was started from, under the starter's id, without reactions or its
 * thread card (createMessageContent). Undefined for other messages, and when the API sent no parent.
 */
function threadStarterRow(
    message: Message,
    env: RowEnv,
): MessageRow | undefined {
    const parent = message.referenced_message
    if (message.type !== MessageType.THREAD_STARTER_MESSAGE || !parent)
        return undefined
    return {
        ...messageRow(
            parent,
            new Date(snowflakeTimestamp(parent.id)),
            false,
            env,
        ),
        key: message.id,
        id: message.id,
        reactions: [],
        addReaction: false,
        thread: undefined,
    }
}

const isSilent = (message: Message) =>
    Boolean((message.flags ?? 0) & MessageFlag.SUPPRESS_NOTIFICATIONS)

const hasMentions = (message: Message) =>
    Boolean(
        message.mention_everyone ||
            message.mentions?.length ||
            message.mention_roles?.length,
    )

/**
 * isNewMessageGroup's notification rule: a silent message under a normal one only breaks the group when the normal
 * one pinged someone, and a normal message under a silent one always does.
 */
const silenceBreaksGroup = (message: Message, older: Message) =>
    isSilent(older)
        ? !isSilent(message)
        : isSilent(message) && hasMentions(older)

/** Whether a message continues the run of the one below it (the older one): same author, day and short gap. */
function isGrouped(
    message: Message,
    date: Date,
    older: Message | undefined,
    olderDate: Date | undefined,
) {
    return Boolean(
        older &&
            olderDate &&
            isUserMessage(message) &&
            isUserMessage(older) &&
            // A reply or an interaction response draws its line above the header, so it starts a group.
            message.type !== MessageType.REPLY &&
            !INTERACTION_MESSAGE_TYPES.has(
                message.type ?? MessageType.DEFAULT,
            ) &&
            older.author.id === message.author.id &&
            !silenceBreaksGroup(message, older) &&
            sameDay(date, olderDate) &&
            date.getTime() - olderDate.getTime() < GROUP_WINDOW,
    )
}

/**
 * Pushes the dividers that sit above a message in the list: the "NEW" bar where reading stopped, then the date.
 * Messages are not always strictly ordered by id (a sent message takes its server id where its pending copy
 * was), so the read marker can fall between two pairs; only the first gets the divider, its key is unique.
 */
function dividerAdder(
    rows: ChatRow[],
    state: ChannelMessages,
    ackedId?: string,
) {
    let unreadPlaced = false
    return (
        message: Message,
        date: Date,
        older: Message | undefined,
        olderDate: Date | undefined,
    ) => {
        if (
            ackedId &&
            !unreadPlaced &&
            older &&
            compareSnowflakes(message.id, ackedId) > 0 &&
            compareSnowflakes(older.id, ackedId) <= 0
        ) {
            unreadPlaced = true
            rows.push({
                type: 'separator',
                key: 'unread',
                text: t('chat.unread'),
                unread: true,
            })
        }
        // A date divider sits above the first message of each day, and above the very first message.
        if (olderDate ? !sameDay(date, olderDate) : !state.hasMore) {
            rows.push({
                type: 'separator',
                key: `day-${message.id}`,
                text: formatLongDate(date),
            })
        }
    }
}

/** Adds the rows around the messages: the loading spinner, or the welcome row at the top of the history. */
function addEdgeRows(
    rows: ChatRow[],
    state: ChannelMessages,
    context: RowContext,
) {
    if (state.loading || state.hasMore)
        rows.push({
            type: 'loading',
            // A different key from the older-history spinner: a list keeps the row it shows by key,
            // so sharing one would carry the view from the skeleton to the oldest message.
            key: rows.length === 0 ? 'loading-initial' : 'loading',
            // Nothing loaded yet: skeleton messages; otherwise it is the older-history spinner.
            placeholder: rows.length === 0 || undefined,
        })
    else if (context.channel) {
        const welcome = welcomeRow(
            context.channel,
            context.users,
            context.channels,
        )
        if (welcome) rows.push(welcome)
    }
    // A detached window (a jump): a spinner at the newest end while newer pages are loaded.
    if (state.hasMoreAfter)
        rows.unshift({ type: 'loading', key: 'loading-newer' })
}

/** ForumPostActionBarReactions: reactions shown before "+N", one more when the user cannot add. */
const POST_SHOWN_REACTIONS = 2

/** The chat's channel when it is a forum post. */
function forumPostOf(context: RowContext): Channel | undefined {
    const { channel } = context
    return channel &&
        isForumPost(channel, context.channels[channel.parent_id ?? ''])
        ? channel
        : undefined
}

/**
 * ForumPostActionBar: the first message's reactions, "+N" for the rest, then Follow, Copy Link and Jump To Top.
 * Without `starter` only the buttons. Jump To Top scrolls to the first message (castChannelIdAsMessageId).
 */
function postActionsRow(
    post: Channel,
    starter: Message | undefined,
    context: RowContext,
    pinnedOnly: boolean,
): PostActionsRow {
    const addable =
        starter !== undefined && (context.canReact?.(starter) ?? false)
    const { shown, more, firstHidden } = forumPostReactions(
        starter?.reactions,
        context.channels[post.parent_id ?? '']?.default_reaction_emoji,
        POST_SHOWN_REACTIONS + (addable ? 0 : 1),
        false,
    )
    const following = isThreadJoined(post)
    return {
        type: 'postActions',
        key: 'post-actions',
        messageId: post.id,
        reactions: starter ? reactionRows(shown) : [],
        addReaction: addable,
        moreCount: starter ? more : 0,
        moreKey: firstHidden && keyOf(firstHidden.emoji),
        following,
        follow: {
            label: t(
                following
                    ? 'chat.threadBar.unfollowPost'
                    : 'chat.threadBar.followPost',
            ),
            text: t(
                following
                    ? 'chat.threadBar.following'
                    : 'chat.threadBar.follow',
            ),
            url: chatLink.post(
                post.id,
                following ? PostLinkAction.unfollow : PostLinkAction.follow,
            ),
        },
        copyLink: {
            label: t('chat.linkOptions.copyLink'),
            url: chatLink.post(post.id, PostLinkAction.copyLink),
        },
        jumpToTop: {
            label: t('chat.threadBar.jumpToTop'),
            url: chatLink.channel(post.guild_id, post.id, post.id),
        },
        pinnedOnly: pinnedOnly || undefined,
    }
}

const HIDDEN_TEXT = {
    blocked: {
        one: 'chat.hidden.blocked.one',
        other: 'chat.hidden.blocked.other',
    },
    ignored: {
        one: 'chat.hidden.ignored.one',
        other: 'chat.hidden.ignored.other',
    },
} as const

/** A group of hidden messages being filled, and why they are hidden. */
/** The reply preview's note for a hidden author. */
const HIDDEN_REPLY_TEXT = {
    blocked: 'chat.reply.blocked',
    ignored: 'chat.reply.ignored',
} as const satisfies Record<HiddenReason, string>

interface HiddenRun {
    row: HiddenGroupRow
    reason: HiddenReason
}

/**
 * createChannelStream's BLOCKED_GROUP and IGNORED_GROUP: adds a message to the group right above the last row, or
 * starts one. A divider or another row in between starts a new group. Keyed by the oldest message.
 */
function addHidden(
    rows: ChatRow[],
    run: HiddenRun | undefined,
    built: MessageRow | SystemRow,
    reason: HiddenReason,
    revealedId: string | undefined,
): HiddenRun {
    const current =
        run && run.reason === reason && rows.at(-1) === run.row
            ? run
            : undefined
    const row: HiddenGroupRow = current?.row ?? {
        type: 'hiddenGroup',
        key: '',
        text: '',
        revealed: false,
        url: '',
        messages: [],
    }
    if (!current) rows.push(row)
    row.messages.push(built)
    row.key = `hidden-${built.id}`
    // Stays open when older history adds to the group and moves its key.
    row.revealed ||= built.id === revealedId
    // An open group toggles by the id it was opened with, so the tap closes it.
    row.url = chatLink.reveal(
        row.revealed && revealedId ? revealedId : built.id,
    )
    const count = row.messages.length
    row.text = t(HIDDEN_TEXT[reason][count === 1 ? 'one' : 'other'], {
        count,
    })
    return { row, reason }
}

/** Turns a channel's loaded messages into renderer rows, newest first. */
export function buildRows(
    state: ChannelMessages | undefined,
    context: RowContext,
): ChatRow[] {
    const work = buildRowsIncrementally(state, context)
    let step = work.next()
    while (!step.done) step = work.next()
    return step.value
}

/** Builds the same rows, yielding after each message. */
export function* buildRowsIncrementally(
    state: ChannelMessages | undefined,
    context: RowContext,
): Generator<void, ChatRow[]> {
    if (!state)
        return [{ type: 'loading', key: 'loading-initial', placeholder: true }]
    const env = makeEnv(context)
    const rows: ChatRow[] = []
    const addDividers = dividerAdder(rows, state, context.ackedId)
    const post = forumPostOf(context)
    let postActionsPlaced = false
    let hidden: HiddenRun | undefined
    for (const [index, held] of state.messages.entries()) {
        let message = held
        // The post's action bar sits under its first message and shows its reactions instead.
        if (post && held.id === post.id) {
            rows.push(postActionsRow(post, held, context, false))
            postActionsPlaced = true
            message = { ...held, reactions: undefined }
        }
        const older = state.messages[index + 1]
        // The id encodes the send time, which avoids parsing the API's microsecond timestamps.
        const date = new Date(snowflakeTimestamp(message.id))
        const olderDate = older && new Date(snowflakeTimestamp(older.id))
        const built =
            threadStarterRow(message, env) ??
            systemRow(message, env.system, {
                timestamp: calendarTimestamp(date),
                reactions: reactionRows(message.reactions),
                addReaction: canAddReaction(message, context),
                thread: threadEmbedRow(
                    message,
                    context.guild?.id,
                    env.threadSources,
                ),
            }) ??
            messageRow(
                message,
                date,
                isGrouped(message, date, older, olderDate),
                env,
            )
        const reason = context.hiddenReason?.(message.author.id)
        if (reason)
            hidden = addHidden(rows, hidden, built, reason, state.revealedId)
        else rows.push(built)
        addDividers(message, date, older, olderDate)
        yield
    }
    if (post && !postActionsPlaced)
        rows.push(postActionsRow(post, context.forumPostStarter, context, true))
    addEdgeRows(rows, state, context)
    return rows
}
