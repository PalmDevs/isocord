import { DAY, HOUR, MINUTE, SECOND } from '../../../core/time'
import { t } from '../../../i18n'
import { UNSET_FIXED64 } from '../../../stores/settings/settingsProto'
import { formatTimestamp, sameDay } from '../../chat/timestamp'
import type { CustomStatus } from '../../../stores/settings/settingsProto'

/** ClearAfterValues. */
export type ClearAfter =
    | 'TODAY'
    | 'HOURS_4'
    | 'HOURS_1'
    | 'MINUTES_30'
    | 'DONT_CLEAR'

/** ClearAfterOptions, in the sheet's order. */
export const CLEAR_AFTER_OPTIONS: readonly ClearAfter[] = [
    'TODAY',
    'HOURS_4',
    'HOURS_1',
    'MINUTES_30',
    'DONT_CLEAR',
]

/** getClearAfterDuration: TODAY is a whole day. */
const DURATIONS: Record<Exclude<ClearAfter, 'DONT_CLEAR'>, number> = {
    TODAY: DAY,
    HOURS_4: 4 * HOUR,
    HOURS_1: HOUR,
    MINUTES_30: 30 * MINUTE,
}

/** computeInitialClearAfter's candidates for a status ending today, shortest first. */
const SAME_DAY_OPTIONS = ['MINUTES_30', 'HOURS_1', 'HOURS_4'] as const

/** Returns the end of a status cleared after `value`, from now. */
const endOf = (value: Exclude<ClearAfter, 'DONT_CLEAR'>) =>
    Date.now() + DURATIONS[value]

/** setCustomStatus's expiresAtMs: "0" for DONT_CLEAR. */
export const expiresAtMsOf = (value: ClearAfter): string =>
    value === 'DONT_CLEAR' ? UNSET_FIXED64 : String(endOf(value))

/** computeInitialClearAfter: the option closest to the saved status's expiry. */
export function initialClearAfter(saved: CustomStatus | undefined): ClearAfter {
    if (!saved) return 'TODAY'
    const expires = Number(saved.expiresAtMs ?? UNSET_FIXED64)
    if (Number.isNaN(expires)) return 'TODAY'
    if (expires === 0) return 'DONT_CLEAR'
    if (!sameDay(new Date(), new Date(expires))) return 'TODAY'
    const remaining = expires - Date.now()
    return (
        SAME_DAY_OPTIONS.find(option => remaining <= DURATIONS[option]) ??
        'TODAY'
    )
}

/** Returns the short time of `ms`, or "{tomorrow} at" it when it is not today. */
function clockOf(ms: number, tomorrowKey: 'tomorrowAt' | 'tomorrowAtTitle') {
    const time = formatTimestamp(Math.floor(ms / SECOND), 't') ?? ''
    if (sameDay(new Date(), new Date(ms))) return time
    return t(`userProfile.clearAfter.${tomorrowKey}`, { time })
}

/** Returns the duration's own words, such as "4 hours". */
function durationLabel(value: Exclude<ClearAfter, 'DONT_CLEAR'>): string {
    if (value === 'MINUTES_30')
        return t('userProfile.clearAfter.minutes', {
            minutes: DURATIONS[value] / MINUTE,
        })
    const hours = DURATIONS[value] / HOUR
    return t(
        hours === 1
            ? 'userProfile.clearAfter.hour'
            : 'userProfile.clearAfter.hours',
        { hours },
    )
}

/** formatClearAfterOption: the duration and the time it ends, such as "4 hours (6:30 PM)". */
export function clearAfterOptionLabel(value: ClearAfter): string {
    if (value === 'DONT_CLEAR') return t('userProfile.clearAfter.dontClear')
    return `${durationLabel(value)} (${clockOf(endOf(value), 'tomorrowAt')})`
}

/** formatClearAfterValue: the time the status clears, shown on the "Clear at" row. */
export function clearAfterValueLabel(value: ClearAfter): string {
    if (value === 'DONT_CLEAR') return t('userProfile.clearAfter.dontClear')
    return clockOf(endOf(value), 'tomorrowAtTitle')
}
