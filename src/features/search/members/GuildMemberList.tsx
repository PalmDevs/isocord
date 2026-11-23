import { FlashList } from '@shopify/flash-list'
import { useEffect } from 'react'
import { useSession, useSessionStore } from '../../../core/react'
import { t } from '../../../i18n'
import { channelsStore } from '../../../stores/channels/channels'
import { guildsStore } from '../../../stores/guilds'
import {
    memberListChannel,
    memberListIdOf,
    memberListStore,
    OFFLINE_GROUP,
    ONLINE_GROUP,
    prefetchMemberList,
    rangesFor,
    subscribeMemberList,
} from '../../../stores/memberList'
import { MemberListLoading } from './MemberListLoading'
import { MemberPlaceholders } from './MemberPlaceholders'
import {
    MemberPlaceholderRow,
    MemberRow,
    MemberSectionHeader,
} from './MemberRow'
import { styles } from './styles'
import { useHeldWhileReloading } from './useHeldWhileReloading'
import type { ViewToken } from '@shopify/flash-list'
import type { MemberListRow } from '../../../stores/memberList'
import type { SearchTabPageProps } from '../types'

/**
 * The member list of the channel (GuildChannelUserList with sections that do not stick): the hoisted roles, then
 * Online and Offline, each with its count. Rows come from the lazy member list; the blocks of rows around what is
 * on screen are asked for as the list scrolls.
 */
export function GuildMemberList({
    channelId,
    guildId,
    active,
}: Pick<SearchTabPageProps, 'active'> & {
    channelId: string
    guildId: string
}) {
    const session = useSession()
    const listChannel = useSessionStore(channelsStore, state =>
        memberListChannel(state.channels, channelId),
    )
    const guild = useSessionStore(guildsStore, state => state.guilds[guildId])
    const key = `${guildId}:${memberListIdOf(listChannel, guild)}`
    // The rows are FlashList's data: an update copies the array but keeps the objects of the rows it did not touch,
    // so only the cells whose row changed render again.
    const rows = useHeldWhileReloading(
        key,
        useSessionStore(memberListStore, state => state.lists[key]?.rows),
    )
    // A string, so it changes with the groups' counts, not with every update (each carries a new `groups` array).
    const groupsKey = useHeldWhileReloading(
        key,
        useSessionStore(memberListStore, state =>
            state.lists[key]?.groups
                .map(group => `${group.id}:${group.count}`)
                .join(','),
        ),
    )

    useEffect(() => {
        if (active) prefetchMemberList(session, channelId)
    }, [active, session, channelId])

    const onViewableItemsChanged = ({
        viewableItems,
    }: {
        viewableItems: ViewToken<MemberRowItem>[]
    }) => {
        const indexes = viewableItems.flatMap(token =>
            token.index === null ? [] : [token.index],
        )
        if (!active || indexes.length === 0) return
        subscribeMemberList(
            session,
            guildId,
            channelId,
            rangesFor(Math.min(...indexes), Math.max(...indexes)),
        )
    }

    if (!rows || groupsKey === undefined) return <MemberListLoading />

    // Everything renderItem reads besides the row comes from the groups, so it stays the same function between
    // updates that leave the groups alone.
    const { headers, offline, total } = layoutOf(groupsKey)
    const edge = (index: number) =>
        index < 0 || index >= total || headers[index] !== undefined
    const titleOf = (id: string) =>
        id === ONLINE_GROUP
            ? t('members.online')
            : id === OFFLINE_GROUP
              ? t('members.offline')
              : (guild?.roles[id]?.name ?? '')

    return (
        <MemberPlaceholders>
            <FlashList
                key="rows"
                data={rows}
                // The default draw distance. Native placeholders cover rows not mounted yet.
                reserveDrawDistanceForReversal
                keyExtractor={(_, index) => String(index)}
                getItemType={(row, index) =>
                    headers[index]
                        ? 'group'
                        : row?.type === 'member'
                          ? 'member'
                          : 'placeholder'
                }
                // Discard idle cells once they leave the render window.
                maxItemsInRecyclePool={0}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.content}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={VIEWABILITY}
                renderItem={({ item: row, index }) => {
                    const header = headers[index]
                    if (header)
                        // A group without members shows nothing (GuildChannelUserList hides it).
                        return header.count === 0 ? null : (
                            <MemberSectionHeader
                                title={`${titleOf(header.id)} — ${header.count}`}
                            />
                        )
                    if (row?.type !== 'member')
                        return (
                            <MemberPlaceholderRow
                                animate={false}
                                start={edge(index - 1)}
                                end={edge(index + 1)}
                            />
                        )
                    return (
                        <MemberRow
                            userId={row.userId}
                            guildId={guildId}
                            ownerId={guild?.ownerId}
                            offline={index >= offline[0] && index <= offline[1]}
                            start={edge(index - 1)}
                            end={edge(index + 1)}
                        />
                    )
                }}
            />
        </MemberPlaceholders>
    )
}

type MemberRowItem = MemberListRow | undefined

/**
 * ChannelMemberStore.setGroups: where each group's header lies follows from the counts, so headers show with their
 * role names even where the rows are not loaded yet. The offline group's members have no status.
 */
function layoutOf(groupsKey: string) {
    const headers: Record<number, { id: string; count: number }> = {}
    let offline: [number, number] = [-1, -1]
    let position = 0
    for (const entry of groupsKey === '' ? [] : groupsKey.split(',')) {
        const separator = entry.lastIndexOf(':')
        const id = entry.slice(0, separator)
        const count = Math.max(0, Number(entry.slice(separator + 1)))
        headers[position] = { id, count }
        if (id === OFFLINE_GROUP) offline = [position, position + count]
        position += count + 1
    }
    return { headers, offline, total: position }
}

const VIEWABILITY = { itemVisiblePercentThreshold: 1 }
