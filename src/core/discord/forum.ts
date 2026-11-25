/** ForumSortOrder: a thread-only channel's `default_sort_order` (null counts as LATEST_ACTIVITY). */
export const ForumSortOrder = {
    LATEST_ACTIVITY: 0,
    CREATION_DATE: 1,
} as const

/** `sort_by` of `GET /channels/{id}/threads/search`. */
export const ThreadSortBy = {
    LAST_MESSAGE_TIME: 'last_message_time',
    CREATION_TIME: 'creation_time',
} as const
export type ThreadSortBy = (typeof ThreadSortBy)[keyof typeof ThreadSortBy]

/** Tag search setting: whether a post needs one or all of the chosen tags. */
export const TagSetting = {
    MATCH_SOME: 'match_some',
    MATCH_ALL: 'match_all',
} as const
export type TagSetting = (typeof TagSetting)[keyof typeof TagSetting]

/** `sort_order` of the thread search. */
export const SORT_ORDER_DESCENDING = 'desc'

/** The most threads one search page returns. */
export const FORUM_PAGE_SIZE = 25

/** Thread search limits: the longest `name`, and the largest `offset` (docs.discord.food). */
export const THREAD_SEARCH_NAME_MAX = 100
export const THREAD_SEARCH_MAX_OFFSET = 9975

/** Tags needed before `tag_setting` means anything. */
export const MIN_TAGS_TO_MATCH = 2

/** Max `available_tags` on a forum or media channel (docs.discord.food). */
export const MAX_FORUM_TAGS = 20
/** Max characters in a forum tag's `name` (docs.discord.food). */
export const MAX_FORUM_TAG_NAME_LENGTH = 20
/** Max `applied_tags` on a forum post (docs.discord.food). */
export const MAX_APPLIED_TAGS = 5

/** ForumTag: one of a thread-only channel's `available_tags`. */
export interface ForumTag {
    id: string
    name: string
    emoji_id?: string | null
    emoji_name?: string | null
    moderated?: boolean
}

/** One tag in `PATCH /channels/{id}`'s `available_tags`: `id` is omitted for a new tag. */
export interface ForumTagPayload {
    id?: string
    name: string
    emoji_id?: string | null
    emoji_name?: string | null
    moderated?: boolean
}

/** A thread-only channel's `default_reaction_emoji`. */
export interface DefaultReaction {
    emoji_id?: string | null
    emoji_name?: string | null
}

/** The sort a channel opens with. */
export const defaultThreadSortBy = (
    defaultSortOrder: number | null | undefined,
): ThreadSortBy =>
    defaultSortOrder === ForumSortOrder.CREATION_DATE
        ? ThreadSortBy.CREATION_TIME
        : ThreadSortBy.LAST_MESSAGE_TIME
