import type { IconName } from '../../../design/icons/Icon'
import type { MessageKey } from '../../../i18n'
import type { SearchContext } from '../types'

/**
 * The search filters. The reference's SearchTokenTypes (from, mentions, has, in, on, before, after, authorType,
 * pinned) plus the search API's other parameters, which the reference has no tokens for.
 */
export type FilterKind =
    | 'from'
    | 'mentions'
    | 'has'
    | 'in'
    | 'before'
    | 'after'
    | 'on'
    | 'pinned'
    | 'authorType'
    | 'repliedToUser'
    | 'repliedToMessage'
    | 'mentionsRole'
    | 'mentionsEveryone'
    | 'linkHostname'
    | 'fileName'
    | 'fileExtension'
    | 'embedType'
    | 'embedProvider'
    | 'command'
    | 'includeNsfw'
    | 'slop'
    | 'sort'

/** How a filter gets its value: none (a toggle), or the picker that replaces the tabs while it is chosen. */
export type FilterInput =
    | 'toggle'
    | 'user'
    | 'role'
    | 'channel'
    | 'options'
    | 'date'
    | 'text'
    | 'command'

export interface SearchFilter {
    /** Unique in the list. */
    id: string
    kind: FilterKind
    /** What the API gets: an id, an option, the text, or a `YYYY-MM-DD` date. Empty for a toggle. */
    value: string
    /** What the tag shows: the name of the user, channel, role or command, or the option's text. */
    label: string
    /** Leaves out what matches (`has` and `authorType` take a `-` prefix). */
    negated?: boolean
    /**
     * The search's own scope shown as a tag (`in:` the channel the details are of). It does not make the query a
     * search: with nothing else, the initial tabs show.
     */
    implicit?: boolean
}

/** What a search is: the typed text and the filters. */
export interface SearchQuery {
    text: string
    filters: SearchFilter[]
}

export const EMPTY_SEARCH_QUERY: SearchQuery = { text: '', filters: [] }

export interface FilterOption {
    value: string
    label: MessageKey
}

export interface FilterSpec {
    input: FilterInput
    icon: IconName
    /** A new value replaces the old one instead of adding to it. */
    single?: boolean
    /** Only shown in these contexts. All when absent. */
    contexts?: readonly SearchContext['type'][]
    options?: readonly FilterOption[]
    negatable?: boolean
    /** A typed value the filter takes. Any non-empty text when absent. */
    accepts?: (text: string) => boolean
}

/** A pasted id. */
export const SNOWFLAKE = /^\d{17,20}$/
/** A typed user value that stands for the signed-in account. */
export const SELF_USER = '@me'
/** The search API's limit on slop. */
export const MAX_SLOP = 100

/** SearchTokens' getHasMap: the label each `has` value is typed as. */
const HAS_OPTIONS: readonly FilterOption[] = [
    { value: 'link', label: 'search.filter.has.link' },
    { value: 'embed', label: 'search.filter.has.embed' },
    { value: 'poll', label: 'search.filter.has.poll' },
    { value: 'snapshot', label: 'search.filter.has.snapshot' },
    { value: 'file', label: 'search.filter.has.file' },
    { value: 'video', label: 'search.filter.has.video' },
    { value: 'image', label: 'search.filter.has.image' },
    { value: 'sound', label: 'search.filter.has.sound' },
    { value: 'sticker', label: 'search.filter.has.sticker' },
]

/** isValidAuthorTypeAutocomplete. */
const AUTHOR_TYPE_OPTIONS: readonly FilterOption[] = [
    { value: 'user', label: 'search.filter.authorType.user' },
    { value: 'bot', label: 'search.filter.authorType.bot' },
    { value: 'webhook', label: 'search.filter.authorType.webhook' },
]

/** The search API's embed types. */
const EMBED_TYPE_OPTIONS: readonly FilterOption[] = [
    { value: 'image', label: 'search.filter.embedType.image' },
    { value: 'video', label: 'search.filter.embedType.video' },
    { value: 'gif', label: 'search.filter.embedType.gif' },
    { value: 'sound', label: 'search.filter.embedType.sound' },
    { value: 'article', label: 'search.filter.embedType.article' },
]

/** SearchModes. Newest is the default and needs no filter. */
const SORT_OPTIONS: readonly FilterOption[] = [
    { value: 'newest', label: 'search.filter.sort.newest' },
    { value: 'oldest', label: 'search.filter.sort.oldest' },
    { value: 'relevance', label: 'search.filter.sort.relevance' },
]

