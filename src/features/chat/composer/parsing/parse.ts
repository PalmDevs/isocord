import { emojiUrl } from '../../../../core/discord/cdn'
import { ChannelType } from '../../../../core/discord/channelType'
import { nodeType } from '../../../../native/NativeIsocordConstants'
import { isPrivate } from '../../../../stores/channels/channels'
import { displayName } from '../../../../stores/users'
import { argb, rgbInt } from '../../color'
import { mentionResolver } from '../../rows/buildRows'
import { parseMarkdown, STATIC_ROUTE, toSpans } from '../../rows/markdown'
import type { UnistylesThemes } from 'react-native-unistyles'
import type { Channel } from '../../../../stores/channels/channels'
import type { Guild } from '../../../../stores/guilds'
import type { Member } from '../../../../stores/members'
import type { User } from '../../../../stores/users'
import type { MentionResolver } from '../../rows/markdown'
import type { ResolvedEmoji } from './slots'

/**
 * One styled range of the composer text, as the native input expects it (android/.../input/StyleBlocks.kt).
 * Colours are ARGB integers, `cornerRadius` is in dp.
 */
/** One run of a pill: text, or an icon drawn in place of it (rows.ts `Span.icon`). */
interface MentionRun {
    text: string
    icon?: string
}

interface StyleBlock {
    location: number
    length: number
    type: number
    color?: number
    backgroundColor?: number
    cornerRadius?: number
    bold?: boolean
    italic?: boolean
    strikethrough?: boolean
    underline?: boolean
    monospace?: boolean
    imageUrl?: string
    /** Drawn in the pill in place of the text. */
    runs?: MentionRun[]
    deleteNodeOnBackspace?: boolean
    editDisabled?: boolean
}

export interface ParseContext {
    guild: Guild | undefined
    channel: Channel | undefined
    users: Record<string, User>
    members: Record<string, Member> | undefined
    channels: Record<string, Channel>
    /** Channel ids of the guild, for `#channel`. */
    guildChannelIds: string[]
    canMentionEveryone: boolean
    resolveEmoji?: (name: string) => ResolvedEmoji | undefined
}

type Colors = UnistylesThemes[keyof UnistylesThemes]['colors']

const MAX_BLOCKS = 300
/** Longest name a mention can have: usernames and nicknames stop at 32. */
const MAX_NAME = 32
const WORD = /[\p{L}\p{N}_]/u

interface Token {
    start: number
    end: number
    type: number
    /** What the text becomes when sent. */
    replacement?: string
    color?: number
    imageUrl?: string
}

interface NameIndex {
    map: Map<string, string>
}

// Rebuilt only when the data it reads is replaced, not on every keystroke.
let indexKey: unknown[] = []
let indexValue: NameIndex = { map: new Map() }

function userNames(context: ParseContext): NameIndex {
    const { channel, members, users, guild } = context
    const key = [members, users, channel?.recipient_ids, guild?.id]
    if (key.every((value, index) => value === indexKey[index]))
        return indexValue
    const map = new Map<string, string>()
    const add = (name: string | null | undefined, id: string) => {
        if (name && !map.has(name)) map.set(name, id)
    }
    const ids =
        channel && isPrivate(channel)
            ? (channel.recipient_ids ?? [])
            : Object.keys(members ?? {})
    for (const id of ids) {
        add(members?.[id]?.nick, id)
        add(users[id]?.global_name, id)
        add(users[id]?.username, id)
    }
    indexKey = key
    indexValue = { map }
    return indexValue
}

const channelHasName = (channel: Channel | undefined) =>
    channel?.name !== undefined && channel.type !== ChannelType.GUILD_CATEGORY

