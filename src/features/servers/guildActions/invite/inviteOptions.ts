import { DAY, HOUR, MINUTE, SECOND } from '../../../../core/time'
import { t } from '../../../../i18n'

/** InstantInviteUtils.INVITE_OPTIONS_*: an invite's `max_age` in seconds. */
const MAX_AGE_FOREVER = 0
export const MAX_AGE_7_DAYS = (7 * DAY) / SECOND

type TimeUnit = 'minutes' | 'hours' | 'days'

interface MaxAgeOption {
    seconds: number
    unit: TimeUnit
    count: number
}

/** InstantInviteUtils.MAX_AGE_OPTIONS, without the experimental 14, 30 and 60 days. */
const MAX_AGE_OPTIONS: MaxAgeOption[] = [
    { seconds: (30 * MINUTE) / SECOND, unit: 'minutes', count: 30 },
    { seconds: HOUR / SECOND, unit: 'hours', count: 1 },
    { seconds: (6 * HOUR) / SECOND, unit: 'hours', count: 6 },
    { seconds: (12 * HOUR) / SECOND, unit: 'hours', count: 12 },
    { seconds: DAY / SECOND, unit: 'days', count: 1 },
    { seconds: MAX_AGE_7_DAYS, unit: 'days', count: 7 },
]

/** InstantInviteUtils.MAX_USES_OPTIONS. 0 is no limit. */
export const MAX_USES_OPTIONS = [0, 1, 5, 10, 25, 50, 100] as const

/** DefaultInviteExpirationExperiments.getDefaultInviteExpiration: hubs default to never. */
export function defaultMaxAge(isHub: boolean): number {
    return isHub ? MAX_AGE_FOREVER : MAX_AGE_7_DAYS
}

/** Returns the expiry options as `{ seconds, label }`, with never expiring last. */
export function maxAgeOptions(): { seconds: number; label: string }[] {
    return [
        ...MAX_AGE_OPTIONS.map(({ seconds, unit, count }) => ({
            seconds,
            label: t(
                `composer.slowmode.${unit}.${count === 1 ? 'one' : 'other'}`,
                { count },
            ),
        })),
        { seconds: MAX_AGE_FOREVER, label: t('invite.expiryNever') },
    ]
}

export function maxUsesLabel(maxUses: number): string {
    return maxUses === 0 ? t('invite.noLimit') : String(maxUses)
}