const GUILD_ONLY = ['GUILD_CHANNEL'] as const

export const FILTERS: Record<FilterKind, FilterSpec> = {
    from: { input: 'user', icon: 'UserIcon' },
    mentions: { input: 'user', icon: 'AtIcon' },
    has: {
        input: 'options',
        icon: 'AttachmentIcon',
        options: HAS_OPTIONS,
        negatable: true,
    },
    // A DM's search has no channels to pick from.
    in: {
        input: 'channel',
        icon: 'ChannelListMagnifyingGlassIcon',
        contexts: ['GUILD_CHANNEL', 'DMS'],
    },
    before: { input: 'date', icon: 'CalendarMinusIcon', single: true },
    after: { input: 'date', icon: 'CalendarPlusIcon', single: true },
    on: { input: 'date', icon: 'CalendarIcon', single: true },
    pinned: { input: 'toggle', icon: 'PinIcon' },
    authorType: {
        input: 'options',
        icon: 'RobotIcon',
        options: AUTHOR_TYPE_OPTIONS,
        negatable: true,
    },
    repliedToUser: { input: 'user', icon: 'ArrowAngleLeftUpIcon' },
    repliedToMessage: {
        input: 'text',
        icon: 'ChatArrowRightIcon',
        accepts: text => SNOWFLAKE.test(text),
    },
    mentionsRole: {
        input: 'role',
        icon: 'ShieldUserIcon',
        contexts: GUILD_ONLY,
    },
    mentionsEveryone: { input: 'toggle', icon: 'GroupIcon' },
    linkHostname: { input: 'text', icon: 'LinkIcon' },
    fileName: { input: 'text', icon: 'FileIcon' },
    fileExtension: {
        input: 'text',
        icon: 'PaperIcon',
        accepts: text => !text.includes('.') && !/\s/.test(text),
    },
    embedType: {
        input: 'options',
        icon: 'EmbedIcon',
        options: EMBED_TYPE_OPTIONS,
    },
    embedProvider: { input: 'text', icon: 'GlobeEarthIcon' },
    command: { input: 'command', icon: 'SlashBoxIcon', single: true },
    includeNsfw: { input: 'toggle', icon: 'WarningIcon', contexts: GUILD_ONLY },
    slop: {
        input: 'text',
        icon: 'ArrowsLeftRightIcon',
        single: true,
        accepts: text => /^\d+$/.test(text) && Number(text) <= MAX_SLOP,
    },
    sort: {
        input: 'options',
        icon: 'ArrowsUpDownIcon',
        single: true,
        options: SORT_OPTIONS,
    },
}

/** The order of the filter bar: the reference's filters first, then the rest. */
export const FILTER_ORDER: readonly FilterKind[] = [
    'from',
    'mentions',
    'has',
    'in',
    'before',
    'after',
    'on',
    'pinned',
    'authorType',
    'repliedToUser',
    'repliedToMessage',
    'mentionsRole',
    'mentionsEveryone',
    'linkHostname',
    'fileName',
    'fileExtension',
    'embedType',
    'embedProvider',
    'command',
    'includeNsfw',
    'slop',
    'sort',
]

/** The filters of a context, in bar order. */
export const filtersFor = (context: SearchContext): FilterKind[] =>
    FILTER_ORDER.filter(kind => {
        const contexts = FILTERS[kind].contexts
        return !contexts || contexts.includes(context.type)
    })

/** A query with no text and no filter but its scope shows the initial tabs. */
export const isEmptyQuery = (query: SearchQuery) =>
    query.text === '' && query.filters.every(filter => filter.implicit)

/** Whether the query has a filter of its own (not only its scope): its results are messages alone. */
export const hasFilters = (query: SearchQuery) =>
    query.filters.some(filter => !filter.implicit)

/** The tabs of a filtered search. Not in the reference, which keeps every tab. */
export const FILTERED_TABS = [
    'messages',
    'media',
    'pins',
    'links',
    'files',
] as const

/** Identifies a query's results, its scope included. */
export function queryKey(query: SearchQuery): string {
    const filters = query.filters.map(filter => [
        filter.kind,
        filter.value,
        filter.negated ?? false,
    ])
    return JSON.stringify([query.text, filters])
}
