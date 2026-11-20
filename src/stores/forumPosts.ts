import { createStore } from 'zustand/vanilla'
import { Endpoint } from '../core/api/paths'
import { ChannelFlags } from '../core/discord/channelFlags'
import {
    FORUM_PAGE_SIZE,
    MIN_TAGS_TO_MATCH,
    SORT_ORDER_DESCENDING,
    THREAD_SEARCH_MAX_OFFSET,
    THREAD_SEARCH_NAME_MAX,
} from '../core/discord/forum'
import { logger } from '../core/log'
import { defineStore } from '../core/session'
import { channelsStore } from './channels/channels'
import { reactionChangeOf } from './messages/messages'
import {
    sameEmoji,
    withReactionAdded,
    withReactionRemoved,
} from './messages/reactionEdits'
import { usersStore } from './users'
import type { TagSetting, ThreadSortBy } from '../core/discord/forum'
import type { ThreadMember } from '../core/discord/threadMember'
import type { Session } from '../core/session'
import type { Channel } from './channels/channels'
import type { Message } from './readStates'

const log = logger('Forum')

/** Feeds kept per forum; the least recently added query is dropped beyond this. */
const MAX_FEEDS_PER_CHANNEL = 5

/** What a forum's post list shows: its order and filters. */
export interface ForumQuery {
    sortBy: ThreadSortBy
    tagIds: string[]
    tagSetting: TagSetting
    /** Search text, matched against post titles and first messages. */
    name?: string
}

interface ForumFeed {
    channelId: string
    /** The query has no tags and no search text, so a new post belongs in it. */
    unfiltered: boolean
    /** The posts fetched so far, in the order the server returned them. */
    ids: string[]
    hasMore: boolean
    loading: boolean
    failed: boolean
}

interface ForumPostsState {
    /** Posts fetched by the search, by id; the active ones are also in `threadsStore`, which is kept live. */
    posts: Record<string, Channel>
    /** ForumPostMessagesStore: the first message of each post, by post id (the message's id is the post's). */
    firstMessages: Record<string, Message>
    /** The fetched pages of each channel and query, by `feedKey`. */
    feeds: Record<string, ForumFeed>
}

interface ThreadSearchResponse {
    threads?: Channel[]
    /** The user's membership of the returned posts it has joined. */
    members?: (ThreadMember & { id: string })[]
    first_messages?: Message[]
    most_recent_messages?: Message[]
    has_more?: boolean
}

const isUnfiltered = (query: ForumQuery) =>
    query.tagIds.length === 0 && !query.name

/** The key a query's pages are kept under. */
export const feedKey = (channelId: string, query: ForumQuery): string =>
    JSON.stringify([
        channelId,
        query.sortBy,
        [...query.tagIds].sort(),
        query.tagSetting,
        query.name ?? '',
    ])

/** Fetched forum posts and their first messages, kept for the session. */
export const forumPostsStore = defineStore('forumPosts', session => {
    const store = createStore<ForumPostsState>(() => ({
        posts: {},
        firstMessages: {},
        feeds: {},
    }))
    const { dispatch } = session.gateway
    // A new post is the newest in either sort, so it tops the feeds that show every post of its forum.
    dispatch.on('THREAD_CREATE', thread =>
        store.setState(state => {
            // Only threads of a forum that has a feed are kept.
            if (
                !Object.values(state.feeds).some(
                    feed => feed.channelId === thread.parent_id,
                )
            )
                return state
            const feeds: Record<string, ForumFeed> = {}
            for (const [key, feed] of Object.entries(state.feeds))
                feeds[key] =
                    feed.unfiltered &&
                    feed.channelId === thread.parent_id &&
                    !feed.ids.includes(thread.id)
                        ? { ...feed, ids: [thread.id, ...feed.ids] }
                        : feed
            return {
                posts: { ...state.posts, [thread.id]: thread },
                feeds,
            }
        }),
    )
    dispatch.on('THREAD_UPDATE', thread =>
        store.setState(state =>
            state.posts[thread.id]
                ? {
                      posts: {
                          ...state.posts,
                          [thread.id]: { ...state.posts[thread.id], ...thread },
                      },
                  }
                : state,
        ),
    )
    dispatch.on('THREAD_DELETE', ({ id }) =>
        store.setState(state => {
            const { [id]: _post, ...posts } = state.posts
            const feeds: Record<string, ForumFeed> = {}
            for (const [key, feed] of Object.entries(state.feeds))
                feeds[key] = {
                    ...feed,
                    ids: feed.ids.filter(other => other !== id),
                }
            return { posts, feeds }
        }),
    )
    /** Applies `edit` to a post's held first message (it has the post's id). */
    const editFirst = (
        channelId: string,
        messageId: string,
        edit: (message: Message) => Message,
    ) => {
        const held = store.getState().firstMessages[channelId]
        if (held?.id !== messageId) return
        store.setState(state => ({
            firstMessages: { ...state.firstMessages, [channelId]: edit(held) },
        }))
    }
    dispatch.on('MESSAGE_UPDATE', update =>
        editFirst(update.channel_id, update.id, held => ({
            ...held,
            ...update,
        })),
    )
    // ForumPostMessagesStore keeps the cards' reactions live.
    dispatch.on('MESSAGE_REACTION_ADD', event =>
        editFirst(event.channel_id, event.message_id, message =>
            withReactionAdded(message, reactionChangeOf(event, session.userId)),
        ),
    )
    dispatch.on('MESSAGE_REACTION_REMOVE', event =>
        editFirst(event.channel_id, event.message_id, message =>
            withReactionRemoved(
                message,
                reactionChangeOf(event, session.userId),
            ),
        ),
    )
    dispatch.on('MESSAGE_REACTION_REMOVE_ALL', event =>
        editFirst(event.channel_id, event.message_id, message => ({
            ...message,
            reactions: [],
        })),
    )
    dispatch.on('MESSAGE_REACTION_REMOVE_EMOJI', event =>
        editFirst(event.channel_id, event.message_id, message => ({
            ...message,
            reactions: (message.reactions ?? []).filter(
                reaction => !sameEmoji(reaction.emoji, event.emoji),
            ),
        })),
    )
    return store
})

