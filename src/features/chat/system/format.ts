import { t } from '../../../i18n'
import type { MessageKey } from '../../../i18n'
import type { Span } from '../rows/rows'

/** A tappable part of a system message: where it leads, and the role colour of a username. */
export interface SystemLink {
    url: string
    color?: number
}

/** A system message's text: a message key in Discord's markup and the values it names. */
export interface SystemText {
    key: MessageKey
    values: Record<string, string | number | SystemLink>
}

/** One node of Discord's message markup: text, `{name}`, `{$b:...}` or `{$link:...{hook}}`. */
type MarkupNode =
    | { kind: 'text'; text: string }
    | { kind: 'value'; name: string }
    | { kind: 'bold' | 'link' | 'group'; children: MarkupNode[] }

/** The markup tags system messages use. Any other tag keeps its text unstyled. */
const TAGS: Record<string, 'bold' | 'link'> = { b: 'bold', link: 'link' }

/** Parses the markup of `source` from `start` up to the closing brace of the enclosing tag. */
function parseMarkup(
    source: string,
    start: number,
): { nodes: MarkupNode[]; end: number } {
    const nodes: MarkupNode[] = []
    let at = start
    let text = ''
    const flush = () => {
        if (text) nodes.push({ kind: 'text', text })
        text = ''
    }
    while (at < source.length) {
        const char = source[at]
        if (char === '}') break
        if (char !== '{') {
            text += char
            at++
            continue
        }
        flush()
        if (source[at + 1] === '$') {
            const colon = source.indexOf(':', at)
            const tag = TAGS[source.slice(at + 2, colon)] ?? 'group'
            const inner = parseMarkup(source, colon + 1)
            nodes.push({ kind: tag, children: inner.nodes })
            at = inner.end + 1
        } else {
            const close = source.indexOf('}', at)
            nodes.push({ kind: 'value', name: source.slice(at + 1, close) })
            at = close + 1
        }
    }
    flush()
    return { nodes, end: at }
}

const valueText = (value: SystemText['values'][string] | undefined) =>
    value === undefined || typeof value === 'object' ? '' : String(value)

/** A link's children end with its hook, the value that holds the link. */
function splitHook(children: MarkupNode[]) {
    const hook = children.at(-1)
    return hook?.kind === 'value'
        ? { hook: hook.name, body: children.slice(0, -1) }
        : { hook: undefined, body: children }
}

function toSpans(
    nodes: MarkupNode[],
    values: SystemText['values'],
    style: Omit<Span, 'text'>,
    out: Span[],
): Span[] {
    for (const node of nodes) {
        if (node.kind === 'text') out.push({ ...style, text: node.text })
        else if (node.kind === 'value')
            out.push({ ...style, text: valueText(values[node.name]) })
        else if (node.kind !== 'link')
            toSpans(
                node.children,
                values,
                node.kind === 'bold' ? { ...style, bold: true } : style,
                out,
            )
        else {
            const { hook, body } = splitHook(node.children)
            const link = hook ? values[hook] : undefined
            toSpans(
                body,
                values,
                typeof link === 'object'
                    ? { ...style, link: link.url, color: link.color }
                    : style,
                out,
            )
        }
    }
    return out
}

function toPlain(nodes: MarkupNode[], values: SystemText['values']): string {
    return nodes
        .map(node => {
            if (node.kind === 'text') return node.text
            if (node.kind === 'value') return valueText(values[node.name])
            if (node.kind !== 'link') return toPlain(node.children, values)
            return toPlain(splitHook(node.children).body, values)
        })
        .join('')
}

/** Returns the spans of a system text (intl.formatToParts): links carry their url and colour, `$b` parts are bold. */
export function systemSpans({ key, values }: SystemText): Span[] {
    return toSpans(parseMarkup(t(key), 0).nodes, values, {}, []).filter(
        span => span.text,
    )
}

/** Returns a system text without markup (MarkupParser.astToString). */
export function systemPlain({ key, values }: SystemText): string {
    return toPlain(parseMarkup(t(key), 0).nodes, values)
}
