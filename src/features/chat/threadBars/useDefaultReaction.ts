import { useSessionStore } from '../../../core/react'
import { channelsStore } from '../../../stores/channels/channels'
import { forumPostsStore } from '../../../stores/forumPosts'
import type { Message } from '../../../stores/readStates'

/** The forum's `default_reaction_emoji`, for the post a message starts. */
export function useDefaultReaction(message: Message) {
    // An unopened post is only in the forum's store, not a channel yet.
    const postParentId = useSessionStore(
        forumPostsStore,
        state => state.posts[message.channel_id]?.parent_id,
    )
    return useSessionStore(channelsStore, state => {
        const parentId =
            state.channels[message.channel_id]?.parent_id ?? postParentId
        return parentId
            ? state.channels[parentId]?.default_reaction_emoji
            : undefined
    })
}
