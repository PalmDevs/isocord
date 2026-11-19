import { defaultThreadSortBy, TagSetting } from '../../core/discord/forum'
import { useSession, useSessionStore } from '../../core/react'
import { channelsStore } from '../../stores/channels/channels'
import { forumQueriesStore } from '../../stores/forumQueries'
import type { ForumQuery } from '../../stores/forumPosts'

const NO_TAGS: string[] = []

/**
 * ForumSearchStore / ForumChannelStore: what a forum shows, starting from the channel's own defaults
 * (`default_sort_order`, `default_tag_setting`). `update` changes the parts it is given, `reset` puts the sort and
 * tags back (the search text stays). `activeCount` is what the filter button badges: the tags, and a changed sort.
 */
export function useForumQuery(channelId: string) {
    const session = useSession()
    const defaultSortOrder = useSessionStore(
        channelsStore,
        state => state.channels[channelId]?.default_sort_order,
    )
    const defaultTagSetting = useSessionStore(
        channelsStore,
        state => state.channels[channelId]?.default_tag_setting,
    )
    const changes = useSessionStore(
        forumQueriesStore,
        state => state.changes[channelId],
    )
    const defaultSortBy = defaultThreadSortBy(defaultSortOrder)
    const defaultSetting = defaultTagSetting ?? TagSetting.MATCH_SOME
    const query: ForumQuery = {
        sortBy: changes?.sortBy ?? defaultSortBy,
        tagIds: changes?.tagIds ?? NO_TAGS,
        tagSetting: changes?.tagSetting ?? defaultSetting,
        name: changes?.name,
    }
    const store = session.get(forumQueriesStore)
    return {
        query,
        defaultTagSetting: defaultSetting,
        activeCount:
            query.tagIds.length + (query.sortBy === defaultSortBy ? 0 : 1),
        update: (next: Partial<ForumQuery>) =>
            store.setState(state => ({
                changes: {
                    ...state.changes,
                    [channelId]: { ...state.changes[channelId], ...next },
                },
            })),
        reset: () =>
            store.setState(state => ({
                changes: {
                    ...state.changes,
                    [channelId]: { name: state.changes[channelId]?.name },
                },
            })),
    }
}
