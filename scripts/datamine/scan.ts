/** Bracket-aware scanning of decompiled source. Strings and comments are skipped. */

const OPENERS = '([{'
const CLOSERS = ')]}'

/** Returns the index just past the string or comment that starts at `i`, or `i` when none does. */
function skipLiteral(source: string, i: number): number {
    const char = source[i]
    if (char === '"' || char === "'" || char === '`') {
        for (let j = i + 1; j < source.length; j++) {
            if (source[j] === '\\') j++
            else if (source[j] === char) return j + 1
        }
        return source.length
    }
    if (char === '/' && source[i + 1] === '/') {
        const end = source.indexOf('\n', i)
        return end < 0 ? source.length : end
    }
    if (char === '/' && source[i + 1] === '*') {
        const end = source.indexOf('*/', i + 2)
        return end < 0 ? source.length : end + 2
    }
    return i
}

/** Yields `[index, char]` for every character outside strings and comments. */
export function* codeChars(
    source: string,
    start = 0,
): Generator<[number, string]> {
    for (let i = start; i < source.length; i++) {
        const next = skipLiteral(source, i)
        if (next !== i) i = next - 1
        else yield [i, source[i]!]
    }
}

/** Returns the index of the bracket that closes the one at `open`, or -1. */
export function matchClose(source: string, open: number): number {
    let depth = 0
    for (let i = open; i < source.length; i++) {
        const next = skipLiteral(source, i)
        if (next !== i) i = next - 1
        else if (OPENERS.includes(source[i]!)) depth++
        else if (CLOSERS.includes(source[i]!) && --depth === 0) return i
    }
    return -1
}

/** Splits on commas outside brackets and trims the parts. Drops empty ones unless `keepEmpty`. */
export function splitTop(text: string, keepEmpty = false): string[] {
    const parts: string[] = []
    let depth = 0
    let from = 0
    for (const [i, char] of codeChars(text)) {
        if (OPENERS.includes(char)) depth++
        else if (CLOSERS.includes(char)) depth--
        else if (char === ',' && depth === 0) {
            parts.push(text.slice(from, i))
            from = i + 1
        }
    }
    parts.push(text.slice(from))
    const trimmed = parts.map(part => part.trim())
    return keepEmpty ? trimmed : trimmed.filter(Boolean)
}

/** Returns whether `text` is one bracketed literal that starts with `open`. */
export function isWrapped(text: string, open: '{' | '['): boolean {
    return text.startsWith(open) && matchClose(text, 0) === text.length - 1
}

export function escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
