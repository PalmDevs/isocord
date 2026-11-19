import type { Presence } from '../../../stores/presences'

/**
 * The line under a member's name: their custom status, else what they are doing. As in ActivityStatus, which shows
 * getActivityStatusText's text, that is the activity's name alone; "Playing {name}" and the like are only its
 * tooltips. Nothing for an offline member.
 */
export function activityLine(
    presence: Presence | undefined,
): string | undefined {
    if (!presence || presence.status === 'offline') return undefined
    if (presence.customStatus) return presence.customStatus
    return presence.activity?.name
}
