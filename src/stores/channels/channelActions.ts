import { Endpoint } from '../../core/api/paths'
import { APPLICATION_MANAGEABLE_TYPES } from '../../core/discord/channelType'
import { logger } from '../../core/log'
import { channelsStore } from './channels'
import type { PermissionOverwrite } from '../../core/discord/permissions'
import type { Session } from '../../core/session'
import type { Channel } from './channels'

declare module './channels' {
    interface Channel {
        nsfw?: boolean
        bitrate?: number
        user_limit?: number
        /** The application that runs a managed group DM or a guild app channel. */
        application_id?: string
        /** ChannelFlags bits. */
        flags?: number
    }
}

const log = logger('ChannelActions')

/** ChannelRecord.isManaged: a group DM run by an application. */
export const isManagedChannel = (channel: Channel): boolean =>
    APPLICATION_MANAGEABLE_TYPES.has(channel.type) &&
    channel.application_id != null

/** The fields of a channel edit (ChannelSettingsActionCreators.saveChannel, ChannelActionCreators.setName and setIcon). */
export interface ChannelEdit {
    name?: string
    topic?: string
    nsfw?: boolean
    rate_limit_per_user?: number
    /** Threads: minutes of inactivity before it is hidden. */
    auto_archive_duration?: number
    /** Private threads: whether anyone can add members. */
    invitable?: boolean
    /** GUILD_TEXT or GUILD_ANNOUNCEMENT: switches a channel between the two. */
    type?: number
    /** Minutes of inactivity before new threads are hidden. */
    default_auto_archive_duration?: number
    /** A data URI, or null to remove the icon of a group DM. */
    icon?: string | null
}

/** The body of a guild channel to create (CreateChannelActionCreators.createChannel). */
export interface NewChannel {
    type: number
    name: string
    permission_overwrites: PermissionOverwrite[]
    bitrate?: number
    user_limit?: number
    parent_id?: string
    application_id?: string
}

/**
 * ChannelActionCreators.closePrivateChannel: drops the DM or group DM at once with a local CHANNEL_DELETE, then asks
 * the server. `silent` leaves a group without telling its members. A failed request is not undone, as in the
 * reference.
 */
export async function closePrivateChannel(
    session: Session,
    channelId: string,
    silent = false,
): Promise<void> {
    const channel = session.get(channelsStore).getState().channels[channelId]
    if (channel) session.gateway.dispatch.emit('CHANNEL_DELETE', channel)
    try {
        await session.rest.delete(Endpoint.channel(channelId), {
            query: { silent },
        })
    } catch (error) {
        log.warn('Could not close the channel', error)
    }
}

/** Patches a channel. The gateway's CHANNEL_UPDATE puts the result in the store. */
export function updateChannel(
    session: Session,
    channelId: string,
    edit: ChannelEdit,
): Promise<unknown> {
    return session.rest.patch(Endpoint.channel(channelId), { body: edit })
}

/** Creates a guild channel and returns it. The gateway's CHANNEL_CREATE puts it in the store. */
export function createGuildChannel(
    session: Session,
    guildId: string,
    channel: NewChannel,
): Promise<Channel> {
    return session.rest.post<Channel>(Endpoint.guildChannels(guildId), {
        body: channel,
    })
}

/** Deletes a thread, post or channel. The gateway's CHANNEL_DELETE or THREAD_DELETE removes it from the store. */
export function deleteChannel(
    session: Session,
    channelId: string,
): Promise<unknown> {
    return session.rest.delete(Endpoint.channel(channelId))
}
