import { emojiUrl } from '../../../core/discord/cdn'
import { t } from '../../../i18n'
import { chatLink } from '../links/chatLink'
import { formatTimestamp } from '../timestamp'
import type { TimestampStyle } from '../timestamp'
import type { MarkdownNode, MentionResolver } from './markdown'
import type { Span } from './rows'

/** Stands in for an icon in the text (copied or read out); the renderer draws the icon in its place. */
const ICON_ALT = '￼'
/** The separator between a guild and a channel, and a channel and a message (the reference's `ic_caret_24px`). */
const CARET = { icon: 'caret' }
/** The longest guild or channel name in a mention (the reference's `truncateText(name, 32)`). */
const MENTION_NAME_LIMIT = 32
type Piece = string | { icon: string }

/** One run of text with the styles it adds to the surrounding ones. */
interface Run {
    text: string
    extra: Partial<Span>
}

const truncate = (name: string) =>
    name.length <= MENTION_NAME_LIMIT
        ? name
        : `${name.slice(0, MENTION_NAME_LIMIT - 1)}…`

/** A mention made of text and icons, which share its link and colours. */
function mention(pieces: Piece[], extra: Partial<Span>): Run[] {
    return pieces.map(piece =>
        typeof piece === 'string'
            ? { text: piece, extra: { mention: true, ...extra } }
            : {
                  text: ICON_ALT,
                  extra: { mention: true, icon: piece.icon, link: extra.link },
              },
    )
}

function channelLinkRuns(node: MarkdownNode, resolve: MentionResolver) {
    const guildId = node.guild as string
    const name = resolve.channel(node.channel)
    const guild =
        guildId !== resolve.guildId && guildId !== '@me'
            ? resolve.guildName?.(guildId)
            : undefined
    // Unknown channels show an italic "unknown" and no message icon; DMs have no channel icon.
    return mention(
        [
            ...(guild ? [truncate(guild), CARET] : []),
            ...(guildId === '@me' && name !== undefined
                ? []
                : [{ icon: resolve.channelIcon?.(node.channel) ?? 'text' }]),
            name === undefined ? t('markdown.unknownChannel') : truncate(name),
            ...(node.message && name !== undefined
                ? [CARET, { icon: 'message' }]
                : []),
        ],
        {
            link: chatLink.channel(guildId, node.channel, node.message),
            ...(name === undefined ? { italic: true } : {}),
        },
    )
}

function channelRuns(node: MarkdownNode, resolve: MentionResolver) {
    const name = resolve.channel(node.id)
    const channelGuild = resolve.channelGuildId?.(node.id)
    const guildId = channelGuild ?? resolve.guildId ?? '@me'
    // Channels of another guild are prefixed with the guild's name.
    const guild =
        channelGuild && channelGuild !== resolve.guildId
            ? resolve.guildName?.(channelGuild)
            : undefined
    return mention(
        [
            ...(guild ? [truncate(guild), CARET] : []),
            { icon: resolve.channelIcon?.(node.id) ?? 'text' },
            name === undefined ? t('markdown.unknownChannel') : truncate(name),
        ],
        {
            link: chatLink.channel(guildId, node.id),
            ...(name === undefined ? { italic: true } : {}),
        },
    )
}

function staticRouteRuns(node: MarkdownNode, resolve: MentionResolver) {
    const guildId = resolve.guildId ?? '@me'
    // Only linked roles carry an item (the role's name).
    const item =
        node.route === 'linked-roles' && node.item
            ? resolve.role(node.item)?.name
            : undefined
    const label = t(`markdown.nav.${node.route}` as 'markdown.nav.home')
    // The icon is the route's name (guide and home share the sign post).
    return mention(
        [{ icon: node.route as string }, label, ...(item ? [CARET, item] : [])],
        { link: chatLink.nav(guildId, node.route, node.item) },
    )
}

function roleRun(node: MarkdownNode, resolve: MentionResolver): Run {
    const role = resolve.role(node.id)
    // Enhanced role colours: the text takes the gradient, the pill the primary colour (ERC eligible).
    return {
        text: `@${role?.name ?? 'unknown-role'}`,
        extra: {
            mention: true,
            color: role?.color,
            ...(role?.colors ? { colors: role.colors } : {}),
            link: chatLink.role(node.id),
        },
    }
}

function timestampRun(node: MarkdownNode): Run {
    const text = formatTimestamp(
        node.seconds,
        node.style as TimestampStyle | undefined,
    )
    if (text === undefined) return { text: node.raw, extra: {} }
    const full = formatTimestamp(node.seconds, 'F') ?? text
    return {
        text,
        extra: { timestamp: true, link: chatLink.timestamp(full) },
    }
}

/**
 * The runs of a mention-like node (user, role, channel, command, emoji, timestamp, ...), or undefined for any
 * other node. `style` is the surrounding style, whose link an emoji keeps.
 */
export function mentionRuns(
    node: MarkdownNode,
    resolve: MentionResolver,
    style: Partial<Span>,
): Run[] | undefined {
    switch (node.type) {
        case 'channelLink':
            return channelLinkRuns(node, resolve)
        case 'channel':
            return channelRuns(node, resolve)
        case 'staticRoute':
            return staticRouteRuns(node, resolve)
        case 'role':
            return [roleRun(node, resolve)]
        case 'timestamp':
            return [timestampRun(node)]
        case 'user':
            return [
                {
                    text: `@${resolve.user(node.id) ?? 'unknown-user'}`,
                    extra: { mention: true, link: chatLink.user(node.id) },
                },
            ]
        case 'command':
            // The reference draws a plain "/" in front of the name, in bold.
            return [
                {
                    text: `/${node.name}`,
                    extra: {
                        mention: true,
                        bold: true,
                        link: chatLink.command(node.id, node.name),
                    },
                },
            ]
        case 'everyone':
            // @everyone opens the members sheet of the @everyone role (its id is the guild's); @here does nothing.
            return [
                {
                    text: `@${node.name}`,
                    extra: {
                        mention: true,
                        link:
                            node.name === 'everyone' && resolve.guildId
                                ? chatLink.role(resolve.guildId)
                                : undefined,
                    },
                },
            ]
        case 'emoji':
            return [
                {
                    text: `:${node.name}:`,
                    extra: {
                        emoji: emojiUrl(node.id, node.animated, 96),
                        link:
                            style.link ??
                            chatLink.customEmoji(
                                node.id,
                                node.name,
                                !!node.animated,
                            ),
                    },
                },
            ]
    }
}
