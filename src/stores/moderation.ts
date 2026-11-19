import { Endpoint } from '../core/api/paths'
import type { Session } from '../core/session'

const AUDIT_LOG_REASON = 'X-Audit-Log-Reason'

const reasonHeaders = (reason?: string) =>
    reason ? { [AUDIT_LOG_REASON]: encodeURIComponent(reason) } : undefined

/** Removes a member from a guild. */
export const kickMember = (
    session: Session,
    guildId: string,
    userId: string,
    reason?: string,
): Promise<void> =>
    session.rest.delete(Endpoint.guildMember(guildId, userId), {
        headers: reasonHeaders(reason),
    })

/** Bans a user, deleting their messages of the last `deleteMessageSeconds`. */
export const banMember = (
    session: Session,
    guildId: string,
    userId: string,
    deleteMessageSeconds?: number,
    reason?: string,
): Promise<void> =>
    session.rest.put(Endpoint.guildBan(guildId, userId), {
        body: { delete_message_seconds: deleteMessageSeconds },
        headers: reasonHeaders(reason),
    })

/** Times a member out until an ISO timestamp, or lifts the timeout with null. */
export const timeoutMember = (
    session: Session,
    guildId: string,
    userId: string,
    untilIso: string | null,
): Promise<void> =>
    session.rest.patch(Endpoint.guildMember(guildId, userId), {
        body: { communication_disabled_until: untilIso },
    })
