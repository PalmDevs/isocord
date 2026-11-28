import { createStore } from 'zustand/vanilla'
import { logger } from '../core/log'
import { defineStore } from '../core/session'

const log = logger('Guilds')

export interface Role {
    id: string
    name?: string
    /** Permission bitfield as a decimal string. */
    permissions: string
    /** RGB integer; 0 means the role has no colour. */
    color?: number
    /** Enhanced role colours: gradient when there is a secondary colour, holographic when there is a tertiary one. */
    colors?: {
        primary_color: number
        secondary_color?: number | null
        tertiary_color?: number | null
    }
    position?: number
    /** Shown as a group of its own in the member list. */
    hoist?: boolean
    /** Anyone may mention it, not only those allowed to mention everyone. */
    mentionable?: boolean
    /** Server-side version of the role, newer on every change. */
    version?: number
    /** Custom role icon hash. */
    icon?: string | null
    unicode_emoji?: string | null
}

export interface Guild {
    id: string
    name: string
    icon: string | null
    banner: string | null
    ownerId: string
    memberCount: number
    joinedAt: string
    roles: Record<string, Role>
    /** Role ids of the current user, without @everyone. */
    myRoles: string[]
    /** GuildMemberFlags of the current user. */
    myMemberFlags?: number
    /** The ENHANCED_ROLE_COLORS feature: role gradients are only drawn in guilds that have it. */
    enhancedRoleColors?: boolean
    /** Guild features, e.g. MAX_FILE_SIZE_50_MB (upload limits). */
    features?: string[]
    /** Server boost tier (0-3, `premium_tier`; Go Live qualities need a level) and count. */
    premiumTier?: number
    /** The level that applies where the user's own guild setting is unset: 0 all messages, 1 only mentions. */
    defaultMessageNotifications?: number
    /** The rules channel, which cannot become an announcement channel. */
    rulesChannelId?: string | null
    /** The community updates channel, which cannot become an announcement channel. */
    publicUpdatesChannelId?: string | null
    /** Server description from READY/GUILD_UPDATE. */
    description?: string | null
    premiumSubscriberCount?: number
    /** Vanity invite code when the server has one. */
    vanityUrlCode?: string | null
    /** Server tag profile, when the server has GUILD_TAGS. */
    profile?: { tag?: string | null; badge?: string | null } | null
    /** Most users in a voice channel while someone has video on. */
    maxVideoChannelUsers?: number
    /** Most users in a stage channel while someone has video or a stream on. */
    maxStageVideoChannelUsers?: number
    /**
     * Newest version of the guild and its roles held here, 0 when the server gave none. Kept with the
     * data it describes so the next IDENTIFY can ask for what changed since. The channels' version is
     * in the channels store; the lower of the two is what gets sent.
     */
    version: number
    /**
     * A partial sync could not tell which channels and roles were deleted, and the answer
     * (DELETED_ENTITY_IDS) has not arrived. Until it does, this guild's data may hold deleted
     * entities, so its version is not sent.
     */
    pendingDeleteSync?: boolean
}

/**
 * How much of a guild the server sent: everything (`full`, also when unset), only what changed
 * since the version in IDENTIFY's `client_state` (`partial`), or nothing because the guild is
 * unavailable (`unavailable`).
 */
export type DataMode = 'full' | 'partial' | 'unavailable'

export const dataModeOf = (raw: RawGuild): DataMode =>
    raw.data_mode === 'partial'
        ? 'partial'
        : raw.data_mode === 'unavailable' || raw.unavailable
          ? 'unavailable'
          : 'full'

/** What changed in a partial guild: entities newer than the client's version, and ids it knows were deleted. */
export interface PartialUpdates {
    roles?: Role[]
    deleted_role_ids?: string[]
}

interface RawGuildProperties {
    name: string
    icon: string | null
    banner?: string | null
    description?: string | null
    features?: string[]
    owner_id: string
    rules_channel_id?: string | null
    public_updates_channel_id?: string | null
    default_message_notifications?: number
    premium_tier?: number
    premium_subscription_count?: number
    vanity_url_code?: string | null
    profile?: { tag?: string | null; badge?: string | null } | null
    max_video_channel_users?: number
    max_stage_video_channel_users?: number
}

/** Guilds arrive with their fields under `properties` in READY and GUILD_CREATE, and flat in GUILD_UPDATE. */
export interface RawGuild extends Partial<RawGuildProperties> {
    id: string
    unavailable?: boolean
    properties?: RawGuildProperties
    roles?: Role[]
    member_count?: number
    joined_at?: string
    version?: number
    data_mode?: DataMode
    partial_updates?: PartialUpdates
    /** Partial guilds only: the server could not work out deletions, see `Guild.pendingDeleteSync`. */
    unable_to_sync_deletes?: boolean
    /** Partial guilds only: newer `last_message_id` of channels that are not otherwise sent. */
    channel_updates?: Array<{ id: string; last_message_id?: string | null }>
    members?: Array<{
        user?: { id: string }
        user_id?: string
        roles: string[]
        flags?: number
    }>
}

