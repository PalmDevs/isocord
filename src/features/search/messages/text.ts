import { t } from '../../../i18n'
import { previewText } from '../../messages/preview'
import type { Message } from '../../../stores/readStates'
import type { Span } from '../../chat/rows/rows'

/** A run of a result's text, highlighted when it matches a word of the query. */
export interface TextRun {
    text: string
    highlight: boolean
}

/** The words of a query that are looked for in results (SearchQueryContentAnalyzer), lower-cased. */
export function queryWords(query: string): Set<string> {
    return new Set(
        query
            .toLowerCase()
            .split(/[^\p{L}\p{N}_]+/u)
            .filter(word => word.length > 0),
    )
}

/**
 * MessageSearchResultParser.truncateMessage for a message's own markdown: when the first matching word would fall
 * beyond what `lineClamp` lines show, the text starts shortly before it, after an ellipsis. Null when no word matches
 * (the message is shown as it is); newlines are kept, as the native list lays the text out itself.
 */
export function truncateContent(
    content: string,
    words: Set<string>,
    lineClamp: number,
): string | null {
    for (const match of content.matchAll(/[\p{L}\p{N}_]+/gu)) {
        if (!words.has(match[0].toLowerCase())) continue
        const start = Math.max(
            0,
            match.index - (30 * lineClamp - match[0].length),
        )
        return start > 0 ? `...${content.substring(start)}` : content
    }
    return null
}

/** Marks the words of the query in message spans (the native list draws them on the highlight background). */
export function highlightSpans(spans: Span[], words: Set<string>): Span[] {
    if (words.size === 0) return spans
    return spans.flatMap(span => {
        if (span.emoji || span.block || span.mention || span.timestamp)
            return [span]
        const parts = span.text.split(/([\p{L}\p{N}_]+)/u)
        let found = false
        const out: Span[] = []
        for (const part of parts) {
            if (!part) continue
            const hit = words.has(part.toLowerCase())
            found ||= hit
            out.push(
                hit
                    ? { ...span, text: part, highlight: true }
                    : { ...span, text: part },
            )
        }
        return found ? out : [span]
    })
}

/**
 * MessageSearchResultParser.truncateMessage: newlines become spaces and, when the first matching word would fall
 * beyond what `lineClamp` lines show, the text starts shortly before it, after an ellipsis.
 */
function truncate(text: string, words: Set<string>, lineClamp: number): string {
    const flat = text.replace(/(\r\n|\n|\r)/g, ' ')
    const found = flat
        .split(/(\W+)/)
        .find(part => words.has(part.toLowerCase()))
    if (!found) return flat
    // `found` is a run of word characters, so it needs no escaping.
    const index = flat.search(new RegExp(`\\b${found}\\b`, 'i'))
    if (index === -1) return flat
    const start = Math.max(0, index - (30 * lineClamp - found.length))
    return start > 0 ? `...${flat.substring(start)}` : flat
}

/** The text a result row shows for a message, split into runs so the words of `query` can be highlighted. */
export function resultRuns(
    message: Message,
    query: string,
    lineClamp: number,
): TextRun[] {
    const preview = previewText(message) ?? ''
    const words = queryWords(query)
    if (words.size === 0) return [{ text: preview, highlight: false }]
    return truncate(preview, words, lineClamp)
        .split(/(\W+)/)
        .filter(part => part.length > 0)
        .map(text => ({ text, highlight: words.has(text.toLowerCase()) }))
}

/**
 * useSearchMessageTimestamp: the age of the message from its id, in NotificationCenterUtils.getRelativeTimestamp's
 * abbreviated form ("1m" under a minute, "5m", "3h", "2d" up to 30 days, "4mo", "1y"). The label is the full date.
 */
export function shortTimestamp(timestampMs: number): {
    text: string
    label: string
} {
    const label = new Date(timestampMs).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    })
    const seconds = Math.max(0, (Date.now() - timestampMs) / 1000)
    if (seconds < 60) return { text: t('time.minutes', { count: 1 }), label }
    if (seconds < 3600)
        return {
            text: t('time.minutes', { count: Math.floor(seconds / 60) }),
            label,
        }
    if (seconds < 86400)
        return {
            text: t('time.hours', { count: Math.floor(seconds / 3600) }),
            label,
        }
    if (seconds < 2592000)
        return {
            text: t('time.days', { count: Math.floor(seconds / 86400) }),
            label,
        }
    if (seconds < 31104000)
        return {
            text: t('time.months', { count: Math.floor(seconds / 2592000) }),
            label,
        }
    return {
        text: t('time.years', { count: Math.floor(seconds / 31104000) }),
        label,
    }
}

/** The `index`-th link of a message's text. */
export function linkAt(
    content: string | undefined,
    index = 0,
): string | undefined {
    const links = content?.match(/https?:\/\/[^\s<>]+/g)
    return links?.[index]
}
