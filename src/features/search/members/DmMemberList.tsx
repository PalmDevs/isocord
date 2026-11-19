import { FlashList } from '@shopify/flash-list'
import { useMemo } from 'react'
import { useSession, useSessionStore } from '../../../core/react'
import { t } from '../../../i18n'
import { channelsStore } from '../../../stores/channels/channels'
import { displayName, usersStore } from '../../../stores/users'
import { MemberRow, MemberSectionHeader } from './MemberRow'
import { styles } from './styles'
import type { SearchTabPageProps } from '../types'

/**
 * PrivateChannelUserList: the people of a DM or group DM, you included, by username.
 * The group's owner has a crown.
 * The query filters by name, which the reference's DM search does not offer here.
 */
export function DmMemberList({
    channelId,
    query,
}: Pick<SearchTabPageProps, 'query'> & { channelId: string }) {
    const session = useSession()
    const channel = useSessionStore(
        channelsStore,
        state => state.channels[channelId],
    )
    const users = useSessionStore(usersStore, state => state.users)

    const ids = useMemo(() => {
        const all = [
            ...new Set([...(channel?.recipient_ids ?? []), session.userId]),
        ]
        const needle = query.toLowerCase()
        return all
            .filter(id => {
                const user = users[id]
                return (
                    needle === '' ||
                    displayName(user).toLowerCase().includes(needle) ||
                    (user?.username.toLowerCase().includes(needle) ?? false)
                )
            })
            .sort((a, b) =>
                (users[a]?.username ?? '')
                    .toLowerCase()
                    .localeCompare((users[b]?.username ?? '').toLowerCase()),
            )
    }, [channel?.recipient_ids, session.userId, users, query])

    return (
        <FlashList
            data={ids}
            keyExtractor={id => id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
            ListHeaderComponent={
                ids.length > 0 ? (
                    <MemberSectionHeader
                        title={`${t('members.members')} — ${ids.length}`}
                    />
                ) : null
            }
            renderItem={({ item: id, index }) => (
                <MemberRow
                    userId={id}
                    ownerId={channel?.owner_id}
                    start={index === 0}
                    end={index === ids.length - 1}
                />
            )}
        />
    )
}