interface RawMember {
    user_id?: string
    user?: { id: string }
    roles: string[]
    flags?: number
}

declare module '../core/gateway/events' {
    interface ReadyPayload {
        guilds?: RawGuild[]
        /** The current user's member object for each guild, in the same order as `guilds`. */
        merged_members?: RawMember[][]
    }
    interface GatewayEvents {
        GUILD_CREATE: RawGuild
        GUILD_UPDATE: RawGuild
        GUILD_DELETE: { id: string; unavailable?: boolean }
        GUILD_ROLE_CREATE: { guild_id: string; role: Role }
        GUILD_ROLE_UPDATE: { guild_id: string; role: Role }
        GUILD_ROLE_DELETE: {
            guild_id: string
            role_id: string
            version?: number
        }
        /** The ids that still exist, for each kind the client's hash did not match; see `requestDeletedIds`. */
        DELETED_ENTITY_IDS: {
            guild_id: string
            roles?: string[]
            channels?: string[]
            emojis?: string[]
            stickers?: string[]
        }
    }
}

export const guildsStore = defineStore(
    'guilds',
    session => {
        const store = createStore<{ guilds: Record<string, Guild> }>(() => ({
            guilds: {},
        }))
        const { dispatch } = session.gateway

        const isSelf = (member: RawMember) =>
            (member.user_id ?? member.user?.id) === session.userId

        const newest = (version: number, items: Array<{ version?: number }>) =>
            items.reduce(
                (max, item) => Math.max(max, item.version ?? 0),
                version,
            )
        /** A version only moves on top of data that already has one; otherwise it stays unknown. */
        const bump = (guild: Guild, version: number | undefined): number =>
            guild.version > 0 ? Math.max(guild.version, version ?? 0) : 0

        /**
         * `sync` is READY and GUILD_CREATE, where `raw` replaces the guild (full) or is merged onto it
         * (partial); otherwise `raw` is a GUILD_UPDATE, a change on top of what is held.
         */
        const parse = (
            raw: RawGuild,
            members: RawMember[] | undefined,
            previous: Guild | undefined,
            sync: boolean,
        ): Guild | null => {
            const mode = dataModeOf(raw)
            if (mode === 'unavailable') return previous ?? null
            const properties =
                raw.properties ??
                (raw.name !== undefined
                    ? (raw as RawGuildProperties)
                    : undefined)
            if (mode === 'partial') {
                // Partial data only makes sense on top of the guild it was cut against.
                if (!previous) {
                    log.warn('Partial guild without a cached one')
                    return null
                }
            } else if (!properties) return previous ?? null

            const roleChanges =
                mode === 'partial' ? raw.partial_updates?.roles : raw.roles
            let roles: Record<string, Role>
            if (mode === 'partial') {
                roles = { ...previous?.roles }
                for (const id of raw.partial_updates?.deleted_role_ids ?? [])
                    delete roles[id]
                for (const role of roleChanges ?? []) roles[role.id] = role
            } else {
                roles = roleChanges
                    ? Object.fromEntries(
                          roleChanges.map(role => [role.id, role]),
                      )
                    : (previous?.roles ?? {})
            }

            let version: number
            if (sync && mode === 'full')
                // Fresh from the server: only claim what this payload carries.
                version = raw.roles ? newest(raw.version ?? 0, raw.roles) : 0
            else if (previous && previous.version > 0)
                version = newest(
                    Math.max(previous.version, raw.version ?? 0),
                    roleChanges ?? [],
                )
            else version = 0

            return {
                id: raw.id,
                name: properties?.name ?? previous?.name ?? '',
                icon: properties ? properties.icon : (previous?.icon ?? null),
                banner: properties
                    ? (properties.banner ?? null)
                    : (previous?.banner ?? null),
                ownerId: properties?.owner_id ?? previous?.ownerId ?? '',
                memberCount: raw.member_count ?? previous?.memberCount ?? 0,
                joinedAt:
                    raw.joined_at ??
                    previous?.joinedAt ??
                    new Date().toISOString(),
                roles,
                myRoles:
                    members?.find(isSelf)?.roles ?? previous?.myRoles ?? [],
                myMemberFlags:
                    members?.find(isSelf)?.flags ?? previous?.myMemberFlags,
                enhancedRoleColors:
                    properties?.features?.includes('ENHANCED_ROLE_COLORS') ??
                    previous?.enhancedRoleColors,
                features: properties?.features ?? previous?.features,
                defaultMessageNotifications:
                    properties?.default_message_notifications ??
                    previous?.defaultMessageNotifications,
                // null clears the channel. Absent properties keep the held one.
                rulesChannelId: properties
                    ? (properties.rules_channel_id ?? null)
                    : previous?.rulesChannelId,
                publicUpdatesChannelId: properties
                    ? (properties.public_updates_channel_id ?? null)
                    : previous?.publicUpdatesChannelId,
                description: properties
                    ? (properties.description ?? null)
                    : previous?.description,
                premiumTier: properties?.premium_tier ?? previous?.premiumTier,
                premiumSubscriberCount:
                    properties?.premium_subscription_count ??
                    previous?.premiumSubscriberCount,
                vanityUrlCode: properties
                    ? (properties.vanity_url_code ?? null)
                    : previous?.vanityUrlCode,
                profile: properties
                    ? (properties.profile ?? null)
                    : previous?.profile,
                maxVideoChannelUsers:
                    properties?.max_video_channel_users ??
                    previous?.maxVideoChannelUsers,
                maxStageVideoChannelUsers:
                    properties?.max_stage_video_channel_users ??
                    previous?.maxStageVideoChannelUsers,
                version,
                pendingDeleteSync:
                    sync && mode === 'full'
                        ? undefined
                        : mode === 'partial' && raw.unable_to_sync_deletes
                          ? true
                          : previous?.pendingDeleteSync,
            }
        }

        const update = (guildId: string, change: (guild: Guild) => Guild) =>
            store.setState(state => {
                const guild = state.guilds[guildId]
                return guild
                    ? { guilds: { ...state.guilds, [guildId]: change(guild) } }
                    : state
            })

        dispatch.on('READY', ready => {
            const guilds: Record<string, Guild> = {}
            const previous = store.getState().guilds
            ready.guilds?.forEach((raw, index) => {
                // An outage leaves a guild without data until GUILD_CREATE; keep what the cache knew.
                const guild = parse(
                    raw,
                    ready.merged_members?.[index],
                    previous[raw.id],
                    true,
                )
                if (guild) guilds[guild.id] = guild
            })
            store.setState({ guilds })
        })
        const upsert = (raw: RawGuild, sync: boolean) => {
            const guild = parse(
                raw,
                raw.members,
                store.getState().guilds[raw.id],
                sync,
            )
            if (guild)
                store.setState(state => ({
                    guilds: { ...state.guilds, [guild.id]: guild },
                }))
        }
        dispatch.on('GUILD_CREATE', raw => upsert(raw, true))
        dispatch.on('GUILD_UPDATE', raw => upsert(raw, false))
        dispatch.on('GUILD_DELETE', ({ id }) =>
            store.setState(state => {
                const { [id]: _removed, ...guilds } = state.guilds
                return { guilds }
            }),
        )
        const setRole = ({
            guild_id,
            role,
        }: {
            guild_id: string
            role: Role
        }) =>
            update(guild_id, guild => ({
                ...guild,
                roles: { ...guild.roles, [role.id]: role },
                version: bump(guild, role.version),
            }))
        dispatch.on('GUILD_ROLE_CREATE', setRole)
        dispatch.on('GUILD_ROLE_UPDATE', setRole)
        dispatch.on('GUILD_ROLE_DELETE', ({ guild_id, role_id, version }) =>
            update(guild_id, guild => {
                const { [role_id]: _removed, ...roles } = guild.roles
                return { ...guild, roles, version: bump(guild, version) }
            }),
        )
        // The answer to requestDeletedIds: whatever role is not listed is gone.
        dispatch.on('DELETED_ENTITY_IDS', ({ guild_id, roles: existing }) =>
            update(guild_id, guild => {
                const { pendingDeleteSync: _done, ...rest } = guild
                if (!existing) return rest
                const keep = new Set(existing)
                return {
                    ...rest,
                    // @everyone has the guild's id and cannot be deleted.
                    roles: Object.fromEntries(
                        Object.entries(guild.roles).filter(
                            ([id]) => keep.has(id) || id === guild_id,
                        ),
                    ),
                }
            }),
        )
        dispatch.on('GUILD_MEMBER_UPDATE', member => {
            if (member.user.id === session.userId)
                update(member.guild_id, guild => ({
                    ...guild,
                    myRoles: member.roles,
                    myMemberFlags: member.flags,
                }))
        })

        return store
    },
    // 1: rules and public updates channel ids. 2: premium tier. 3: video channel limits.
    { cache: ['guilds'], cacheVersion: 3 },
)
