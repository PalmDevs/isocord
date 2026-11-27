import { ChannelType } from './channelType'

/** Permission overwrite types (docs.discord.food, Channel Permission Overwrite). */
export const OverwriteType = {
    ROLE: 0,
    MEMBER: 1,
} as const

export interface PermissionOverwrite {
    id: string
    /** An `OverwriteType`. */
    type: number
    allow: string
    deny: string
}

/** The guild fields permissions come from. The `guildsStore` guild has them. */
interface Guild {
    id: string
    ownerId: string
    roles: Record<string, { permissions: string }>
    /** Role ids of the user, without @everyone. */
    myRoles: string[]
}

/** The channel fields permissions come from. The `channelsStore` channel has them. */
interface Channel {
    type: number
    permission_overwrites?: PermissionOverwrite[]
    thread_metadata?: { locked?: boolean }
}

export const Permission = {
    CREATE_INSTANT_INVITE: 1n << 0n,
    KICK_MEMBERS: 1n << 1n,
    BAN_MEMBERS: 1n << 2n,
    ADMINISTRATOR: 1n << 3n,
    MANAGE_CHANNELS: 1n << 4n,
    MANAGE_GUILD: 1n << 5n,
    ADD_REACTIONS: 1n << 6n,
    VIEW_AUDIT_LOG: 1n << 7n,
    VIEW_CHANNEL: 1n << 10n,
    SEND_MESSAGES: 1n << 11n,
    MANAGE_MESSAGES: 1n << 13n,
    EMBED_LINKS: 1n << 14n,
    ATTACH_FILES: 1n << 15n,
    READ_MESSAGE_HISTORY: 1n << 16n,
    MENTION_EVERYONE: 1n << 17n,
    USE_EXTERNAL_EMOJIS: 1n << 18n,
    VIEW_GUILD_ANALYTICS: 1n << 19n,
    CHANGE_NICKNAME: 1n << 26n,
    MANAGE_NICKNAMES: 1n << 27n,
    MANAGE_ROLES: 1n << 28n,
    MANAGE_WEBHOOKS: 1n << 29n,
    MANAGE_GUILD_EXPRESSIONS: 1n << 30n,
    MODERATE_MEMBERS: 1n << 40n,
    MANAGE_EVENTS: 1n << 33n,
    MANAGE_THREADS: 1n << 34n,
    CREATE_PUBLIC_THREADS: 1n << 35n,
    CREATE_PRIVATE_THREADS: 1n << 36n,
    USE_EXTERNAL_STICKERS: 1n << 37n,
    SEND_MESSAGES_IN_THREADS: 1n << 38n,
    CREATE_GUILD_EXPRESSIONS: 1n << 43n,
    CREATE_EVENTS: 1n << 44n,
    SEND_VOICE_MESSAGES: 1n << 46n,
    PIN_MESSAGES: 1n << 51n,
    BYPASS_SLOWMODE: 1n << 52n,
} as const

/** PermissionUtils.VIEW_GUILD_SETTINGS: any permission that exposes Server Settings. */
export const VIEW_GUILD_SETTINGS =
    Permission.MANAGE_GUILD |
    Permission.MANAGE_ROLES |
    Permission.ADMINISTRATOR |
    Permission.BAN_MEMBERS |
    Permission.MANAGE_NICKNAMES |
    Permission.CREATE_GUILD_EXPRESSIONS |
    Permission.MANAGE_GUILD_EXPRESSIONS |
    Permission.MANAGE_WEBHOOKS |
    Permission.VIEW_AUDIT_LOG |
    Permission.VIEW_GUILD_ANALYTICS

const ALL = ~0n

/** Cache key for a call without a channel. */
const NO_CHANNEL = {}

/**
 * Computed permissions by guild, user and channel object. Stores replace a guild or channel object when it
 * changes, so identity is the invalidation (PermissionStore caches per channel and clears on guild, role and
 * own member updates).
 */
const cache = new WeakMap<Guild, Map<string, WeakMap<object, bigint>>>()

/** The current user's permissions in a guild channel (or in its parent, for a thread's caller to pass). */
export function computePermissions(
    guild: Guild,
    channel: Channel | undefined,
    userId: string,
): bigint {
    let byUser = cache.get(guild)
    if (!byUser) cache.set(guild, (byUser = new Map()))
    let byChannel = byUser.get(userId)
    if (!byChannel) byUser.set(userId, (byChannel = new WeakMap()))
    const key = channel ?? NO_CHANNEL
    let permissions = byChannel.get(key)
    if (permissions === undefined)
        byChannel.set(key, (permissions = compute(guild, channel, userId)))
    return permissions
}

