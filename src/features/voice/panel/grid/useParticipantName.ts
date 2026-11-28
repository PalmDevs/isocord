import { useSessionStore } from '../../../../core/react'
import { membersStore } from '../../../../stores/members'
import { displayName, usersStore } from '../../../../stores/users'

/** A user's name in the call's guild: their nickname there, else their display name. A DM call has no guild. */
export function useParticipantName(
    userId: string,
    guildId: string | null,
): string {
    const user = useSessionStore(usersStore, state => state.users[userId])
    const nick = useSessionStore(membersStore, state =>
        guildId ? state.members[guildId]?.[userId]?.nick : undefined,
    )
    return displayName(user, nick)
}
