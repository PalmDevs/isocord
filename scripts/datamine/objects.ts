/**
 * Hermes builds an object in two steps: `obj = { a: null }`, some code, then `obj.a = x`.
 * It does the same for arrays (`items = [,]; items[0] = x`).
 * This folds the assignments back into one literal, where that keeps the order of evaluation.
 * It then inlines a props object that is used once, right after it, by a `jsx()` call.
 * Line based: it relies on the datamine's one-statement-per-line formatting.
 */
import { escapeRegex, matchClose, splitTop } from './scan.ts'

const MAX_LITERAL_LINES = 40
const MAX_STATEMENTS = 60
const MAX_LINE = 100
const INDENT = '  '
const DECLARATION = /^(\s*)(?:(const|let|var) )?([A-Za-z_$][\w$]*) = ([[{])/
const IDENTIFIER = /(?<![\w$.])[A-Za-z_$][\w$]*/g
const ENTRY_KEY = /^(?:([A-Za-z_$][\w$]*)|"([^"]+)")\s*:/
const SHORTHAND = /^[A-Za-z_$][\w$]*$/
const CLOSERS = '})]'
const JSX_PROPS_ARGUMENT =
    /(?<![\w$.])jsxs?\([^\n]*?,\s*([A-Za-z_$][\w$]*)\s*[,)]/g

interface Declaration {
    indent: string
    kind: string
    name: string
    literal: string
    last: number
}

interface Statement {
    from: number
    to: number
    text: string
}

function word(name: string): RegExp {
    return new RegExp(`(?<![\\w$.])${escapeRegex(name)}(?![\\w$])`)
}

/** Reads `name = {…};` or `name = […];` starting at line `at`, or null. */
function readDeclaration(
    lines: string[],
    at: number,
    accepts: (name: string) => boolean,
): Declaration | null {
    const head = DECLARATION.exec(lines[at]!)
    if (!head || !accepts(head[3]!)) return null
    const open = head[0].length - 1
    // Most literals fit on one line, so try that before a long window.
    for (const span of [1, MAX_LITERAL_LINES]) {
        const text = lines.slice(at, at + span).join('\n')
        const close = matchClose(text, open)
        if (close < 0) continue
        const rest = text.slice(close + 1)
        if (!rest.startsWith(';\n') && rest !== ';') return null
        return {
            indent: head[1]!,
            kind: head[2] ? `${head[2]} ` : '',
            name: head[3]!,
            literal: text.slice(open, close + 1),
            last: at + text.slice(0, close).split('\n').length - 1,
        }
    }
    return null
}

/** Yields the statements that follow, split by indentation, up to the end of the block. */
function* readStatements(
    lines: string[],
    from: number,
    indent: string,
): Generator<Statement> {
    let current: { from: number; to: number } | null = null
    let count = 0
    for (let k = from; k < lines.length; k++) {
        const line = lines[k]!
        const text = line.trim()
        if (!text) continue
        const lead = line.length - line.trimStart().length
        if (lead < indent.length) break
        if (current && (lead > indent.length || CLOSERS.includes(text[0]!)))
            current.to = k
        else {
            if (current) yield finish(lines, current)
            if (++count > MAX_STATEMENTS) return
            current = { from: k, to: k }
        }
    }
    if (current) yield finish(lines, current)
}

function finish(
    lines: string[],
    range: { from: number; to: number },
): Statement {
    return {
        ...range,
        text: lines
            .slice(range.from, range.to + 1)
            .join('\n')
            .trim(),
    }
}

interface Assignment {
    key: string
    value: string
}

function assignmentPattern(name: string): RegExp {
    return new RegExp(
        `^${escapeRegex(name)}(?:\\.([A-Za-z_$][\\w$]*)|\\[(\\d+)\\]) = ([\\s\\S]*);$`,
    )
}

/** Parses `name.key = value;` or `name[0] = value;`. */
function readAssignment(pattern: RegExp, text: string): Assignment | null {
    const match = pattern.exec(text)
    return match ? { key: match[1] ?? match[2]!, value: match[3]! } : null
}

function entryKey(entry: string): string | undefined {
    if (SHORTHAND.test(entry)) return entry
    const keyed = ENTRY_KEY.exec(entry)
    return keyed ? (keyed[1] ?? keyed[2]) : undefined
}

function mergeObject(literal: string, assignments: Assignment[]): string[] {
    const entries = splitTop(literal.slice(1, -1))
    for (const { key, value } of assignments) {
        const entry = key === value ? key : `${key}: ${value}`
        const at = entries.findIndex(existing => entryKey(existing) === key)
        if (at < 0) entries.push(entry)
        else entries[at] = entry
    }
    return entries
}

/** Splits array elements, keeping holes as empty strings. `[,]` has one hole. */
function arrayElements(literal: string): string[] {
    const inner = literal.slice(1, -1)
    if (!inner.trim()) return []
    const parts = splitTop(inner, true)
    if (parts.at(-1) === '') parts.pop()
    return parts
}

function mergeArray(literal: string, assignments: Assignment[]): string[] {
    const elements = arrayElements(literal)
    for (const { key, value } of assignments) {
        const index = Number(key)
        while (elements.length <= index) elements.push('')
        elements[index] = value
    }
    return elements.map(element => element || 'undefined')
}

/** Joins literal entries on one line when they fit, one per line otherwise. */
function render(
    decl: Declaration,
    entries: string[],
    [open, close]: [string, string],
): string {
    const flat = `${decl.indent}${decl.kind}${decl.name} = ${open} ${entries.join(', ')} ${close};`
    if (!flat.includes('\n') && flat.length <= MAX_LINE) return flat
    const inner = `${decl.indent}${INDENT}`
    const body = entries.map(entry => `${inner}${entry},`).join('\n')
    return `${decl.indent}${decl.kind}${decl.name} = ${open}\n${body}\n${decl.indent}${close};`
}

const WRITE =
    /(?<![\w$.])([A-Za-z_$][\w$]*)(?:\.[\w$.]+|\[[^\]]*\])?\s*(?:[-+*/%|&^]|\*\*|<<|>>>?)?=(?!=)/g

