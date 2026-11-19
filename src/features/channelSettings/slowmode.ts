import {
    SECONDS_PER_DAY,
    SECONDS_PER_HOUR,
    SECONDS_PER_MINUTE,
} from '../../core/discord/channelLimits'
import { t } from '../../i18n'
import type { MessageKey } from '../../i18n'

type Unit = 'days' | 'hours' | 'minutes' | 'seconds'

/** SecondsSliderUtils.getSecondsSliderLabel: the largest unit of the cooldown ("2 hours"), "Slowmode is off." at 0. */
export function slowmodeLabel(seconds: number): string {
    if (seconds <= 0) return t('channelSettings.slowmodeOff')
    const parts: [Unit, number][] = [
        ['days', Math.floor(seconds / SECONDS_PER_DAY)],
        ['hours', Math.floor((seconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR)],
        [
            'minutes',
            Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE),
        ],
        ['seconds', seconds % SECONDS_PER_MINUTE],
    ]
    const [unit, count] = parts.find(([, amount]) => amount > 0) ?? [
        'seconds',
        0,
    ]
    return t(
        `composer.slowmode.${unit}.${count === 1 ? 'one' : 'other'}` as MessageKey,
        { count },
    )
}
