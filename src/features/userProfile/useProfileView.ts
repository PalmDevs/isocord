import { bannerUrl } from '../../core/discord/cdn'
import { useSessionStore } from '../../core/react'
import { membersStore } from '../../stores/members'
import { useUserProfile } from '../../stores/userProfiles'
import { displayName, usersStore } from '../../stores/users'
import { authorAvatarUrl } from '../chat/author'
import type { UserProfile } from '../../stores/userProfiles'
import type { User } from '../../stores/users'

export interface ProfileView {
    user: User
    /** The profile fetched, undefined while loading. */
    profile: UserProfile | undefined
    /** The server whose profile is shown, undefined for the main profile. */
    guildId: string | undefined
    name: string
    pronouns: string | null | undefined
    bio: string | null | undefined
    themeColors: [number, number] | undefined
    /** The server avatar hash in the server context. */
    guildAvatar: string | null | undefined
    avatarUrl: (size: number) => string
    bannerUrl: (size: number) => string | undefined
}

/**
 * Merges the global profile with the server's overrides when `guildId` is set (UserProfileStore.getGuildMemberProfile
 * over the user profile). Known users and members show at once, the fetched profile fills in the rest.
 */
export function useProfileView(
    userId: string,
    guildId: string | undefined,
): ProfileView | undefined {
    const profile = useUserProfile(userId, guildId)
    const known = useSessionStore(usersStore, state => state.users[userId])
    const member = useSessionStore(membersStore, state =>
        guildId ? state.members[guildId]?.[userId] : undefined,
    )
    const user = profile?.user ?? known
    if (!user) return undefined
    const guildMember = guildId ? (profile?.guild_member ?? member) : undefined
    const main = profile?.user_profile
    const server = guildId ? profile?.guild_member_profile : undefined

    const guildAvatar = guildMember?.avatar
    const serverBanner = server?.banner
    const mainBanner = main?.banner ?? profile?.user.banner
    return {
        user,
        profile,
        guildId,
        name: displayName(user, guildMember?.nick),
        // DisplayProfile.isUsingGuildMemberBio: an empty server value means none.
        pronouns: server?.pronouns || main?.pronouns,
        bio: server?.bio || main?.bio || profile?.user.bio,
        themeColors: server?.theme_colors ?? main?.theme_colors,
        guildAvatar,
        avatarUrl: size => authorAvatarUrl(user, guildMember, guildId, size),
        bannerUrl: size =>
            serverBanner && guildId
                ? bannerUrl(userId, serverBanner, size, guildId)
                : mainBanner
                  ? bannerUrl(userId, mainBanner, size)
                  : undefined,
    }
}
