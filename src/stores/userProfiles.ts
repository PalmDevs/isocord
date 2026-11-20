import { createStore } from 'zustand/vanilla'
import { Endpoint } from '../core/api/paths'
import { logger } from '../core/log'
import { useSessionStore } from '../core/react'
import { defineStore } from '../core/session'
import { usersStore } from './users'
import type { Session } from '../core/session'
import type { Member } from './members'
import type { User } from './users'

const log = logger('UserProfiles')

export interface ProfileBadge {
    id: string
    description: string
    icon: string
    link?: string
}

export interface ConnectedAccount {
    type: string
    id: string
    name: string
    verified: boolean
    metadata?: Record<string, unknown>
}

export interface MutualGuild {
    id: string
    nick: string | null
}

/** A profile's customization, global or per guild. */
export interface ProfileFields {
    bio?: string | null
    pronouns?: string | null
    banner?: string | null
    accent_color?: number | null
    /** Gradient colors of the profile card. */
    theme_colors?: [number, number]
    profile_effect?: { id: string; expires_at?: string | null } | null
}

export interface UserProfile {
    user: User & {
        bio?: string | null
        banner?: string | null
        accent_color?: number | null
    }
    user_profile?: ProfileFields | null
    guild_member_profile?: (ProfileFields & { guild_id?: string }) | null
    guild_member?: Member & { user?: User; joined_at?: string }
    badges?: ProfileBadge[]
    guild_badges?: ProfileBadge[]
    connected_accounts?: ConnectedAccount[]
    mutual_guilds?: MutualGuild[]
    mutual_friends?: User[]
    premium_type?: number | null
    premium_since?: string | null
}

interface UserProfilesState {
    /** By `userId`, or `userId:guildId` for a profile fetched in a guild. */
    profiles: Record<string, UserProfile>
}

const PROFILE_KEY_SEPARATOR = ':'

const profileKey = (userId: string, guildId?: string) =>
    guildId ? `${userId}${PROFILE_KEY_SEPARATOR}${guildId}` : userId

/** The most recently opened profiles kept in the cache. */
const MAX_CACHED_PROFILES = 50

/**
 * Profiles opened, most recent last. The latest ones are cached, so a profile draws at once on the next launch.
 * Opening one fetches it again, which refreshes its mutual guilds and friends.
 */
export const userProfilesStore = defineStore(
    'userProfiles',
    session => {
        const store = createStore<UserProfilesState>(() => ({ profiles: {} }))
        // UserProfileStore.handleUserUpdate resets the fetch. Refetching keeps an open profile current.
        session.gateway.dispatch.on('USER_UPDATE', user => {
            for (const key of Object.keys(store.getState().profiles)) {
                const [userId, guildId] = key.split(PROFILE_KEY_SEPARATOR)
                // fetchUserProfile logs its own failure.
                if (userId === user.id)
                    fetchUserProfile(session, userId, guildId).catch(() => {})
            }
        })
        return store
    },
    {
        cache: state => ({
            profiles: Object.fromEntries(
                Object.entries(state.profiles).slice(-MAX_CACHED_PROFILES),
            ),
        }),
    },
)

/** UserProfileActionCreators.fetchProfile. Logs and rethrows a failure. */
export async function fetchUserProfile(
    session: Session,
    userId: string,
    guildId?: string,
): Promise<void> {
    try {
        const profile = await session.rest.get<UserProfile>(
            Endpoint.userProfile(userId),
            {
                query: {
                    with_mutual_guilds: true,
                    with_mutual_friends: true,
                    guild_id: guildId,
                },
            },
        )
        session
            .get(usersStore)
            .getState()
            .upsert([profile.user, ...(profile.mutual_friends ?? [])])
        const key = profileKey(userId, guildId)
        session.get(userProfilesStore).setState(state => {
            // Re-added last, so the cache keeps the most recently opened.
            const { [key]: _previous, ...rest } = state.profiles
            return { profiles: { ...rest, [key]: profile } }
        })
    } catch (error) {
        log.warn('Fetching a profile failed', error)
        throw error
    }
}

/** Returns the profile fetched for a user, in a guild when `guildId` is given. */
export const useUserProfile = (
    userId: string,
    guildId?: string,
): UserProfile | undefined =>
    useSessionStore(
        userProfilesStore,
        state => state.profiles[profileKey(userId, guildId)],
    )