function compute(
    guild: Guild,
    channel: Channel | undefined,
    userId: string,
): bigint {
    if (guild.ownerId === userId) return ALL
    let permissions = BigInt(guild.roles[guild.id]?.permissions ?? 0)
    for (const roleId of guild.myRoles)
        permissions |= BigInt(guild.roles[roleId]?.permissions ?? 0)
    if (permissions & Permission.ADMINISTRATOR) return ALL

    const overwrites = channel?.permission_overwrites
    if (!overwrites?.length) return permissions
    let allow = 0n
    let deny = 0n
    let member: { allow: string; deny: string } | undefined
    for (const overwrite of overwrites) {
        if (overwrite.id === guild.id) {
            // @everyone is applied first, before the union of the role overwrites.
            permissions =
                (permissions & ~BigInt(overwrite.deny)) |
                BigInt(overwrite.allow)
        } else if (overwrite.id === userId) {
            member = overwrite
        } else if (guild.myRoles.includes(overwrite.id)) {
            allow |= BigInt(overwrite.allow)
            deny |= BigInt(overwrite.deny)
        }
    }
    permissions = (permissions & ~deny) | allow
    if (member)
        permissions =
            (permissions & ~BigInt(member.deny)) | BigInt(member.allow)
    return permissions
}

/** PermissionUtils.canEveryone: the @everyone role holds `permission` and no overwrite denies it. */
export function canEveryone(
    guild: Guild,
    channel: Channel,
    permission: bigint,
): boolean {
    return (
        (BigInt(guild.roles[guild.id]?.permissions ?? 0) & permission) !== 0n &&
        !channel.permission_overwrites?.some(
            overwrite => BigInt(overwrite.deny) & permission,
        )
    )
}

/** Whether another member, with these roles, may see a channel (the reference's PermissionUtils.can with `user`). */
export function memberCanView(
    guild: Guild,
    channel: Channel | undefined,
    userId: string,
    roleIds: string[],
): boolean {
    return (
        (compute({ ...guild, myRoles: roleIds }, channel, userId) &
            Permission.VIEW_CHANNEL) !==
        0n
    )
}

/**
 * Whether the user may send messages in a channel, given their `channelPermissions` there. A thread needs
 * SEND_MESSAGES_IN_THREADS, and a locked thread only allows moderators.
 */
export function canSendMessages(
    channel: Channel | undefined,
    permissions: bigint,
): boolean {
    if (!(permissions & Permission.VIEW_CHANNEL)) return false
    if (channel?.thread_metadata !== undefined) {
        if (
            channel.thread_metadata.locked &&
            !(permissions & Permission.MANAGE_THREADS)
        )
            return false
        return (permissions & Permission.SEND_MESSAGES_IN_THREADS) !== 0n
    }
    return (permissions & Permission.SEND_MESSAGES) !== 0n
}

/**
 * ThreadHooks.useCanStartPublicThread for a channel (no message). A thread starts in ChannelRecord's
 * THREADED_CHANNEL_TYPES (GUILD_APP aside, which isocord does not have). A forum or media channel needs SEND_MESSAGES,
 * any other CREATE_PUBLIC_THREADS and READ_MESSAGE_HISTORY.
 */
export function canStartPublicThread(
    channel: Channel,
    permissions: bigint,
): boolean {
    const forumLike =
        channel.type === ChannelType.GUILD_FORUM ||
        channel.type === ChannelType.GUILD_MEDIA
    if (
        !forumLike &&
        channel.type !== ChannelType.GUILD_TEXT &&
        channel.type !== ChannelType.GUILD_ANNOUNCEMENT
    )
        return false
    const needed = forumLike
        ? Permission.SEND_MESSAGES
        : Permission.CREATE_PUBLIC_THREADS | Permission.READ_MESSAGE_HISTORY
    return (permissions & needed) === needed
}

/** ThreadHooks.useCanStartPrivateThread: a text channel with CREATE_PRIVATE_THREADS. */
export function canStartPrivateThread(
    channel: Channel,
    permissions: bigint,
): boolean {
    return (
        channel.type === ChannelType.GUILD_TEXT &&
        (permissions & Permission.CREATE_PRIVATE_THREADS) !== 0n
    )
}

/** ThreadHooks.useCanStartThread for a channel (no message): a public or a private thread. */
export function canStartThread(channel: Channel, permissions: bigint): boolean {
    return (
        canStartPublicThread(channel, permissions) ||
        canStartPrivateThread(channel, permissions)
    )
}
