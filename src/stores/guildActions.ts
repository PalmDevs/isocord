import { Endpoint } from '../core/api/paths'
import { logger } from '../core/log'
import { membersStore } from './members'
import { usersStore } from './users'
import type { Session } from '../core/session'

const log = logger('GuildActions')

export interface GuildPreview {
    id: string
    name: string
    icon: string | null
    description: string | null
    approximate_member_count?: number
    approximate_presence_count?: number
    features?: string[]
}

/** Fetches the public preview of a discoverable guild (GuildPopoutActionCreators.fetchGuildForPopout). */
export async function fetchGuildPreview(
    session: Session,
    guildId: string,
): Promise<GuildPreview | null> {
    try {
        return await session.rest.get<GuildPreview>(
            Endpoint.guildPreview(guildId),
        )
    } catch {
        return null
    }
}

/** Leaves a server (`DELETE /users/@me/guilds/{id}`). The gateway's GUILD_DELETE removes it from the store. */
export async function leaveGuild(
    session: Session,
    guildId: string,
): Promise<void> {
    await session.rest.delete(Endpoint.myGuild(guildId), {
        body: { lurking: false },
    })
}

/** Updates the current user's server nickname (`PATCH /guilds/{id}/members/@me`). */
export async function changeMyNickname(
    session: Session,
    guildId: string,
    nick: string,
): Promise<void> {
    const trimmed = nick.trim()
    const next = trimmed.length > 0 ? trimmed : null
    await session.rest.patch(Endpoint.myGuildMember(guildId), {
        body: { nick: next },
    })
    const existing = session.get(membersStore).getState().members[guildId]?.[
        session.userId
    ]
    session
        .get(membersStore)
        .getState()
        .put(guildId, [
            [session.userId, { roles: existing?.roles ?? [], nick: next }],
        ])
}

/** Adopts or clears a server tag (`PUT /users/@me/clan`). */
export async function setMyGuildTag(
    session: Session,
    guildId: string,
    enabled: boolean,
): Promise<void> {
    try {
        const user = await session.rest.put<Record<string, unknown>>(
            Endpoint.myClan,
            {
                body: {
                    identity_guild_id: enabled ? guildId : null,
                    identity_enabled: enabled,
                },
            },
        )
        const current = session.get(usersStore).getState().users[session.userId]
        if (current) {
            session
                .get(usersStore)
                .getState()
                .upsert([{ ...current, ...(user as Partial<typeof current>) }])
        }
    } catch (error) {
        log.warn('Could not update server tag', error)
        throw error
    }
}
