import { useEffect } from 'react'
import { ChannelFlags } from '../../core/discord/channelFlags'
import { useSession, useSessionStore } from '../../core/react'
import {
    feedKey,
    forumPostsStore,
    loadForumPage,
} from '../../stores/forumPosts'
import type { ForumQuery } from '../../stores/forumPosts'

const NO_IDS: string[] = []
const ID_SEPARATOR = ','

/**
 * The posts of a forum for a query, pinned ones first (ForumUtils.sortPinnedFirst), loading the first page when
 * the query has none yet. `ids` has no duplicates. A post's data is read by its card, so the list only changes
 * when posts are added, removed or pinned.
 */
export function useForumFeed(channelId: string, query: ForumQuery) {
    const session = useSession()
    const key = feedKey(channelId, query)
    const feed = useSessionStore(forumPostsStore, state => state.feeds[key])
    // The pinned ids as one string, so a post being pinned or unpinned is the only thing that re-renders this.
    const pinned = useSessionStore(forumPostsStore, state =>
        (state.feeds[key]?.ids ?? NO_IDS)
            .filter(
                id =>
                    ((state.posts[id]?.flags ?? 0) & ChannelFlags.PINNED) !== 0,
            )
            .join(ID_SEPARATOR),
    )
    // The first page, once per query.
    // biome-ignore lint/correctness/useExhaustiveDependencies: `key` stands for the channel and query
    useEffect(() => {
        loadForumPage(session, channelId, query)
    }, [session, key])

    const pinnedIds = pinned ? pinned.split(ID_SEPARATOR) : NO_IDS
    const pinnedSet = new Set(pinnedIds)
    const ids = [
        ...pinnedIds,
        ...(feed?.ids ?? NO_IDS).filter(id => !pinnedSet.has(id)),
    ]
    return {
        ids,
        pinnedCount: pinnedIds.length,
        hasMore: feed?.hasMore ?? true,
        /** Whether the first page is still on its way. */
        loading: feed === undefined || (feed.loading && feed.ids.length === 0),
        failed: feed?.failed ?? false,
        loadingMore: feed?.loading === true && feed.ids.length > 0,
        loadMore: () => loadForumPage(session, channelId, query),
        /** Fetches the query's posts again from the first page. */
        refresh: () => loadForumPage(session, channelId, query, true),
    }
}
