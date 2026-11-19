import { useSessionStore } from '../../core/react'
import { channelsStore, isThread } from '../../stores/channels/channels'
import { guildsStore } from '../../stores/guilds'
import { settingsStore } from '../../stores/settings/settingsStore'
import {
    isChannelOrParentOptedIn,
    isOptInEnabledForGuild,
} from '../../stores/unreadPolicy'

/**
 * useShowChannelOptInNotice: the channel is in an opt-in server and not on the user's channel list. Threads never
 * ask. Returns the server's id when the notice shows.
 */
export function useShowChannelOptInNotice(
    channelId: string,
): string | undefined {
    const channel = useSessionStore(
        channelsStore,
        state => state.channels[channelId],
    )
    const guild = useSessionStore(guildsStore, state =>
        channel?.guild_id ? state.guilds[channel.guild_id] : undefined,
    )
    const shown = useSessionStore(
        settingsStore,
        state =>
            channel !== undefined &&
            guild !== undefined &&
            !isThread(channel) &&
            isOptInEnabledForGuild(state, guild) &&
            !isChannelOrParentOptedIn(state, channel),
    )
    return shown ? guild?.id : undefined
}
