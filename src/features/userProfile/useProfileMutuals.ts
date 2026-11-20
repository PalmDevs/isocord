import { useSessionStore } from '../../core/react'
import { settingsStore } from '../../stores/settings/settingsStore'
import { useUserProfile } from '../../stores/userProfiles'
import { displayName } from '../../stores/users'
import type { MutualGuild } from '../../stores/userProfiles'
import type { User } from '../../stores/users'

/**
 * useUserProfileMutuals: the profile's mutual friends and servers in a fixed order, since the API sends them in
 * any order. Servers follow the server list, those missing from it last. Friends go by name. The reference sorts
 * them by affinity, which isn't kept here.
 */
export function useProfileMutuals(
    userId: string,
    guildId: string | undefined,
): { friends: User[]; guilds: MutualGuild[] } {
    const profile = useUserProfile(userId, guildId)
    const folders = useSessionStore(settingsStore, state => state.folders)
    const order = folders.flatMap(folder => folder.guildIds)
    const position = (id: string) => {
        const index = order.indexOf(id)
        return index === -1 ? order.length : index
    }
    const friends = [...(profile?.mutual_friends ?? [])].sort((a, b) =>
        displayName(a).localeCompare(displayName(b)),
    )
    const guilds = [...(profile?.mutual_guilds ?? [])].sort(
        (a, b) => position(a.id) - position(b.id),
    )
    return { friends, guilds }
}
