import SimpleMarkdown from 'simple-markdown'
import { splitEmoji } from '../emoji'
import { chatLink } from '../links/chatLink'
import { highlightCode } from './highlight'
import { mentionRuns } from './markdownMentions'
import type { ParserRule, SingleASTNode } from 'simple-markdown'
import type { Span } from './rows'

/** `<id:route>` and `<id:route:item>`: a server's home, browse, customize, guide or linked roles. */
export const STATIC_ROUTE =
    /<id:(home|browse|customize|guide|linked-roles)(?::(\d+))?>/

const defaults = SimpleMarkdown.defaultRules
const atLineStart = (previous: string) =>
    previous === '' || /\n *$/.test(previous)

/** Builds a rule that matches `regex` at the cursor and stores its groups as node fields. */
function token(
    order: number,
    regex: RegExp,
    parse: (capture: RegExpExecArray) => object,
): ParserRule {
    return {
        order,
        match: source => regex.exec(source),
        parse: capture => parse(capture as RegExpExecArray),
    }
}

// The reference's text rule: like simple-markdown's, but it also stops before `1.` so ordered lists can start a line.
const TEXT = /^[\s\S]+?(?=[^0-9A-Za-z\sÀ-￿]|\n\n| {2,}\n|\w+:\S|[0-9]+\.|$)/

// The reference's list item and block patterns: `*`, `-` and `1.` bullets, ending at the first line that is
// neither indented nor another item of the same list.
const LIST_BLOCK =
    /^( *)((?:[*-]|\d+\.)) [\s\S]+?(?:\n(?! )(?!\1(?:[*-]|\d+\.) )|$)/

