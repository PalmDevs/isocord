import { ChannelType } from '../core/discord/channelType'
import { computePermissions, Permission } from '../core/discord/permissions'
import { useSession, useSessionStore } from '../core/react'
import { channelsStore, isThread } from './channels/channels'
import { guildsStore } from './guilds'
import type { Session } from '../core/session'
import type { Channel } from './channels/channels'
import type { Guild } from './guilds'

/**
 * What a DM allows: everything but moderation and mentioning everyone (PermissionStore.can on a private channel).
 * Also used for a channel or guild that is not loaded.
 */
const DM_PERMISSIONS = ~(
    Permission.MANAGE_MESSAGES |
    Permission.MANAGE_THREADS |
    Permission.MENTION_EVERYONE
)

function resolve(
    guild: Guild | undefined,
    channel: Channel | undefined,
    parent: Channel | undefined,
    userId: string,
): bigint {
    if (!guild || !channel) return DM_PERMISSIONS
    // A thread has no overwrites of its own: its parent's apply (PermissionUtils.computePermissions).
    const source =
        channel.thread_metadata !== undefined ? (parent ?? channel) : channel
    return computePermissions(guild, source, userId)
}

/** Returns the user's permission bits in a channel. A thread uses its parent's overwrites. */
export function channelPermissions(
    session: Session,
    channelId: string,
): bigint {
    const { channels } = session.get(channelsStore).getState()
    const channel = channels[channelId]
    const guild = channel?.guild_id
        ? session.get(guildsStore).getState().guilds[channel.guild_id]
        : undefined
    const parent = channel?.parent_id ? channels[channel.parent_id] : undefined
    return resolve(guild, channel, parent, session.userId)
}

/** Returns whether the user holds every bit of `permission` in a channel. */
export function can(
    session: Session,
    channelId: string,
    permission: bigint,
): boolean {
    return (channelPermissions(session, channelId) & permission) === permission
}

/** Returns whether the user can view `channel`. */
export function canViewChannel(session: Session, channel: Channel): boolean {
    if (!channel.guild_id) return true
    const guild = session.get(guildsStore).getState().guilds[channel.guild_id]
    if (!guild) return false
    const thread = isThread(channel) || channel.thread_metadata !== undefined
    const source = thread
        ? channel.parent_id
            ? session.get(channelsStore).getState().channels[channel.parent_id]
            : undefined
        : channel
    if (!source) return false
    const permissions = computePermissions(guild, source, session.userId)
    if ((permissions & Permission.VIEW_CHANNEL) === 0n) return false
    if (
        channel.type === ChannelType.PRIVATE_THREAD &&
        channel.member === undefined &&
        (permissions & Permission.MANAGE_THREADS) === 0n
    )
        return false
    return true
}

/** Returns `channelPermissions`, updated when the channel, its parent or its guild change. */
export function useChannelPermissions(channelId: string): bigint {
    const session = useSession()
    const channel = useSessionStore(
        channelsStore,
        state => state.channels[channelId],
    )
    const parent = useSessionStore(channelsStore, state =>
        channel?.parent_id ? state.channels[channel.parent_id] : undefined,
    )
    const guild = useSessionStore(guildsStore, state =>
        channel?.guild_id ? state.guilds[channel.guild_id] : undefined,
    )
    return resolve(guild, channel, parent, session.userId)
}
