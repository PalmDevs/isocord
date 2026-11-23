import { FlashList } from '@shopify/flash-list'
import { useEffect, useMemo, useState } from 'react'
import { ScrollView, useWindowDimensions } from 'react-native'
import { memberCanView } from '../../../core/discord/permissions'
import { useSession, useSessionStore } from '../../../core/react'
import { Text } from '../../../design/components/Text'
import { t } from '../../../i18n'
import { channelsStore } from '../../../stores/channels/channels'
import { guildsStore } from '../../../stores/guilds'
import {
    MEMBER_SEARCH_LIMIT,
    membersStore,
    searchGuildMembers,
} from '../../../stores/members'
import { displayName, usersStore } from '../../../stores/users'
import { MemberPlaceholderRows } from './MemberListLoading'
import { MEMBER_PLACEHOLDER_ROW_HEIGHT, MemberRow } from './MemberRow'
import { matchRank } from './matchRank'
import { styles } from './styles'
import type { SearchTabPageProps } from '../types'

/** How long to wait for the gateway's answer before showing what is known. */
const FETCH_TIMEOUT_MS = 5000

let nonceCounter = 0

/**
 * SearchableMembersScreen and SearchMemberTabStore: asks the gateway for the members matching the query
 * (REQUEST_GUILD_MEMBERS, 50, with presences), then lists those of the guild that match it by name, best match
 * first, that can see the channel. Placeholders stand in while the request is out.
 */
export function GuildMemberSearch({
    channelId,
    guildId,
    query,
    active,
}: Pick<SearchTabPageProps, 'query' | 'active'> & {
    channelId: string
    guildId: string
}) {
    const session = useSession()
    const { height } = useWindowDimensions()
    const channel = useSessionStore(
        channelsStore,
        state => state.channels[channelId],
    )
    const guild = useSessionStore(guildsStore, state => state.guilds[guildId])
    const members = useSessionStore(
        membersStore,
        state => state.members[guildId],
    )
    const users = useSessionStore(usersStore, state => state.users)

    // MembersPage passes the settled query.
    const needle = query.toLowerCase()
    const [completedNeedle, setCompletedNeedle] = useState<string | null>(null)
    const fetching = active && needle !== '' && completedNeedle !== needle
    useEffect(() => {
        if (!active || needle === '') return
        const done = () => setCompletedNeedle(needle)
        const nonce = `ms${++nonceCounter}`
        if (!searchGuildMembers(session, guildId, needle, nonce)) return done()
        setCompletedNeedle(null)
        const off = session.gateway.dispatch.on(
            'GUILD_MEMBERS_CHUNK',
            chunk => {
                if (chunk.nonce === nonce) done()
            },
        )
        const timer = setTimeout(done, FETCH_TIMEOUT_MS)
        return () => {
            off()
            clearTimeout(timer)
        }
    }, [active, session, guildId, needle])

    const ids = useMemo(() => {
        if (fetching || needle === '' || !guild || !members) return []
        const matches: Array<{ id: string; rank: number; name: string }> = []
        for (const [id, member] of Object.entries(members)) {
            const user = users[id]
            if (!user) continue
            const rank = Math.min(
                ...[member.nick, user.global_name, user.username]
                    .filter((name): name is string => Boolean(name))
                    .map(name => matchRank(name, needle))
                    .filter(rank => rank >= 0),
            )
            if (rank === Number.POSITIVE_INFINITY) continue
            if (!memberCanView(guild, channel, id, member.roles)) continue
            matches.push({
                id,
                rank,
                name: (member.nick ?? displayName(user)).toLowerCase(),
            })
        }
        matches.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
        return matches.slice(0, MEMBER_SEARCH_LIMIT).map(match => match.id)
    }, [fetching, needle, guild, members, users, channel])

    if (fetching)
        return (
            <ScrollView
                contentContainerStyle={styles.searchContent}
                scrollEnabled={false}
            >
                <MemberPlaceholderRows
                    count={Math.ceil(height / MEMBER_PLACEHOLDER_ROW_HEIGHT)}
                />
            </ScrollView>
        )

    return (
        <FlashList
            data={ids}
            keyExtractor={id => id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.searchContent}
            ListEmptyComponent={
                needle === '' ? null : (
                    <Text color="TEXT_MUTED" style={styles.empty}>
                        {t('members.noResults')}
                    </Text>
                )
            }
            renderItem={({ item: id, index }) => (
                <MemberRow
                    userId={id}
                    guildId={guildId}
                    ownerId={guild?.ownerId}
                    start={index === 0}
                    end={index === ids.length - 1}
                />
            )}
        />
    )
}