/** Drops the oldest feeds of a forum beyond the limit, never the one just loaded. */
function evictOldFeeds(
    feeds: Record<string, ForumFeed>,
    channelId: string,
    keep: string,
): Record<string, ForumFeed> {
    const old = Object.keys(feeds).filter(
        key => feeds[key]?.channelId === channelId && key !== keep,
    )
    const drop = new Set(
        old.slice(0, Math.max(0, old.length + 1 - MAX_FEEDS_PER_CHANNEL)),
    )
    return Object.fromEntries(
        Object.entries(feeds).filter(([key]) => !drop.has(key)),
    )
}

/**
 * ForumActionCreators / ForumPostDataLoader: the next page of a query's posts from
 * `GET /channels/{id}/threads/search`, which also returns each post's first message (the reference loads those
 * with `POST /channels/{id}/post-data` for the posts the gateway lists). Without `reset` a feed that is loading,
 * failed or complete is left alone, and one that has pages loads the page after them.
 */
export async function loadForumPage(
    session: Session,
    channelId: string,
    query: ForumQuery,
    reset = false,
): Promise<void> {
    const store = session.get(forumPostsStore)
    const key = feedKey(channelId, query)
    const held = store.getState().feeds[key]
    if (held?.loading) return
    if (!reset && held && (!held.hasMore || held.failed)) return
    const offset = reset ? 0 : (held?.ids.length ?? 0)
    const mark = (feed: Partial<ForumFeed>) =>
        store.setState(state => ({
            feeds: {
                ...state.feeds,
                [key]: {
                    channelId,
                    unfiltered: isUnfiltered(query),
                    ids: [],
                    hasMore: true,
                    loading: false,
                    failed: false,
                    ...state.feeds[key],
                    ...feed,
                },
            },
        }))
    mark({ loading: true, failed: false })
    try {
        const body = await session.rest.get<ThreadSearchResponse>(
            Endpoint.channelThreadsSearch(channelId),
            {
                query: {
                    sort_by: query.sortBy,
                    sort_order: SORT_ORDER_DESCENDING,
                    limit: FORUM_PAGE_SIZE,
                    offset,
                    tag: query.tagIds.length ? query.tagIds : undefined,
                    tag_setting:
                        query.tagIds.length >= MIN_TAGS_TO_MATCH
                            ? query.tagSetting
                            : undefined,
                    name: query.name?.slice(0, THREAD_SEARCH_NAME_MAX),
                },
            },
        )
        const guildId = session.get(channelsStore).getState().channels[
            channelId
        ]?.guild_id
        const threads = body.threads ?? []
        const messages = [
            ...(body.first_messages ?? []),
            ...(body.most_recent_messages ?? []),
        ]
        session
            .get(usersStore)
            .getState()
            .upsert(messages.map(message => message.author))
        store.setState(state => {
            const posts = { ...state.posts }
            // LOAD_THREADS_SUCCESS: the search's members are the user's joined posts (JoinedThreadsStore).
            const members = new Map(
                (body.members ?? []).map(({ id, ...member }) => [id, member]),
            )
            for (const thread of threads)
                posts[thread.id] = {
                    ...thread,
                    guild_id: thread.guild_id ?? guildId,
                    member: members.get(thread.id) ?? thread.member,
                }
            const firstMessages = { ...state.firstMessages }
            for (const message of body.first_messages ?? [])
                firstMessages[message.channel_id] = message
            // A refresh keeps the feed's pinned posts: the search pages do not always bring them back.
            const held = state.feeds[key]?.ids ?? []
            const previous = reset
                ? held.filter(
                      id =>
                          ((posts[id]?.flags ?? 0) & ChannelFlags.PINNED) !== 0,
                  )
                : held
            const ids = [
                ...previous,
                ...threads
                    .map(thread => thread.id)
                    .filter(id => !previous.includes(id)),
            ]
            return {
                posts,
                firstMessages,
                feeds: evictOldFeeds(
                    {
                        ...state.feeds,
                        [key]: {
                            channelId,
                            unfiltered: isUnfiltered(query),
                            ids,
                            hasMore:
                                body.has_more === true &&
                                ids.length <= THREAD_SEARCH_MAX_OFFSET,
                            loading: false,
                            failed: false,
                        },
                    },
                    channelId,
                    key,
                ),
            }
        })
    } catch (error) {
        log.warn(`Posts of ${channelId} failed to load`, error)
        mark({ failed: true })
    }
}
