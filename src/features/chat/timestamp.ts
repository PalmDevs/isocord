import { DAY } from '../../core/time'
import { t } from '../../i18n'

/** Styles of `<t:unix:style>`, as in the reference's TIMESTAMP_FORMATS (moment LT, LTS, L, LL, LLL, LLLL). */
export type TimestampStyle = 't' | 'T' | 'd' | 'D' | 'f' | 'F' | 's' | 'S' | 'R'

/**
 * Returns a formatter made on first use and kept. Hermes makes each DateTimeFormat through JNI, which
 * `toLocaleTimeString` with options repeats on every call.
 */
function dateFormat(options: Intl.DateTimeFormatOptions) {
    let format: Intl.DateTimeFormat | undefined
    return (date: Date) =>
        (format ??= new Intl.DateTimeFormat(undefined, options)).format(date)
}

/** "1:25 PM". */
export const formatTime = dateFormat({ hour: 'numeric', minute: '2-digit' })
const timeWithSeconds = dateFormat({
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
})
/** "03/01/2026". */
export const formatShortDate = dateFormat({
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
})
/** "March 1, 2026". */
export const formatLongDate = dateFormat({
    year: 'numeric',
    month: 'long',
    day: 'numeric',
})
const longDateWithWeekday = dateFormat({
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
})
/** "Sunday". */
export const formatWeekday = dateFormat({ weekday: 'long' })
/** `toLocaleDateString()` without options: "3/1/2026". */
export const formatNumericDate = dateFormat({})

const time = (date: Date, seconds = false) =>
    seconds ? timeWithSeconds(date) : formatTime(date)
const longDate = (date: Date, weekday = false) =>
    weekday ? longDateWithWeekday(date) : formatLongDate(date)

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
            return formatShortDate(date)
        case 'D':
            return longDate(date)
        case 'f':
            return `${longDate(date)} ${time(date)}`
        case 'F':
            return `${longDate(date, true)} ${time(date)}`
        case 's':
            return `${formatShortDate(date)} ${time(date)}`
        case 'S':
            return `${formatShortDate(date)} ${time(date, true)}`
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
    return `${formatShortDate(date)} ${time(date)}`
}