/** Ranges of code spans and blocks: nothing inside them is a mention or markdown. */
function codeRanges(text: string): Array<[number, number]> {
    const ranges: Array<[number, number]> = []
    const pattern = /```[\s\S]*?(?:```|$)|``[^\n]+?``|`[^`\n]+`/g
    for (let match = pattern.exec(text); match; match = pattern.exec(text))
        ranges.push([match.index, match.index + match[0].length])
    return ranges
}

const inRanges = (ranges: Array<[number, number]>, position: number) =>
    ranges.some(([start, end]) => position >= start && position < end)

/**
 * The `:name:` that ends at `cursor`, just closed by typing its second colon, when `lookup` knows the name (our own
 * addition, not found in the reference's native ChatInput). Not inside code, and not the `:name:`
 * of a written-out custom emoji or a time like `12:30:`.
 */
export function typedShortcode(
    text: string,
    cursor: number,
    lookup: (name: string) => string | undefined,
): { location: number; length: number; text: string } | undefined {
    const match = /(?<![<\w:]):([\w+-]{2,32}):$/.exec(text.slice(0, cursor))
    if (!match || inRanges(codeRanges(text), match.index)) return undefined
    const emoji = lookup(match[1] ?? '')
    return emoji
        ? { location: match.index, length: match[0].length, text: emoji }
        : undefined
}

/** Mentions, channels, emoji and `@silent` in the text: what is highlighted, and what each becomes when sent. */
function scanTokens(text: string, context: ParseContext): Token[] {
    const tokens: Token[] = []
    if (text.length === 0) return tokens
    const code = codeRanges(text)
    const taken = (start: number) => inRanges(code, start)

    if (/^@silent(\s|$)/.test(text)) {
        tokens.push({
            start: 0,
            end: 7,
            type: nodeType.SILENT_HIGHLIGHT,
            replacement: '',
        })
    }

    // Custom emoji written out: <:name:id> and <a:name:id>.
    const emoji = /<(a?):(\w{2,32}):(\d{15,25})>/g
    for (let m = emoji.exec(text); m; m = emoji.exec(text)) {
        if (taken(m.index)) continue
        tokens.push({
            start: m.index,
            end: m.index + m[0].length,
            type: nodeType.EMOJI_HIGHLIGHT,
            imageUrl: emojiUrl(m[3] ?? '', m[1] === 'a', 48),
        })
    }
    // `:name:` of an emoji the user can use; `:name~N:` for one whose name is taken (EmojiDisambiguations).
    if (context.resolveEmoji && text.includes(':')) {
        const short = /(?<![<\w]):(\w{2,32}(?:~\d+)?):/g
        for (let m = short.exec(text); m; m = short.exec(text)) {
            if (taken(m.index)) continue
            const found = context.resolveEmoji(m[1] ?? '')
            if (!found) continue
            tokens.push({
                start: m.index,
                end: m.index + m[0].length,
                type: nodeType.EMOJI_HIGHLIGHT,
                replacement: `<${found.animated ? 'a' : ''}:${found.name}:${found.id}>`,
                imageUrl: emojiUrl(found.id, found.animated, 48),
            })
        }
    }

    const names = userNames(context)
    const roles = context.canMentionEveryone
        ? Object.values(context.guild?.roles ?? {}).filter(
              role => role.id !== context.guild?.id && role.name,
          )
        : []
    const roleByName = new Map(roles.map(role => [role.name as string, role]))

    for (
        let at = text.indexOf('@');
        at !== -1;
        at = text.indexOf('@', at + 1)
    ) {
        if (taken(at)) continue
        // user@example.com is an address, not a mention.
        if (at > 0 && WORD.test(text.charAt(at - 1))) continue
        const rest = text.slice(at + 1, at + 1 + MAX_NAME)
        if (context.canMentionEveryone) {
            const everyone = /^(everyone|here)(?![\p{L}\p{N}_])/u.exec(rest)
            if (everyone) {
                tokens.push({
                    start: at,
                    end: at + 1 + everyone[0].length,
                    type: nodeType.ROLE_HIGHLIGHT,
                })
                continue
            }
        }
        for (let length = rest.length; length > 0; length--) {
            if (length < rest.length && WORD.test(rest.charAt(length))) continue
            const name = rest.slice(0, length)
            const userId = names.map.get(name)
            if (userId) {
                tokens.push({
                    start: at,
                    end: at + 1 + length,
                    type: nodeType.USER_HIGHLIGHT,
                    replacement: `<@${userId}>`,
                })
                break
            }
            const role = roleByName.get(name)
            if (role) {
                tokens.push({
                    start: at,
                    end: at + 1 + length,
                    type: nodeType.ROLE_HIGHLIGHT,
                    replacement: `<@&${role.id}>`,
                    color: rgbInt(role.color),
                })
                break
            }
        }
    }

    // #channel, or #"channel name" for names with spaces (threads).
    if (context.guild && text.includes('#')) {
        const byName = new Map<string, string>()
        for (const id of context.guildChannelIds) {
            const channel = context.channels[id]
            if (channelHasName(channel) && !byName.has(channel?.name as string))
                byName.set(channel?.name as string, id)
        }
        const pattern = /#(?:"((?:[^"\\]|\\.)+)"|([^\s#@<>"]+))/g
        for (let m = pattern.exec(text); m; m = pattern.exec(text)) {
            if (taken(m.index)) continue
            let name = m[1]?.replace(/\\(.)/g, '$1') ?? m[2] ?? ''
            let length = m[0].length
            let id = byName.get(name)
            // "#general," is the channel followed by a comma.
            while (
                !id &&
                m[2] &&
                name.length > 1 &&
                /[.,!?;:)\]]$/.test(name)
            ) {
                name = name.slice(0, -1)
                length--
                id = byName.get(name)
            }
            if (!id) continue
            tokens.push({
                start: m.index,
                end: m.index + length,
                type: nodeType.CHANNEL_HIGHLIGHT,
                replacement: `<#${id}>`,
            })
        }
    }
    tokens.push(...writtenOutTokens(text, context, taken))
    return tokens.sort((a, b) => a.start - b.start)
}

