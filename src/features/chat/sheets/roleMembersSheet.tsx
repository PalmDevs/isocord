import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { Endpoint } from '../../../core/api/paths'
import { useSession, useSessionStore } from '../../../core/react'
import { ActivityIndicator } from '../../../design/components/ActivityIndicator'
import {
    ActionSheet,
    ActionSheetRowGroup,
} from '../../../design/components/sheets/Sheet'
import { openActionSheet } from '../../../design/components/sheets/sheetStore'
import { Text } from '../../../design/components/Text'
import { t } from '../../../i18n'
import { guildsStore } from '../../../stores/guilds'
import {
    memberListId,
    memberListStore,
    OFFLINE_GROUP,
    ONLINE_GROUP,
    subscribeMemberList,
} from '../../../stores/memberList'
import { membersStore, requestMembers } from '../../../stores/members'
import { displayName, usersStore } from '../../../stores/users'
import { MemberRow } from '../../search/members/MemberRow'
import { hexColor } from '../color'
import type { Session } from '../../../core/session'

interface RoleMembersProps {
    guildId: string
    roleId: string
    /** The chat the mention was tapped in: @everyone lists that channel's member list. */
    channelId?: string
}

/**
 * A tapped role mention (RoleMembersActionSheet): the members of the role. Like the reference, a role we do not
 * know opens nothing (its mention has no role id there, only a developer-mode alert).
 */
export function openRoleMembers(
    session: Session,
    { guildId, roleId, channelId }: RoleMembersProps,
): void {
    if (!session.get(guildsStore).getState().guilds[guildId]?.roles[roleId])
        return
    openActionSheet(
        'role-members',
        <RoleMembersSheet
            guildId={guildId}
            roleId={roleId}
            channelId={channelId}
        />,
        { stackingBehavior: 'stack' },
    )
}

function RoleMembersSheet({ guildId, roleId, channelId }: RoleMembersProps) {
    const session = useSession()
    const guild = useSessionStore(guildsStore, state => state.guilds[guildId])
    const role = guild?.roles[roleId]
    const everyone = roleId === guildId
    const color = role?.colors?.primary_color || role?.color

    return (
        <ActionSheet
            scrollable
            header={
                <View style={styles.header}>
                    {color ? (
                        <View
                            style={[
                                styles.dot,
                                { backgroundColor: hexColor(color) },
                            ]}
                        />
                    ) : null}
                    <Text
                        variant="text-sm/semibold"
                        color="MOBILE_TEXT_HEADING_PRIMARY"
                        lineClamp={1}
                        style={styles.headerText}
                    >
                        {role?.name ?? ''}
                    </Text>
                </View>
            }
        >
            {everyone ? (
                <ChannelMembers
                    session={session}
                    guildId={guildId}
                    channelId={channelId}
                />
            ) : (
                <RoleMembers guildId={guildId} roleId={roleId} />
            )}
        </ActionSheet>
    )
}

/**
 * The members of a role: the ones in the member store with the role, by name. The ids come from
 * GET /guilds/{id}/roles/{role}/member-ids and the members we do not have yet are requested from the gateway
 * (REQUEST_GUILD_MEMBERS with user_ids), so rows appear as GUILD_MEMBERS_CHUNK answers.
 */
function RoleMembers({ guildId, roleId }: { guildId: string; roleId: string }) {
    const session = useSession()
    const guild = useSessionStore(guildsStore, state => state.guilds[guildId])
    const members = useSessionStore(
        membersStore,
        state => state.members[guildId],
    )
    const users = useSessionStore(usersStore, state => state.users)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
        session.rest
            .get<string[]>(Endpoint.roleMemberIds(guildId, roleId))
            .then(ids => requestMembers(session, guildId, ids))
            .catch(() => {})
            .finally(() => {
                if (!cancelled) setLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [session, guildId, roleId])

    const ids = (() => {
        const name = (id: string) => {
            const user = users[id]
            return members?.[id]?.nick ?? (user ? displayName(user) : '')
        }
        return Object.keys(members ?? {})
            .filter(id => members?.[id]?.roles.includes(roleId) && users[id])
            .sort((a, b) => name(a).localeCompare(name(b)))
    })()

    if (ids.length === 0 && loading) return <ActivityIndicator />
    return (
        <ActionSheetRowGroup hasIcons>
            {ids.map(id => (
                <MemberRow
                    key={id}
                    userId={id}
                    guildId={guildId}
                    ownerId={guild?.ownerId}
                />
            ))}
        </ActionSheetRowGroup>
    )
}

/** @everyone: the channel's member list as far as it is loaded, in its Online / Offline / role sections. */
function ChannelMembers({
    session,
    guildId,
    channelId,
}: {
    session: Session
    guildId: string
    channelId?: string
}) {
    const guild = useSessionStore(guildsStore, state => state.guilds[guildId])
    const listId = channelId ? memberListId(session, channelId) : undefined
    const list = useSessionStore(memberListStore, state =>
        listId ? state.lists[`${guildId}:${listId}`] : undefined,
    )
    useEffect(() => {
        if (channelId) subscribeMemberList(session, guildId, channelId)
    }, [session, guildId, channelId])

    const sections = (() => {
        const result: Array<{ id: string; count: number; ids: string[] }> = []
        for (const row of list?.rows ?? []) {
            if (row?.type === 'group')
                result.push({
                    id: row.id,
                    count:
                        list?.groups.find(group => group.id === row.id)
                            ?.count ?? 0,
                    ids: [],
                })
            else if (row) result.at(-1)?.ids.push(row.userId)
        }
        return result.filter(section => section.ids.length > 0)
    })()

    if (sections.length === 0) return <ActivityIndicator />
    return (
        <>
            {sections.map(section => (
                <ActionSheetRowGroup
                    key={section.id}
                    hasIcons
                    title={`${
                        section.id === ONLINE_GROUP
                            ? t('members.online')
                            : section.id === OFFLINE_GROUP
                              ? t('members.offline')
                              : (guild?.roles[section.id]?.name ?? '')
                    } — ${section.count}`}
                >
                    {section.ids.map(id => (
                        <MemberRow
                            key={id}
                            userId={id}
                            guildId={guildId}
                            ownerId={guild?.ownerId}
                            offline={section.id === OFFLINE_GROUP}
                        />
                    ))}
                </ActionSheetRowGroup>
            ))}
        </>
    )
}

const styles = StyleSheet.create(theme => ({
    // RoleMembersActionSheet's header: dot and name in a row, 12 above, 4 below, 16 at the sides.
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.PX_4,
        paddingTop: theme.space.PX_12,
        paddingBottom: theme.space.PX_4,
        paddingHorizontal: theme.space.PX_16,
    },
    headerText: { flex: 1 },
    dot: { width: 12, height: 12, borderRadius: 6 },
}))
