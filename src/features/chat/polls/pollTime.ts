import { DAY, HOUR, MINUTE } from '../../../core/time'
import { t } from '../../../i18n'
import type { MessagePoll } from '../../../stores/messages/messageTypes'

/** How long until a poll ends, in ms; undefined without an expiry. */
const remaining = (poll: MessagePoll, now: number) =>
    poll.expiry ? Date.parse(poll.expiry) - now : undefined

/**
 * Whether a poll has ended: finalized, past its expiry, or without one. computeBasicPollChatData's isExpired, whose
 * label is undefined when there is no expiry.
 */
export function isPollExpired(poll: MessagePoll, now = Date.now()): boolean {
    const ms = remaining(poll, now)
    return poll.results?.is_finalized === true || ms === undefined || ms <= 0
}

/**
 * useFormattedExpirationLabel.formatExpirationLabel: whole days left while more than one, else whole hours while
 * more than one, else minutes ("< 1m" under a minute). Undefined once the poll has ended.
 */
export function timeLeft(
    poll: MessagePoll,
    now = Date.now(),
): string | undefined {
    const ms = remaining(poll, now)
    if (isPollExpired(poll, now) || ms === undefined) return undefined
    const days = Math.floor(ms / DAY)
    if (days > 1) return t('chat.poll.daysLeft', { count: days })
    const hours = Math.floor(ms / HOUR)
    if (hours > 1) return t('chat.poll.hoursLeft', { count: hours })
    const minutes = Math.floor(ms / MINUTE)
    return minutes === 0
        ? t('chat.poll.underMinuteLeft')
        : t('chat.poll.minutesLeft', { count: minutes })
}

/** When the poll's time-left label next changes, or it ends. Undefined for an ended poll. */
export function nextPollChange(
    poll: MessagePoll,
    now = Date.now(),
): number | undefined {
    const ms = remaining(poll, now)
    if (isPollExpired(poll, now) || ms === undefined) return undefined
    const unit =
        Math.floor(ms / DAY) > 1
            ? DAY
            : Math.floor(ms / HOUR) > 1
              ? HOUR
              : MINUTE
    // Just past the next whole unit, where the floor drops.
    return now + (ms % unit) + 1
}