/** A user's name in the mention: the server nickname, else the display name. */
function memberName(context: ParseContext, id: string): string | undefined {
    const user = context.users[id]
    return user ? (context.members?.[id]?.nick ?? displayName(user)) : undefined
}

/** Mentions already in their sent form, pasted or typed: `<@id>`, `<@&id>`, `<#id>` and `<id:route>`. */
function writtenOutTokens(
    text: string,
    context: ParseContext,
    taken: (start: number) => boolean,
): Token[] {
    const tokens: Token[] = []
    if (!text.includes('<')) return tokens
    const pattern = new RegExp(
        `<@!?(\\d+)>|<@&(\\d+)>|<#(\\d+)>|${STATIC_ROUTE.source}`,
        'g',
    )
    for (let m = pattern.exec(text); m; m = pattern.exec(text)) {
        if (taken(m.index)) continue
        const [, userId, roleId] = m
        const role = roleId ? context.guild?.roles[roleId] : undefined
        tokens.push({
            start: m.index,
            end: m.index + m[0].length,
            type: userId
                ? nodeType.USER_HIGHLIGHT
                : roleId
                  ? nodeType.ROLE_HIGHLIGHT
                  : nodeType.CHANNEL_HIGHLIGHT,
            color: role ? rgbInt(role.color) : undefined,
        })
    }
    return tokens
}

/** A pill's text and icons: its sent form drawn as the message list draws it (rows/markdownMentions.ts). */
function mentionRuns(sent: string, resolver: MentionResolver): MentionRun[] {
    return toSpans(parseMarkdown(sent), resolver).map(({ text, icon }) =>
        icon ? { text, icon } : { text },
    )
}

/** Drops tokens that overlap an earlier one. */
function disjoint(tokens: Token[]): Token[] {
    const result: Token[] = []
    let end = 0
    for (const token of tokens) {
        if (token.start < end) continue
        result.push(token)
        end = token.end
    }
    return result
}

/** The message text as it is sent: `@name` becomes `<@id>`, `#channel` `<#id>`, and a leading `@silent` is a flag. */
export function serializeMessage(
    text: string,
    context: ParseContext,
): { content: string; silent: boolean } {
    let out = ''
    let cursor = 0
    let silent = false
    for (const token of disjoint(scanTokens(text, context))) {
        if (token.type === nodeType.SILENT_HIGHLIGHT) silent = true
        if (token.replacement === undefined) continue
        out += text.slice(cursor, token.start) + token.replacement
        cursor = token.end
    }
    out += text.slice(cursor)
    return { content: out.trim(), silent }
}

/** The inverse, for editing: `<@id>` shows as `@name` again. Anything unknown is left as it is. */
export function unparseMessage(content: string, context: ParseContext): string {
    return content
        .replace(/<@!?(\d+)>/g, (all, id: string) => {
            const name = memberName(context, id)
            return name ? `@${name}` : all
        })
        .replace(/<@&(\d+)>/g, (all, id: string) => {
            const name = context.guild?.roles[id]?.name
            return name ? `@${name}` : all
        })
        .replace(/<#(\d+)>/g, (all, id: string) => {
            const name = context.channels[id]?.name
            if (!name) return all
            return /^[^\s#@<>"]+$/.test(name)
                ? `#${name}`
                : `#"${name.replace(/(["\\])/g, '\\$1')}"`
        })
}

