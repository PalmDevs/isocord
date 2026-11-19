/**
 * Rewrites `jsx(Tag, { ...props, children })` calls as JSX.
 * Only literal props objects convert fully. A variable becomes `<Tag {...props} />`.
 * A call that cannot convert stays as it is.
 */
import { isWrapped, matchClose, splitTop } from './scan.ts'

const MAX_LINE = 100
const INDENT = '  '
const TAG = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/
const PLAIN_STRING = /^"[^"\\{}<>\n]*"$/
const ENTRY_KEY = /^(?:([A-Za-z_$][\w$]*)|"([^"]+)")\s*:\s*([\s\S]+)$/
const ENTRY_SHORTHAND = /^[A-Za-z_$][\w$]*$/
const ENTRY_METHOD = /^([A-Za-z_$][\w$]*)(\([\s\S]*)$/
const PLACEHOLDERS = new Set(['null', 'undefined'])

/** Converts every convertible `jsx(` or `jsxs(` call in `source`. */
export function convertJsx(source: string, baseIndent?: string): string {
    const pattern = /(?<![\w$.])jsxs?\(/g
    let output = ''
    let cursor = 0
    for (let m = pattern.exec(source); m; m = pattern.exec(source)) {
        const open = m.index + m[0].length - 1
        const close = matchClose(source, open)
        if (close < 0) continue
        const indent = baseIndent ?? lineIndent(source, m.index)
        const element = toElement(source.slice(open + 1, close), indent)
        if (!element) continue
        output += source.slice(cursor, m.index) + element
        cursor = close + 1
        pattern.lastIndex = cursor
    }
    return output + source.slice(cursor)
}

function lineIndent(source: string, index: number): string {
    const start = source.lastIndexOf('\n', index) + 1
    return /^[ \t]*/.exec(source.slice(start))![0]
}

/** Builds one element from a call's argument text, or null when it has an odd shape. */
function toElement(args: string, indent: string): string | null {
    const [tag, props, key, ...extra] = splitTop(args)
    if (!tag || !props || extra.length) return null
    const name = TAG.test(tag) ? tag : `{${tag}}`
    const inner = indent + INDENT
    const attrs: string[] = []
    const children: string[] = []
    if (isWrapped(props, '{')) {
        for (const entry of splitTop(props.slice(1, -1))) {
            const parsed = toEntry(entry, inner)
            if (!parsed) return null
            if (parsed.children) children.push(...parsed.children)
            else attrs.push(parsed.attr!)
        }
    } else if (props !== 'null') attrs.push(`{...${convertJsx(props, inner)}}`)
    if (key) attrs.push(attribute('key', convertJsx(key, inner)))
    return layout(name, attrs, children, indent)
}

interface Entry {
    attr?: string
    children?: string[]
}

function toEntry(entry: string, indent: string): Entry | null {
    if (entry.startsWith('...'))
        return { attr: `{${convertJsx(entry, indent)}}` }
    if (ENTRY_SHORTHAND.test(entry)) return { attr: `${entry}={${entry}}` }
    const keyed = ENTRY_KEY.exec(entry)
    if (keyed) {
        const key = keyed[1] ?? keyed[2]!
        const value = keyed[3]!
        // `children: null` is a placeholder the decompiler fills in with a later assignment.
        if (key === 'children' && !PLACEHOLDERS.has(value))
            return { children: toChildren(value, indent) }
        return { attr: attribute(key, convertJsx(value, indent)) }
    }
    const method = ENTRY_METHOD.exec(entry)
    if (method)
        return {
            attr: `${method[1]}={function ${method[1]}${convertJsx(method[2]!, indent)}}`,
        }
    return null
}

function toChildren(value: string, indent: string): string[] {
    const items = isWrapped(value, '[') ? splitTop(value.slice(1, -1)) : [value]
    return items.map(item => {
        const child = convertJsx(item, indent)
        return child.startsWith('<') ? child : `{${child}}`
    })
}

function attribute(name: string, value: string): string {
    if (value === 'true') return name
    if (PLAIN_STRING.test(value)) return `${name}=${value}`
    return `${name}={${value}}`
}

/** Lays out one element, breaking props and children onto lines when they run long. */
function layout(
    name: string,
    attrs: string[],
    children: string[],
    indent: string,
): string {
    const inner = indent + INDENT
    const flat = attrs.length ? ` ${attrs.join(' ')}` : ''
    const fits = (text: string) =>
        !text.includes('\n') && indent.length + text.length <= MAX_LINE
    const head = (end: '>' | '/>') => {
        const flatHead = `<${name}${flat}${end === '/>' ? ' />' : '>'}`
        if (fits(flatHead)) return flatHead
        const lines = attrs.map(attr => `${inner}${attr}`).join('\n')
        return `<${name}\n${lines}\n${indent}${end}`
    }
    if (!children.length) return head('/>')
    const text = children.length === 1 ? children[0]! : null
    if (text && !text.startsWith('<')) {
        const line = `${head('>')}${text}</${name}>`
        if (fits(line)) return line
    }
    const body = children.map(child => `${inner}${child}`).join('\n')
    return `${head('>')}\n${body}\n${indent}</${name}>`
}
