import { snowflakeFromTimestamp } from '../../../core/discord/snowflake'
import { useSession, useSessionStore } from '../../../core/react'
import { channelsStore } from '../../../stores/channels/channels'
import { guildsStore } from '../../../stores/guilds'
import {
    guildHasUnread,
    isUnread,
    readStatesStore,
} from '../../../stores/readStates'

/**
 * GuildReadStateStore.getGuildHasUnreadIgnoreMuted for the sheet. The selector only compares read
 * markers and returns the ids it found, so message traffic elsewhere re-renders nothing. The
 * permission checks of `guildHasUnread` run when that set changes.
 */
export function useGuildHasUnread(guildId: string): boolean {
    const session = useSession()
    const candidates = useSessionStore(readStatesStore, state => {
        const guild = session.get(guildsStore).getState().guilds[guildId]
        if (!guild) return ''
        const joined = snowflakeFromTimestamp(
            new Date(guild.joinedAt).getTime(),
        )
        return (session.get(channelsStore).getState().byGuild[guildId] ?? [])
            .filter(
                id =>
                    (state.mentions[id] ?? 0) > 0 ||
                    isUnread(state, id, joined),
            )
            .join(',')
    })
    return candidates !== '' && guildHasUnread(session, guildId)
}