/** Returns true when code between the declaration and the assignments changes a value the literal reads. */
function invalidatesLiteral(gap: string, literal: string): boolean {
    if (!gap) return false
    const read = new Set(literal.match(IDENTIFIER))
    for (const [, written] of gap.matchAll(WRITE))
        if (read.has(written!)) return true
    return false
}

/** Folds the assignments after one declaration. Returns whether the lines changed. */
function foldDeclaration(lines: string[], decl: Declaration): boolean {
    const isArray = decl.literal.startsWith('[')
    const pattern = assignmentPattern(decl.name)
    const reassigned = new RegExp(`^${escapeRegex(decl.name)} = `)
    const mentions = word(decl.name)
    const gap: string[] = []
    const run: Statement[] = []
    const assignments: Assignment[] = []
    for (const statement of readStatements(lines, decl.last + 1, decl.indent)) {
        const assignment = readAssignment(pattern, statement.text)
        if (!run.length) {
            if (reassigned.test(statement.text)) return false
            if (!assignment) {
                if (mentions.test(statement.text)) return false
                gap.push(statement.text)
                continue
            }
        }
        if (!assignment || mentions.test(assignment.value)) break
        if (isArray !== /^\d+$/.test(assignment.key)) return false
        run.push(statement)
        assignments.push(assignment)
    }
    if (!run.length || invalidatesLiteral(gap.join('\n'), decl.literal))
        return false
    const replacement = isArray
        ? render(decl, mergeArray(decl.literal, assignments), ['[', ']'])
        : render(decl, mergeObject(decl.literal, assignments), ['{', '}'])
    const from = run[0]!.from
    const to = run.at(-1)!.to
    lines.splice(from, to - from + 1, ...replacement.split('\n'))
    return true
}

/** Names that have a `name.key = ` or `name[0] = ` statement somewhere. */
function assignedNames(source: string): Set<string> {
    const names = new Set<string>()
    for (const match of source.matchAll(
        /^\s*([A-Za-z_$][\w$]*)(?:\.[A-Za-z_$][\w$]*|\[\d+\]) = /gm,
    ))
        names.add(match[1]!)
    return names
}

function foldAssignments(lines: string[]) {
    const assigned = assignedNames(lines.join('\n'))
    for (let i = 0; i < lines.length; i++) {
        const decl = readDeclaration(lines, i, name => assigned.has(name))
        if (!decl || !foldDeclaration(lines, decl)) continue
        lines.splice(i, decl.last - i + 1)
        i--
    }
}

/** Names passed as the props of a one-line `jsx(Tag, name)` call. */
function jsxPropsNames(source: string): Set<string> {
    const names = new Set<string>()
    for (const match of source.matchAll(JSX_PROPS_ARGUMENT))
        names.add(match[1]!)
    return names
}

/** Moves a props object that is used once, by the next statement's `jsx()` call, into that call. */
function inlineJsxProps(lines: string[]) {
    const source = lines.join('\n')
    const candidates = jsxPropsNames(source)
    const uses = (name: string) =>
        source.match(new RegExp(word(name).source, 'g'))?.length
    for (let i = 0; i < lines.length; i++) {
        const decl = readDeclaration(
            lines,
            i,
            name => candidates.has(name) && uses(name) === 2,
        )
        if (!decl?.literal.startsWith('{')) continue
        const next = readStatements(lines, decl.last + 1, decl.indent).next()
            .value
        if (!next) continue
        const use = new RegExp(
            `((?<![\\w$.])jsxs?\\([^\\n]*?,\\s*)${escapeRegex(decl.name)}(?=\\s*[,)])`,
        )
        if (!use.test(next.text)) continue
        const text = next.text.replace(
            use,
            (_, head: string) => `${head}${decl.literal}`,
        )
        lines.splice(
            next.from,
            next.to - next.from + 1,
            `${decl.indent}${text}`,
        )
        lines.splice(i, decl.last - i + 1)
        i--
    }
}

/** Returns `source` with split object and array construction folded back together. */
export function foldObjects(source: string): string {
    const lines = source.split('\n')
    foldAssignments(lines)
    inlineJsxProps(lines)
    return lines.join('\n')
}
