import { THREADS_ONLY_CHANNEL_TYPES } from '../../../core/discord/channelType'
import { useSessionStore } from '../../../core/react'
import { channelsStore } from '../../../stores/channels/channels'
import { ForumPanel } from '../../forum/ForumPanel'
import { ChatPanel } from '../ChatPanel'
import type { ComponentProps } from 'react'

/** A channel's panel: the post list of a forum or media channel, the chat of any other. */
export function ChannelPanel(props: ComponentProps<typeof ChatPanel>) {
    const forum = useSessionStore(channelsStore, state =>
        THREADS_ONLY_CHANNEL_TYPES.has(
            state.channels[props.channelId]?.type ?? -1,
        ),
    )
    // Keyed by channel, so each forum keeps its own query.
    return forum ? (
        <ForumPanel
            key={props.channelId}
            channelId={props.channelId}
            onBack={props.onBack}
            onRowsDrawn={props.onRowsDrawn}
            onOpenDetails={props.onOpenDetails}
        />
    ) : (
        <ChatPanel {...props} />
    )
}
