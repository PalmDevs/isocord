// A thread's member record of the user, as the gateway sends it, and the flags of its notification setting.

/** threads/ThreadConstants ThreadMemberFlags. */
export const ThreadMemberFlags = {
    HAS_INTERACTED: 1,
    ALL_MESSAGES: 2,
    ONLY_MENTIONS: 4,
    NO_MESSAGES: 8,
} as const

/** The notification levels of a thread (ThreadConstants.getThreadNotificationOptions), in the order shown. */
export const THREAD_NOTIFICATION_LEVELS = [
    ThreadMemberFlags.ALL_MESSAGES,
    ThreadMemberFlags.ONLY_MENTIONS,
    ThreadMemberFlags.NO_MESSAGES,
] as const

/** A thread member's mute: how long was picked and when it ends, null for no end. */
export interface ThreadMuteConfig {
    selected_time_window?: number
    end_time: string | null
}

/** The user's membership of a thread (the `member` of a thread, JoinedThreadsStore's record). */
export interface ThreadMember {
    flags: number
    /** ISO date. */
    join_timestamp: string
    muted?: boolean
    mute_config?: ThreadMuteConfig | null
}

/** The fields of a thread member's settings the API takes (ThreadActionCreators.setNotificationSettings). */
export interface ThreadNotificationChange {
    muted?: boolean
    mute_config?: ThreadMuteConfig | null
    flags?: number
}