// Discord message links, with the reference's accepted hosts.
const CHANNEL_URL =
    /^https:\/\/(?:(?:canary\.|ptb\.)?discord(?:app)?\.com)\/channels\/(\d+|@me)\/(\d+)(?:\/(\d+))?\/?(?:[?#][^\s<>]*)?/

type Capture = RegExpExecArray

/**
 * Discord-flavoured markdown: the inline subset of simple-markdown (the parser the
 * reference client is built on) plus lists, headings, subtext, mentions, custom emoji,
 * spoilers and timestamps.
 */
const rules: Record<string, ParserRule> = {
    codeBlock: {
        order: defaults.codeBlock.order,
        match: source =>
            /^```(?:([a-z0-9_+\-.#]+?)\n)?\n*([^\n][\s\S]*?)\n*```/i.exec(
                source,
            ),
        parse: capture => ({ lang: capture[1], content: capture[2] }),
    },
    blockQuote: {
        order: defaults.blockQuote.order,
        match: (source, state, previous) =>
            state.inQuote || !atLineStart(previous)
                ? null
                : /^(?: *>>> ([\s\S]*)| *> [^\n]*(?:\n *> [^\n]*)*\n?)/.exec(
                      source,
                  ),
        parse: (capture, parse, state) => {
            const inner =
                capture[1] ?? (capture[0] ?? '').replace(/^ *> ?/gm, '')
            return { content: parse(inner, { ...state, inQuote: true }) }
        },
    },
    heading: {
        order: defaults.heading.order,
        match: (source, state, previous) =>
            // Headings are not allowed inside list items.
            atLineStart(previous) && !state._list
                ? /^ *(#{1,3})(?:\s+)((?!\s*#{1,3}\s)[^\n]+?)#*\s*(?:\n|$)/.exec(
                      source,
                  )
                : null,
        parse: (capture, parse, state) => ({
            level: (capture[1] ?? '').length,
            content: parse(capture[2] ?? '', state),
        }),
    },
    subtext: {
        order: defaults.heading.order,
        match: (source, state, previous) =>
            atLineStart(previous) && !state.inSubtext
                ? /^ *-# +((?!-#)[^\n]+)(?:\n|$)/.exec(source)
                : null,
        parse: (capture, parse, state) => ({
            content: parse((capture[1] ?? '').trim(), {
                ...state,
                inSubtext: true,
            }),
        }),
    },
    list: {
        order: defaults.list.order,
        match: (source, _state, previous) => {
            const behind = /(?:^|\n)( *)$/.exec(previous)
            if (!behind) return null
            const indent = behind[1] ?? ''
            // The indentation was already consumed as text, so it is matched again and then left out of the capture.
            const block = LIST_BLOCK.exec(indent + source)
            if (!block) return null
            const capture = [
                block[0].slice(indent.length),
                indent,
                block[2],
            ] as unknown as Capture & {
                block: string
            }
            capture.block = block[0]
            return capture
        },
        parse: (capture, parse, state) => {
            const { block } = capture as unknown as { block: string }
            const indent = capture[1] ?? ''
            const dedent = new RegExp(`^ {0,${indent.length}}`)
            const content = block
                .split('\n')
                .map(line => line.replace(dedent, ''))
                .join('\n')
            return defaults.list.parse(
                [content, '', capture[2] ?? ''] as unknown as Capture,
                parse,
                state,
            )
        },
    },
    escape: defaults.escape,
    autolink: defaults.autolink,
    channelLink: {
        order: defaults.url.order - 0.5,
        match: source => CHANNEL_URL.exec(source),
        parse: capture => ({
            guild: capture[1],
            channel: capture[2],
            message: capture[3],
        }),
    },
    url: defaults.url,
    link: defaults.link,
    strong: defaults.strong,
    em: defaults.em,
    u: defaults.u,
    del: {
        ...defaults.del,
        match: source => /^~~([\s\S]+?)~~(?!_)/.exec(source),
    },
    inlineCode: defaults.inlineCode,
    spoiler: {
        order: defaults.text.order - 1,
        match: source => /^\|\|([\s\S]+?)\|\|/.exec(source),
        parse: (capture, parse, state) => ({
            content: parse(capture[1] ?? '', state),
        }),
    },
    user: token(defaults.text.order - 1, /^<@!?(\d+)>/, capture => ({
        id: capture[1],
    })),
    role: token(defaults.text.order - 1, /^<@&(\d+)>/, capture => ({
        id: capture[1],
    })),
    channel: token(defaults.text.order - 1, /^<#(\d+)>/, capture => ({
        id: capture[1],
    })),
    command: token(
        defaults.text.order - 1,
        /^<\/([-_\p{L}\p{N}]+(?: [-_\p{L}\p{N}]+){0,2}):(\d+)>/u,
        capture => ({
            name: capture[1],
            id: capture[2],
        }),
    ),
    staticRoute: token(
        defaults.text.order - 1,
        new RegExp(`^${STATIC_ROUTE.source}`),
        capture => ({ route: capture[1], item: capture[2] }),
    ),
    everyone: {
        order: defaults.text.order - 1,
        // Not inside a word, so an address like a@here.com is left alone.
        match: (source, _state, previous) =>
            /(^|\s)$/.test(previous)
                ? /^@(everyone|here)\b/.exec(source)
                : null,
        parse: capture => ({ name: capture[1] }),
    },
    emoji: token(defaults.text.order - 1, /^<(a?):(\w+):(\d+)>/, capture => ({
        animated: capture[1] === 'a',
        name: capture[2],
        id: capture[3],
    })),
    timestamp: token(
        defaults.text.order - 1,
        /^<t:(-?\d{1,17})(?::([tTdDfFsSR]))?>/,
        capture => ({
            seconds: Number(capture[1]),
            style: capture[2],
            raw: capture[0],
        }),
    ),
    newline: defaults.newline,
    br: defaults.br,
    text: {
        order: defaults.text.order,
        match: source => TEXT.exec(source),
        parse: defaults.text.parse,
    },
}

const parser = SimpleMarkdown.parserFor(rules)

/**
 * The reference's EMBED_TITLE_RULES (embed titles and field names): every rule except code blocks, line breaks,
 * user / role / @everyone mentions and subtext. A title that links to the embed's url is parsed without links
 * (`parseEmbedTitleWithoutLinks` leaves out url, autolink, link, mailto and tel).
 */