interface InlineRule {
    pattern: RegExp
    /** Characters of syntax on each side. */
    marker: number
    /** Characters before the opening marker that belong to the pattern but not to the node. */
    prefix?: boolean
    style: Pick<
        StyleBlock,
        'bold' | 'italic' | 'strikethrough' | 'underline'
    > & {
        spoiler?: boolean
    }
}

const INLINE_RULES: InlineRule[] = [
    {
        pattern: /\*\*(?=\S)[\s\S]*?\S\*\*(?!\*)/g,
        marker: 2,
        style: { bold: true },
    },
    {
        pattern: /__(?=\S)[\s\S]*?\S__(?!_)/g,
        marker: 2,
        style: { underline: true },
    },
    {
        pattern: /~~(?=\S)[\s\S]*?\S~~/g,
        marker: 2,
        style: { strikethrough: true },
    },
    { pattern: /\|\|[\s\S]+?\|\|/g, marker: 2, style: { spoiler: true } },
    {
        pattern: /\*(?![\s*])[^*\n]+?\*(?!\*)/g,
        marker: 1,
        style: { italic: true },
    },
    {
        pattern: /(?:^|[^\w\\])_(?![\s_])[^_\n]+?_(?!\w)/g,
        marker: 1,
        prefix: true,
        style: { italic: true },
    },
]

/** Styles for the composer text: markdown, mentions, channels and emoji, in the order they are drawn. */
export function styleBlocks(
    text: string,
    context: ParseContext,
    colors: Colors,
): StyleBlock[] {
    if (text.length === 0) return []
    const blocks: StyleBlock[] = []
    const muted = argb(colors.TEXT_MUTED)
    const dim = (location: number, length: number) =>
        blocks.push({
            location,
            length,
            type: nodeType.MARKDOWN,
            color: muted,
        })

    const code = codeRanges(text)
    // Code is excluded from the other rules by hiding it from their patterns.
    let masked = text
    for (const [start, end] of code) {
        masked =
            masked.slice(0, start) +
            '\u0000'.repeat(end - start) +
            masked.slice(end)
        const source = text.slice(start, end)
        const fence = source.startsWith('```')
            ? 3
            : source.startsWith('``')
              ? 2
              : 1
        const closed =
            source.length >= fence * 2 && source.endsWith('`'.repeat(fence))
        const inner = source.length - fence - (closed ? fence : 0)
        dim(start, fence)
        if (inner > 0)
            blocks.push({
                location: start + fence,
                length: inner,
                type: nodeType.MARKDOWN,
                monospace: true,
                backgroundColor: argb(colors.BACKGROUND_CODE),
            })
        if (closed) dim(end - fence, fence)
    }

    for (const rule of INLINE_RULES) {
        rule.pattern.lastIndex = 0
        for (
            let m = rule.pattern.exec(masked);
            m;
            m = rule.pattern.exec(masked)
        ) {
            const lead = rule.prefix && !m[0].startsWith('_') ? 1 : 0
            const start = m.index + lead
            const length = m[0].length - lead
            const inner = length - rule.marker * 2
            if (inner <= 0) continue
            dim(start, rule.marker)
            const { spoiler, ...style } = rule.style
            blocks.push({
                location: start + rule.marker,
                length: inner,
                type: nodeType.MARKDOWN,
                ...style,
                ...(spoiler && {
                    backgroundColor: argb(colors.SPOILER_REVEALED_BACKGROUND),
                }),
            })
            dim(start + length - rule.marker, rule.marker)
        }
    }

    const resolver = mentionResolver(context)
    // Mentions go last so their colours win where they overlap markdown.
    for (const token of disjoint(scanTokens(text, context))) {
        const length = token.end - token.start
        if (token.imageUrl) {
            blocks.push({
                location: token.start,
                length,
                type: token.type,
                imageUrl: token.imageUrl,
            })
        } else {
            blocks.push({
                location: token.start,
                length,
                type: token.type,
                color: token.color ?? argb(colors.MENTION_FOREGROUND),
                runs: mentionRuns(
                    token.replacement ?? text.slice(token.start, token.end),
                    resolver,
                ),
                backgroundColor: argb(colors.MENTION_BACKGROUND),
                cornerRadius: 4,
                deleteNodeOnBackspace: false,
                editDisabled: false,
            })
        }
    }
    return blocks.length > MAX_BLOCKS ? blocks.slice(-MAX_BLOCKS) : blocks
}
