import { DAY } from '../../core/time'
import { t } from '../../i18n'

/** Styles of `<t:unix:style>`, as in the reference's TIMESTAMP_FORMATS (moment LT, LTS, L, LL, LLL, LLLL). */
export type TimestampStyle = 't' | 'T' | 'd' | 'D' | 'f' | 'F' | 's' | 'S' | 'R'

const time = (date: Date, seconds = false) =>
    date.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        second: seconds ? '2-digit' : undefined,
    })
const shortDate = (date: Date) =>
    date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    })
const longDate = (date: Date, weekday = false) =>
    date.toLocaleDateString(undefined, {
        weekday: weekday ? 'long' : undefined,
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    })

/** moment's humanize() with the reference's thresholds: seconds are shown up to a minute. */
export function humanizeDuration(milliseconds: number): string {
    const seconds = Math.round(Math.abs(milliseconds) / 1000)
    const minutes = Math.round(seconds / 60)
    const hours = Math.round(seconds / 3600)
    const days = Math.round(seconds / 86_400)
    const months = Math.round(days / 30.4375)
    const years = Math.round(days / 365.25)
    const amount = (
        one: Parameters<typeof t>[0],
        many: Parameters<typeof t>[0],
        count: number,
    ) => (count <= 1 ? t(one) : t(many, { count }))
    if (seconds < 60) return t('markdown.relative.seconds', { count: seconds })
    if (minutes < 60)
        return amount(
            'markdown.relative.minute',
            'markdown.relative.minutes',
            minutes,
        )
    if (hours < 22)
        return amount(
            'markdown.relative.hour',
            'markdown.relative.hours',
            hours,
        )
    if (days < 26)
        return amount('markdown.relative.day', 'markdown.relative.days', days)
    if (months < 11)
        return amount(
            'markdown.relative.month',
            'markdown.relative.months',
            months,
        )
    return amount('markdown.relative.year', 'markdown.relative.years', years)
}

/** moment's fromNow(): the humanized distance, in the past or the future. */
function relative(date: Date): string {
    const delta = date.getTime() - Date.now()
    return t(
        delta < 0 ? 'markdown.relative.past' : 'markdown.relative.future',
        { time: humanizeDuration(delta) },
    )
}

/** The text of a timestamp mention in `style`, or undefined when the time is out of range. */
export function formatTimestamp(
    seconds: number,
    style: TimestampStyle = 'f',
): string | undefined {
    const date = new Date(seconds * 1000)
    if (Number.isNaN(date.getTime())) return undefined
    switch (style) {
        case 't':
            return time(date)
        case 'T':
            return time(date, true)
        case 'd':
            return shortDate(date)
        case 'D':
            return longDate(date)
        case 'f':
            return `${longDate(date)} ${time(date)}`
        case 'F':
            return `${longDate(date, true)} ${time(date)}`
        case 's':
            return `${shortDate(date)} ${time(date)}`
        case 'S':
            return `${shortDate(date)} ${time(date, true)}`
        case 'R':
            return relative(date)
    }
}

export const sameDay = (a: Date, b: Date) =>
    a.toDateString() === b.toDateString()

/** calendarFormat(date, true) in the reference: today is only the time, older days are "L LT". */
export function calendarTimestamp(date: Date): string {
    const now = new Date()
    if (sameDay(date, now)) return time(date)
    if (sameDay(date, new Date(now.getTime() - DAY)))
        return t('chat.yesterday', { time: time(date) })
    return `${shortDate(date)} ${time(date)}`
}
