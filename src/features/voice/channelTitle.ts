import { useSessionStore } from '../../core/react'
import { computeChannelName } from '../../stores/channels/channelName'
import { channelsStore, isPrivate } from '../../stores/channels/channels'
import { usersStore } from '../../stores/users'
import type { Session } from '../../core/session'

/**
 * Returns the name a call shows for its channel: a voice channel's name, a DM's user or a group DM's name or people
 * (computeChannelName). Empty for a channel that is not loaded.
 */
export function callChannelName(session: Session, channelId: string): string {
    const channel = session.get(channelsStore).getState().channels[channelId]
    if (!channel) return ''
    if (!isPrivate(channel)) return channel.name ?? ''
    return computeChannelName(channel, session.get(usersStore).getState().users)
}

/** The hook of `callChannelName`: the call's title in the dock, the panel and the PIP. */
export function useCallChannelName(channelId: string | null): string {
    const channel = useSessionStore(channelsStore, state =>
        channelId ? state.channels[channelId] : undefined,
    )
    const name = useSessionStore(usersStore, state =>
        channel && isPrivate(channel)
            ? computeChannelName(channel, state.users)
            : '',
    )
    if (!channel) return ''
    return isPrivate(channel) ? name : (channel.name ?? '')
}
