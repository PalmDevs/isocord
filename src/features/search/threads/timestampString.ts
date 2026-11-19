import { t } from '../../../i18n'

export const MONTH = 2592000

export const YEAR = 31104000

/**
 * threads/getTimestampString without overrides: under a minute is "1m ago", then minutes, hours and days, ">30d ago"
 * within a year, and the date (moment's LL) after that.
 */
export function timestampString(time: number): string {
    const seconds = (Date.now() - time) / 1000
    if (seconds < 60) return t('threads.ago.minutes', { count: 1 })
    if (seconds < 3600)
        return t('threads.ago.minutes', { count: Math.floor(seconds / 60) })
    if (seconds < 86400)
        return t('threads.ago.hours', { count: Math.floor(seconds / 3600) })
    if (seconds < MONTH)
        return t('threads.ago.days', { count: Math.floor(seconds / 86400) })
    if (seconds < YEAR) return t('threads.ago.months')
    return new Date(time).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    })
}
