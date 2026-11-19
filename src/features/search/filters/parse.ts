import { t } from '../../../i18n'
import { filtersFor } from './catalog'
import type { SearchContext } from '../types'
import type { FilterKind } from './catalog'

/** A `key:value` in the search text (the reference's QueryTokenizer rules). */
export interface FilterToken {
    kind: FilterKind
    /** Unquoted. Empty when nothing follows the colon yet. */
    value: string
    /** Where the token is in the text, its key included. */
    start: number
    end: number
}

/** A key, a colon, then a quoted value or a word. */
const TOKEN = /(^|\s)([A-Za-z]+):("(?:[^"\\]|\\.)*"?|\S*)/g

/** The typed key of a filter, as the tags write it without the colon. */
export const filterWord = (kind: FilterKind) => t(`search.filter.${kind}`)

/** The filter each key stands for in a context, by its lowercased key. */
export function filterKeys(context: SearchContext): Map<string, FilterKind> {
    return new Map(
        filtersFor(context).map(kind => [filterWord(kind).toLowerCase(), kind]),
    )
}

const unquote = (value: string) =>
    value.startsWith('"')
        ? value.replace(/^"|"$/g, '').replace(/\\(.)/g, '$1')
        : value

/** Returns the filter tokens of the text, in order. */
export function findTokens(
    text: string,
    keys: Map<string, FilterKind>,
): FilterToken[] {
    const tokens: FilterToken[] = []
    for (const match of text.matchAll(TOKEN)) {
        const [whole, lead = '', key = '', value = ''] = match
        const kind = keys.get(key.toLowerCase())
        if (!kind) continue
        const start = (match.index ?? 0) + lead.length
        tokens.push({
            kind,
            value: unquote(value),
            start,
            end: (match.index ?? 0) + whole.length,
        })
    }
    return tokens
}

/** Returns the text without the given tokens, with the spaces they leave collapsed. */
export function withoutTokens(text: string, tokens: FilterToken[]): string {
    let rest = text
    for (const token of [...tokens].sort((a, b) => b.start - a.start))
        rest = rest.slice(0, token.start) + rest.slice(token.end)
    return rest.replace(/ {2,}/g, ' ').replace(/^ /, '')
}
