import { FlashList } from '@shopify/flash-list'
import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useSession, useSessionStore } from '../../../core/react'
import { t } from '../../../i18n'
import { channelsStore } from '../../../stores/channels/channels'
import { guildsStore } from '../../../stores/guilds'
import {
    memberListStore,
    OFFLINE_GROUP,
    ONLINE_GROUP,
    prefetchMemberList,
    threadMemberSections,
} from '../../../stores/memberList'
import { membersStore } from '../../../stores/members'
import { presencesStore } from '../../../stores/presences'
import { usersStore } from '../../../stores/users'
import { MemberListLoading } from './MemberListLoading'
import { MemberRow, MemberSectionHeader } from './MemberRow'
import { styles } from './styles'
import { useHeldWhileReloading } from './useHeldWhileReloading'
import type { SearchTabPageProps } from '../types'

const NO_IDS: string[] = []

type Item =
    | { type: 'section'; id: string; count: number }
    | {
          type: 'member'
          userId: string
          offline: boolean
          start: boolean
          end: boolean
      }

/**
 * ThreadChannelUserList: the members of a thread, not of its channel.
 * Data comes from ThreadMemberListStore (THREAD_MEMBER_LIST_UPDATE).
 * Sections are the hoisted roles, then Online and Offline.
 */
export function ThreadMemberList({
    channelId,
    guildId,
    active,
}: Pick<SearchTabPageProps, 'active'> & {
    channelId: string
    guildId: string
}) {
    const session = useSession()
    const listed = useHeldWhileReloading(
        channelId,
        useSessionStore(memberListStore, state => state.threads[channelId]),
    )
    // GuildSubscriptionsStore only subscribes to active threads, and an archived one is dropped from the store.
    const subscribed = useSessionStore(channelsStore, state => {
        const channel = state.channels[channelId]
        return channel !== undefined && !channel.thread_metadata?.archived
    })
    // An archived thread's list is dropped for good, not reloading.
    const userIds = subscribed ? listed : undefined
    const guild = useSessionStore(guildsStore, state => state.guilds[guildId])
    // Only this thread's members, compared item by item: a presence or user update elsewhere leaves the list alone.
    const ids = userIds ?? NO_IDS
    const users = useSessionStore(
        usersStore,
        useShallow(state => ids.map(id => state.users[id])),
    )
    const members = useSessionStore(
        membersStore,
        useShallow(state => ids.map(id => state.members[guildId]?.[id])),
    )
    const online = useSessionStore(
        presencesStore,
        useShallow(state =>
            ids.map(id => {
                const status = state.presences[id]?.status ?? 'offline'
                return status !== 'offline' && status !== 'invisible'
            }),
        ),
    )

    // useThreadMemberListSections subscribes on mount.
    useEffect(() => {
        if (active) prefetchMemberList(session, channelId)
    }, [active, session, channelId])

    // useThreadMemberListSections: without a list the sections are empty. Only a list on its way shimmers.
    if (!userIds && subscribed) return <MemberListLoading />

    const items: Item[] = []
    for (const section of threadMemberSections(
        guild,
        ids,
        users,
        members,
        online,
    )) {
        const count = section.userIds.length
        // A section without members shows nothing.
        if (count === 0) continue
        items.push({ type: 'section', id: section.id, count })
        section.userIds.forEach((userId, index) =>
            items.push({
                type: 'member',
                userId,
                offline: section.id === OFFLINE_GROUP,
                start: index === 0,
                end: index === count - 1,
            }),
        )
    }
    const titleOf = (id: string) =>
        id === ONLINE_GROUP
            ? t('members.online')
            : id === OFFLINE_GROUP
              ? t('members.offline')
              : (guild?.roles[id]?.name ?? '')

    return (
        <FlashList
            key="members"
            data={items}
            keyExtractor={item =>
                item.type === 'section' ? `section-${item.id}` : item.userId
            }
            getItemType={item => item.type}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
            renderItem={({ item }) =>
                item.type === 'section' ? (
                    <MemberSectionHeader
                        title={`${titleOf(item.id)} — ${item.count}`}
                    />
                ) : (
                    <MemberRow
                        userId={item.userId}
                        guildId={guildId}
                        ownerId={guild?.ownerId}
                        offline={item.offline}
                        start={item.start}
                        end={item.end}
                    />
                )
            }
        />
    )
}
