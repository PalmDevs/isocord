import { Permission } from '../../../../core/discord/permissions'
import { channelsStore } from '../../../../stores/channels/channels'
import { guildsStore } from '../../../../stores/guilds'
import { membersStore } from '../../../../stores/members'
import { can } from '../../../../stores/permissions'
import { usersStore } from '../../../../stores/users'
import { useComposerSlots } from './slots'
import type { Session } from '../../../../core/session'
import type { ParseContext } from './parse'

/** Returns what parsing the channel's message text needs to know, read from the session now. */
export function parseContext(
    session: Session,
    channelId: string,
): ParseContext {
    const channels = session.get(channelsStore).getState()
    const channel = channels.channels[channelId]
    const guild = channel?.guild_id
        ? session.get(guildsStore).getState().guilds[channel.guild_id]
        : undefined
    const slots = useComposerSlots.getState()
    return {
        guild,
        channel,
        users: session.get(usersStore).getState().users,
        members: guild
            ? session.get(membersStore).getState().members[guild.id]
            : undefined,
        channels: channels.channels,
        guildChannelIds: guild ? (channels.byGuild[guild.id] ?? []) : [],
        canMentionEveryone: can(
            session,
            channelId,
            Permission.MENTION_EVERYONE,
        ),
        resolveEmoji: slots.resolveEmoji
            ? name => slots.resolveEmoji?.(channel, name)
            : undefined,
    }
}
