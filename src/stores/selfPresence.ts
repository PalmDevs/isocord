import {
    ActivityType,
    CUSTOM_STATUS_ACTIVITY_NAME,
} from '../core/discord/activity'
import { Opcode } from '../core/gateway/opcodes'
import { settingsStore } from './settings/settingsStore'
import type { Session } from '../core/session'
import type { CustomStatus } from './settings/settingsProto'

/** StatusTypes.UNKNOWN: the status setting before one is chosen. */
const UNKNOWN_STATUS = 'unknown'
/** StatusTypes.ONLINE: what an unknown status setting means. */
const ONLINE_STATUS = 'online'
/** IdleStore.getIdleSince: 0 while the app is in use. */
const NOT_IDLE_SINCE = 0
/** IdleStore.isAFK: false while the app is in use. */
const NOT_AFK = false

/** Returns the custom status activity, as getActivityFromCustomStatus builds it. */
const customStatusActivity = ({ text, emoji, expiresAtMs }: CustomStatus) => ({
    name: CUSTOM_STATUS_ACTIVITY_NAME,
    type: ActivityType.CUSTOM_STATUS,
    state: text || undefined,
    // Only a status that clears has an end.
    timestamps:
        Number(expiresAtMs) > 0 ? { end: Number(expiresAtMs) } : undefined,
    emoji: emoji
        ? {
              id: emoji.id ?? null,
              name: emoji.name,
              animated: emoji.animated ?? false,
          }
        : null,
})

/**
 * Sends this session's presence, like LocalPresenceStateManager.emitPresenceUpdate with
 * SelfPresenceStore.getLocalPresence. Only the custom status activity is shared.
 * The server answers with SESSIONS_REPLACE, which updates the user's own presence.
 */
export function emitPresenceUpdate(
    session: Session,
    customStatus: CustomStatus | null,
): void {
    const setting = session.get(settingsStore).getState().status
    const status =
        !setting || setting === UNKNOWN_STATUS ? ONLINE_STATUS : setting
    session.gateway.send(Opcode.PRESENCE_UPDATE, {
        status,
        since: NOT_IDLE_SINCE,
        activities: customStatus ? [customStatusActivity(customStatus)] : [],
        afk: NOT_AFK,
    })
}