const TITLE_OMIT = ['codeBlock', 'br', 'user', 'role', 'everyone', 'subtext']
const LINK_RULES = ['url', 'autolink', 'link']
const without = (omitted: string[]) =>
    SimpleMarkdown.parserFor(
        Object.fromEntries(
            Object.entries(rules).filter(([name]) => !omitted.includes(name)),
        ),
    )
const titleParser = without(TITLE_OMIT)
const titleParserWithoutLinks = without([...TITLE_OMIT, ...LINK_RULES])

export type MarkdownNode = SingleASTNode

export function parseMarkdown(content: string): MarkdownNode[] {
    return parser(content, { inline: true })
}

/** An embed title or field name; `links` is false for a title that is itself the embed's link. */
export function parseEmbedTitle(content: string, links: boolean) {
    return (links ? titleParser : titleParserWithoutLinks)(content, {
        inline: true,
    })
}

/** Names and colours for the things a message can mention. */
export interface MentionResolver {
    user: (id: string) => string | undefined
    role: (
        id: string,
    ) => { name: string; color?: number; colors?: number[] } | undefined
    channel: (id: string) => string | undefined
    /** The mention icon of a channel (`ChannelUtils.getMentionIconType`): text, voice, thread, ... */
    channelIcon?: (id: string) => string | undefined
    /** The guild being viewed; `@me` is used in links when there is none. */
    guildId?: string
    channelGuildId?: (id: string) => string | undefined
    guildName?: (id: string) => string | undefined
}

/** Whether a `[text](url)` link shows its own target as text (so it is not masked). */
function isPlainTarget(node: MarkdownNode): boolean {
    const text = Array.isArray(node.content)
        ? node.content.map(part => part.content).join('')
        : ''
    const bare = (url: string) => url.replace(/\/$/, '')
    return bare(text.trim()) === bare(String(node.target))
}

