import { GuildFeature } from '../../core/discord/guild'
import {
    FORWARDABLE_FLAGS,
    FORWARDABLE_MESSAGE_TYPES,
} from '../../core/discord/messages'
import { Permission } from '../../core/discord/permissions'
import { channelsStore, isPrivate } from '../../stores/channels/channels'
import { guildsStore } from '../../stores/guilds'
import { can } from '../../stores/permissions'
import type { Session } from '../../core/session'
import type { Message } from '../../stores/readStates'

/** What else a message may hold that blocks a forward. */
type ForwardedMessage = Message & {
    poll?: unknown
    call?: unknown
    activity?: unknown
}

/**
 * canForwardMessage: a sent message of a forwardable type, without a poll, call or activity, or other flags.
 * The user must read the channel's history, outside DMs, and the server must allow forwarding.
 * Not ported: gated channels and moderator report channels.
 */
export function canForwardMessage(
    session: Session,
    message: ForwardedMessage,
): boolean {
    if (message.state === 'failed' || message.state === 'sending') return false
    if (!FORWARDABLE_MESSAGE_TYPES.has(message.type ?? 0)) return false
    if (message.poll != null || message.call != null) return false
    if (message.activity != null) return false
    if (((message.flags ?? 0) & ~FORWARDABLE_FLAGS) !== 0) return false
    const channel = session.get(channelsStore).getState().channels[
        message.channel_id
    ]
    if (
        channel &&
        !isPrivate(channel) &&
        !can(session, channel.id, Permission.READ_MESSAGE_HISTORY)
    )
        return false
    const guild = channel?.guild_id
        ? session.get(guildsStore).getState().guilds[channel.guild_id]
        : undefined
    return !guild?.features?.includes(GuildFeature.FORWARDING_DISABLED)
}
