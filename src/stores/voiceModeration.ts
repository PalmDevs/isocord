import { Endpoint } from '../core/api/paths'
import type { Session } from '../core/session'

/** GuildActionCreators.setServerMute: server-mutes or unmutes a member in voice. */
export const setServerMute = (
    session: Session,
    guildId: string,
    userId: string,
    mute: boolean,
): Promise<void> =>
    session.rest.patch(Endpoint.guildMember(guildId, userId), {
        body: { mute },
    })

/** GuildActionCreators.setServerDeaf: server-deafens or undeafens a member in voice. */
export const setServerDeaf = (
    session: Session,
    guildId: string,
    userId: string,
    deaf: boolean,
): Promise<void> =>
    session.rest.patch(Endpoint.guildMember(guildId, userId), {
        body: { deaf },
    })

/** GuildActionCreators.setChannel: moves a member to a voice channel, or disconnects them with null. */
export const setMemberVoiceChannel = (
    session: Session,
    guildId: string,
    userId: string,
    channelId: string | null,
): Promise<void> =>
    session.rest.patch(Endpoint.guildMember(guildId, userId), {
        body: { channel_id: channelId },
    })
