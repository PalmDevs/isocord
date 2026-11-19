import { GuildFeature } from '../../core/discord/guild'
import { useSessionStore } from '../../core/react'
import { guildsStore } from '../../stores/guilds'
import type { Channel } from '../../stores/channels/channels'

/** renderAnnouncement's check: the guild has NEWS, and the channel is neither its rules nor its updates channel. */
export function useCanToggleAnnouncement(channel: Channel): boolean {
    return useSessionStore(guildsStore, state => {
        const guild = channel.guild_id
            ? state.guilds[channel.guild_id]
            : undefined
        return (
            guild?.features?.includes(GuildFeature.NEWS) === true &&
            channel.id !== guild.rulesChannelId &&
            channel.id !== guild.publicUpdatesChannelId
        )
    })
}
