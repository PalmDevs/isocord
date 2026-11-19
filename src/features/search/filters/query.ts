import {
    compareSnowflakes,
    snowflakeFromTimestamp,
} from '../../../core/discord/snowflake'
import type { FilterKind, SearchFilter } from './catalog'

/** What the filters add to a search request. */
export interface FilterParams {
    /** Merged into every tab's query, after the tab's own filter (createRequestPayload's order). */
    tab: Record<string, unknown>
    /** The `in` filter's channels: replaces the context's own. */
    channelIds?: string[]
    includeNsfw: boolean
}

/** The filters that add their value to an array parameter of the search API. */
const ARRAY_PARAMS: Partial<Record<FilterKind, string>> = {
    from: 'author_id',
    mentions: 'mentions',
    has: 'has',
    authorType: 'author_type',
    repliedToUser: 'replied_to_user_id',
    repliedToMessage: 'replied_to_message_id',
    mentionsRole: 'mentions_role_id',
    linkHostname: 'link_hostname',
    fileName: 'attachment_filename',
    fileExtension: 'attachment_extension',
    embedType: 'embed_type',
    embedProvider: 'embed_provider',
}

/** SearchModes: newest is SEARCH_QUERY_DEFAULT_FILTERS. */
const SORT_PARAMS: Record<string, Record<string, string>> = {
    newest: {},
    oldest: { sort_order: 'asc' },
    relevance: { sort_by: 'relevance' },
}

/** Returns local midnight of a `YYYY-MM-DD` date, `days` later. */
function dayStart(date: string, days = 0): number {
    const [year = 0, month = 1, day = 1] = date.split('-').map(Number)
    return new Date(year, month - 1, day + days).getTime()
}

/** Formats a local date as the `YYYY-MM-DD` a date filter holds. */
export function formatFilterDate(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** A typed date: `YYYY-MM-DD`. */
const TYPED_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Parses a typed `YYYY-MM-DD`, or null when it is not a real day. */
export function parseFilterDate(text: string): Date | null {
    const match = TYPED_DATE.exec(text)
    if (!match) return null
    const [year, month, day] = match.slice(1).map(Number) as [
        number,
        number,
        number,
    ]
    const date = new Date(year, month - 1, day)
    return date.getMonth() === month - 1 ? date : null
}

/** The label of a date filter's tag. */
export const filterDateLabel = (date: Date) =>
    date.toLocaleDateString(undefined, { dateStyle: 'medium' })

/**
 * dateValidator: the snowflake bounds of a date filter. Before ends at the day's start, after starts at the next
 * day's, and on spans the day.
 */
function dateBounds(
    kind: FilterKind,
    date: string,
): { min?: string; max?: string } {
    const start = snowflakeFromTimestamp(dayStart(date))
    const next = snowflakeFromTimestamp(dayStart(date, 1))
    if (kind === 'before') return { max: start }
    if (kind === 'after') return { min: next }
    return { min: start, max: next }
}

/** getSearchQueryFromTokens: the request fields of the filters. Several dates narrow to their overlap. */
export function filterParams(filters: readonly SearchFilter[]): FilterParams {
    const tab: Record<string, unknown> = {}
    const arrays: Record<string, string[]> = {}
    let channelIds: string[] | undefined
    let includeNsfw = false
    let minId: string | undefined
    let maxId: string | undefined
    for (const filter of filters) {
        const param = ARRAY_PARAMS[filter.kind]
        if (param) {
            arrays[param] ??= []
            arrays[param].push(
                filter.negated ? `-${filter.value}` : filter.value,
            )
            continue
        }
        switch (filter.kind) {
            case 'in':
                channelIds = [...(channelIds ?? []), filter.value]
                break
            case 'pinned':
                tab.pinned = true
                break
            case 'mentionsEveryone':
                tab.mention_everyone = true
                break
            case 'includeNsfw':
                includeNsfw = true
                break
            case 'slop':
                tab.slop = Number(filter.value)
                break
            // The API needs both; the label holds the name.
            case 'command':
                tab.command_id = filter.value
                tab.command_name = filter.label
                break
            case 'sort':
                Object.assign(tab, SORT_PARAMS[filter.value])
                break
            case 'before':
            case 'after':
            case 'on': {
                const { min, max } = dateBounds(filter.kind, filter.value)
                if (min && (!minId || compareSnowflakes(min, minId) > 0))
                    minId = min
                if (max && (!maxId || compareSnowflakes(max, maxId) < 0))
                    maxId = max
                break
            }
        }
    }
    if (minId) tab.min_id = minId
    if (maxId) tab.max_id = maxId
    Object.assign(tab, arrays)
    return { tab, channelIds, includeNsfw }
}
