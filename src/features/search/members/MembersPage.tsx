import { useSessionStore } from '../../../core/react'
import { channelsStore } from '../../../stores/channels/channels'
import { hasThreadMemberList } from '../../../stores/memberList'
import { useSettledQuery } from '../useSettledQuery'
import { DmMemberList } from './DmMemberList'
import { GuildMemberList } from './GuildMemberList'
import { GuildMemberSearch } from './GuildMemberSearch'
import { ThreadMemberList } from './ThreadMemberList'
import type { SearchTabPageProps } from '../types'

/**
 * The Members tab (modules/search MembersScreen). A guild channel shows its member list (a thread its own members),
 * or with a query the members matching it; a DM or group DM shows its people.
 */
export function MembersPage({ context, query, active }: SearchTabPageProps) {
    const settled = useSettledQuery(query)
    const channelId = context.type === 'GUILD_CHANNEL' ? context.channelId : ''
    // A thread lists its own members (ThreadChannelUserList), not its channel's.
    const threadList = useSessionStore(channelsStore, state => {
        const channel = state.channels[channelId]
        return channel ? hasThreadMemberList(channel) : false
    })
    if (context.type === 'CHANNEL')
        return <DmMemberList channelId={context.channelId} query={query} />
    if (context.type !== 'GUILD_CHANNEL') return null
    // SearchableMembersScreen: the channel's member list until a query has settled (isInitialSearchQuery).
    return settled === '' ? (
        threadList ? (
            <ThreadMemberList
                channelId={context.channelId}
                guildId={context.guildId}
                active={active}
            />
        ) : (
            <GuildMemberList
                channelId={context.channelId}
                guildId={context.guildId}
                active={active}
            />
        )
    ) : (
        <GuildMemberSearch
            channelId={context.channelId}
            guildId={context.guildId}
            query={settled}
            active={active}
        />
    )
}
