import { MINUTE } from '../time'
import { snowflakeTimestamp } from './snowflake'

/** A thread's `thread_metadata`, with the fields the settings edit. */
export interface ThreadMetadata {
    archived: boolean
    locked?: boolean
    /** Minutes of inactivity before the thread is hidden. */
    auto_archive_duration?: number
    /** Private threads: whether anyone, not only moderators, can add members. */
    invitable?: boolean
    /** ISO date the archived state last changed. */
    archive_timestamp?: string
}

/**
 * Returns when the thread hides for inactivity, in ms (getThreadAutoArchiveTimeOnce). Activity is its newest
 * message, or its creation, or its last archive change. Without a duration it has already hidden.
 */
export function autoArchiveTime(
    threadId: string,
    metadata: ThreadMetadata | undefined,
    lastMessageId: string | undefined,
): number {
    if (!metadata?.auto_archive_duration) return 0
    const lastActivity = Math.max(
        snowflakeTimestamp(lastMessageId ?? threadId),
        metadata.archive_timestamp
            ? new Date(metadata.archive_timestamp).getTime()
            : 0,
    )
    return lastActivity + metadata.auto_archive_duration * MINUTE
}

const MINUTES_PER_HOUR = 60
const HOURS_PER_DAY = 24
const MINUTES_PER_DAY = MINUTES_PER_HOUR * HOURS_PER_DAY
const DAYS_PER_WEEK = 7
const THREE_DAYS = 3

/** ThreadConstants.DEFAULT_AUTO_ARCHIVE_DURATION, in minutes. */
export const DEFAULT_AUTO_ARCHIVE_DURATION = THREE_DAYS * MINUTES_PER_DAY

/** ThreadAutoArchive.AUTO_ARCHIVE_OPTION_VALUES: the durations a thread can hide after, in minutes. */
export const AUTO_ARCHIVE_DURATIONS = {
    HOUR: MINUTES_PER_HOUR,
    DAY: MINUTES_PER_DAY,
    THREE_DAYS: DEFAULT_AUTO_ARCHIVE_DURATION,
    WEEK: DAYS_PER_WEEK * MINUTES_PER_DAY,
} as const
