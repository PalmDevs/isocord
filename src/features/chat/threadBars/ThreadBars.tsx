import { useSessionStore } from '../../../core/react'
import {
    channelsStore,
    isForumPost,
    isThread,
} from '../../../stores/channels/channels'
import { LockedThreadBanner } from './LockedThreadBanner'

/** The bars under a thread's header: the locked banner. A post's action bar is a row of the chat list. */
export function ThreadBars({ channelId }: { channelId: string }) {
    const channel = useSessionStore(
        channelsStore,
        state => state.channels[channelId],
    )
    const forumPost = useSessionStore(
        channelsStore,
        state =>
            channel !== undefined &&
            isForumPost(channel, state.channels[channel.parent_id ?? '']),
    )
    if (!channel || !isThread(channel)) return null
    return channel.thread_metadata?.locked === true ? (
        <LockedThreadBanner channel={channel} forumPost={forumPost} />
    ) : null
}