/** The style a link adds. Only web links are tappable; a masked link could otherwise carry any URL scheme. */
function linkStyle(node: MarkdownNode): Partial<Span> {
    if (!/^https?:\/\//i.test(node.target)) return {}
    // A shown text that differs from the target asks before leaving.
    return {
        link:
            node.type === 'link' && !isPlainTarget(node)
                ? chatLink.masked(node.target)
                : node.target,
    }
}

/**
 * The marker run of a list item (TextUtilsKt.appendBulletPoint). The renderer draws it.
 * Its text is the reference's single-line form, for reply previews.
 */
function listMarker(
    node: MarkdownNode,
    index: number,
    list: number,
): Partial<Span> & { text: string } {
    if (!node.ordered)
        return { text: list > 1 ? '◦  ' : '•  ', list, bullet: true }
    const start = node.start ?? 1
    const number = start + index
    return {
        text: `${number}.  `,
        list,
        bullet: true,
        number,
        lastNumber: start + node.items.length - 1,
    }
}

/** The style each node type that wraps text adds. */
const NODE_STYLES: Record<string, Partial<Span>> = {
    strong: { bold: true },
    em: { italic: true },
    u: { underline: true },
    del: { strike: true },
    spoiler: { spoiler: true },
    blockQuote: { quote: true },
}

interface Context {
    resolve: MentionResolver
    /** Nesting depth of lists, which picks the bullet. */
    level: number
}

/** Flattens the tree into styled runs, the form the native renderer draws. */
export function toSpans(
    nodes: MarkdownNode[],
    resolve: MentionResolver,
    style: Partial<Span> = {},
): Span[] {
    return merge(flatten(nodes, { resolve, level: 0 }, style))
}

function flatten(
    nodes: MarkdownNode[],
    context: Context,
    style: Partial<Span>,
): Span[] {
    const { resolve } = context
    const spans: Span[] = []
    const push = (text: string, extra: Partial<Span> = {}) =>
        spans.push({ ...style, ...extra, text })
    const nest = (
        node: MarkdownNode,
        extra: Partial<Span>,
        level = context.level,
    ) =>
        spans.push(
            ...flatten(
                Array.isArray(node.content) ? node.content : [],
                { ...context, level },
                { ...style, ...extra },
            ),
        )

    for (const node of nodes) {
        const runs = mentionRuns(node, resolve, style)
        if (runs) {
            for (const run of runs) push(run.text, run.extra)
            continue
        }
        const nodeStyle = NODE_STYLES[node.type]
        if (nodeStyle) {
            nest(node, nodeStyle)
            continue
        }
        switch (node.type) {
            case 'text':
                // A tapped emoji opens its info sheet, unless it is part of a link.
                for (const part of splitEmoji(node.content))
                    push(
                        part.text,
                        part.emoji
                            ? {
                                  emoji: part.emoji,
                                  link:
                                      style.link ??
                                      chatLink.unicodeEmoji(part.text),
                              }
                            : {},
                    )
                break
            case 'newline':
            case 'br':
                push('\n')
                break
            case 'heading':
                nest(node, { heading: node.level, bold: true })
                // Consecutive headings stay on their own lines; the renderer drops the last line break.
                push('\n', { heading: node.level, bold: true })
                break
            case 'subtext':
                nest(node, { subtext: true })
                push('\n', { subtext: true })
                break
            case 'list': {
                const list = context.level + 1
                node.items.forEach((item: MarkdownNode[], index: number) => {
                    const { text, ...marker } = listMarker(node, index, list)
                    push(text, marker)
                    spans.push(
                        ...flatten(
                            item,
                            { ...context, level: list },
                            { ...style, list },
                        ),
                    )
                    // A nested list already ended the line.
                    if (!spans.at(-1)?.text.endsWith('\n')) push('\n', { list })
                })
                break
            }
            case 'inlineCode':
                push(node.content, { code: true })
                break
            case 'codeBlock':
                for (const run of highlightCode(node.content, node.lang))
                    push(run.text, {
                        code: true,
                        block: true,
                        ...(run.token ? { token: run.token } : {}),
                    })
                break
            case 'link':
            case 'autolink':
            case 'url':
                nest(node, linkStyle(node))
                break
            default:
                if (typeof node.content === 'string') push(node.content)
                else nest(node, {})
        }
    }
    return spans
}

const STYLE_KEYS: Array<keyof Span> = [
    'bold',
    'italic',
    'underline',
    'strike',
    'code',
    'block',
    'link',
    'mention',
    'color',
    'quote',
    'heading',
    'list',
    'spoiler',
    'subtext',
    'timestamp',
    'token',
]

/** Joins neighbouring runs with the same style; the parser's text rule breaks at every punctuation mark. */
function merge(spans: Span[]): Span[] {
    const merged: Span[] = []
    for (const span of spans) {
        const previous = merged.at(-1)
        const joinable =
            previous &&
            !previous.emoji &&
            !span.emoji &&
            !previous.bullet &&
            !span.bullet &&
            !span.mention &&
            !span.timestamp &&
            STYLE_KEYS.every(key => previous[key] === span[key])
        if (joinable) previous.text += span.text
        else merged.push({ ...span })
    }
    return merged
}

// Digits, # and * are emoji components too, so they are deliberately not accepted on their own.
const EMOJI_ONLY =
    /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|\p{Emoji_Modifier}|[‍️⃣]|\s)+$/u
const HAS_EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u

/** Whether a message is only emoji, which the client draws at a larger size. */
export function isJumbo(spans: Span[]): boolean {
    if (spans.length === 0 || spans.length > 30) return false
    if (
        !spans.some(
            span => span.emoji !== undefined || HAS_EMOJI.test(span.text),
        )
    )
        return false
    return spans.every(
        span =>
            span.emoji !== undefined ||
            (!span.code && EMOJI_ONLY.test(span.text)),
    )
}
