import { useSessionStore } from '../../core/react'
import { threadsStore } from '../../stores/channels/threads'
import { forumPostsStore } from '../../stores/forumPosts'

/** A post: the live thread of an active one (message counts follow the gateway), else the fetched one. */
export function useForumPost(id: string) {
    const active = useSessionStore(threadsStore, state => state.active[id])
    const fetched = useSessionStore(forumPostsStore, state => state.posts[id])
    return active ? { ...fetched, ...active } : fetched
}

/** A post's first message, from the post list's fetch. */
export function useForumFirstMessage(id: string) {
    return useSessionStore(forumPostsStore, state => state.firstMessages[id])
}
