import { useMemo } from 'react'
import { ChannelType } from '../../../core/discord/channelType'
import { Permission } from '../../../core/discord/permissions'
import { compareSnowflakes } from '../../../core/discord/snowflake'
import { useSession, useSessionStore } from '../../../core/react'
import {
    channelsStore,
    isThread,
    isVoice,
} from '../../../stores/channels/channels'
import { guildsStore } from '../../../stores/guilds'
import { can } from '../../../stores/permissions'
import { readStatesStore } from '../../../stores/readStates'
import type { Channel } from '../../../stores/channels/channels'

export interface GuildChannelResults {
    /** Text channels, the one with the newest message first. */
    text: Array<{ id: string; lastMessageId: string | undefined }>
    /** Voice and stage channels, in the server's order. */
    voice: string[]
}

/**
 * SearchGuildChannelTabStore's GuildChannelSearchManager.search: the server's channels whose name has the query
 * (AutocompleteUtils.queryChannels, not fuzzy, every channel for an empty query), split into text and voice.
 * Categories, threads and channels the user cannot see are left out.
 */
export function useGuildChannelResults(
    guildId: string | undefined,
    query: string,
): GuildChannelResults {
    const session = useSession()
    const guild = useSessionStore(guildsStore, state =>
        guildId ? state.guilds[guildId] : undefined,
    )
    const ids = useSessionStore(channelsStore, state =>
        guildId ? state.byGuild[guildId] : undefined,
    )
    const channels = useSessionStore(channelsStore, state => state.channels)
    const lastMessageIds = useSessionStore(
        readStatesStore,
        state => state.lastMessageIds,
    )
    return useMemo(() => {
        const results: GuildChannelResults = { text: [], voice: [] }
        if (!guild || !ids) return results
        const needle = query.toLowerCase()
        const voice: Channel[] = []
        for (const id of ids) {
            const channel = channels[id]
            if (
                !channel?.name ||
                channel.type === ChannelType.GUILD_CATEGORY ||
                isThread(channel) ||
                !channel.name.toLowerCase().includes(needle) ||
                !can(session, id, Permission.VIEW_CHANNEL)
            )
                continue
            if (isVoice(channel)) voice.push(channel)
            else
                results.text.push({
                    id,
                    lastMessageId:
                        lastMessageIds[id] ??
                        channel.last_message_id ??
                        undefined,
                })
        }
        results.text.sort((a, b) =>
            compareSnowflakes(b.lastMessageId, a.lastMessageId),
        )
        voice.sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        results.voice = voice.map(channel => channel.id)
        return results
    }, [guild, ids, channels, lastMessageIds, query, session.userId, session])
}
