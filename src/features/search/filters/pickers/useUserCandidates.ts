import { useEffect, useMemo } from 'react'
import { useSession, useSessionStore } from '../../../../core/react'
import { channelsStore } from '../../../../stores/channels/channels'
import {
    MEMBER_SEARCH_LIMIT,
    membersStore,
    searchGuildMembers,
} from '../../../../stores/members'
import { displayName, usersStore } from '../../../../stores/users'
import { usePrivateChannelEntries } from '../../global/dms'
import { matchRank } from '../../members/matchRank'
import { useSettledQuery } from '../../useSettledQuery'
import type { SearchContext } from '../../types'

export interface UserCandidate {
    id: string
    /** The nickname in the guild, else the display name. */
    name: string
    username: string
}

let nonceCounter = 0

/** The best matchRank of a person's names, -1 when none matches. */
function bestRank(names: string[], query: string): number {
    const ranks = names
        .map(name => matchRank(name, query))
        .filter(rank => rank >= 0)
    return ranks.length > 0 ? Math.min(...ranks) : -1
}

/** The ids of the people a context's messages can be from: the guild's members, the DM's people, or your DMs'. */
function useCandidateIds(context: SearchContext): string[] {
    const session = useSession()
    const guildId = context.type === 'GUILD_CHANNEL' ? context.guildId : ''
    const channelId = context.type === 'CHANNEL' ? context.channelId : ''
    const members = useSessionStore(membersStore, state =>
        guildId ? state.members[guildId] : undefined,
    )
    const recipients = useSessionStore(
        channelsStore,
        state => state.channels[channelId]?.recipient_ids,
    )
    const entries = usePrivateChannelEntries()
    return useMemo(() => {
        if (context.type === 'GUILD_CHANNEL') return Object.keys(members ?? {})
        const ids =
            context.type === 'CHANNEL'
                ? (recipients ?? [])
                : entries.flatMap(entry => entry.channel.recipient_ids ?? [])
        return [...new Set([session.userId, ...ids])]
    }, [context.type, members, recipients, entries, session.userId])
}

/**
 * The people a filter like `from` can pick, best match first. In a guild the gateway is asked for the members
 * matching the settled text (REQUEST_GUILD_MEMBERS), as the reference's getUserAutocompletions does.
 */
export function useUserCandidates(
    context: SearchContext,
    query: string,
): UserCandidate[] {
    const session = useSession()
    const settled = useSettledQuery(query.toLowerCase())
    const guildId = context.type === 'GUILD_CHANNEL' ? context.guildId : ''
    useEffect(() => {
        if (guildId && settled)
            searchGuildMembers(session, guildId, settled, `sf${++nonceCounter}`)
    }, [session, guildId, settled])

    const ids = useCandidateIds(context)
    const members = useSessionStore(membersStore, state =>
        guildId ? state.members[guildId] : undefined,
    )
    const users = useSessionStore(usersStore, state => state.users)
    const needle = query.toLowerCase()
    return useMemo(() => {
        const found: Array<UserCandidate & { rank: number }> = []
        for (const id of ids) {
            const user = users[id]
            if (!user) continue
            const nick = members?.[id]?.nick
            const name = displayName(user, nick)
            const rank =
                needle === '' ? 0 : bestRank([name, user.username], needle)
            if (rank < 0) continue
            found.push({ id, name, username: user.username, rank })
        }
        found.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
        return found.slice(0, MEMBER_SEARCH_LIMIT)
    }, [ids, users, members, needle])
}
