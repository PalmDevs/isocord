export const PROFILE_SHEET_KEY = 'user-profile'

export const AVATAR_SIZE = 80
/** AVATAR_PADDING: the ring of the background around the avatar. */
export const AVATAR_PADDING = 6
export const BANNER_HEIGHT = 148
/** Banner width asked from the CDN, for a sheet on a phone screen. */
export const BANNER_CDN_SIZE = 600
/** Rich presence image size, in dp and CDN pixels. */
export const ACTIVITY_IMAGE_SIZE = 60
export const BADGE_SIZE = 20
/** Longest note Discord accepts. */
export const NOTE_MAX_LENGTH = 256
/** Image size asked from the CDN for the media viewer. */
export const VIEWER_IMAGE_SIZE = 1024

/** Timeout lengths of the moderator menu, in milliseconds. */
export const TIMEOUT_DURATIONS = [
    { key: 'userProfile.duration.minute', ms: 60_000 },
    { key: 'userProfile.duration.hour', ms: 3_600_000 },
    { key: 'userProfile.duration.day', ms: 86_400_000 },
    { key: 'userProfile.duration.week', ms: 604_800_000 },
] as const

/** ActivityTypes. */
export const ActivityType = {
    PLAYING: 0,
    STREAMING: 1,
    LISTENING: 2,
    WATCHING: 3,
    COMPETING: 5,
} as const

/** Separator between the join dates (DIVIDER_DOT). */
export const DIVIDER_DOT = ' \u2219 '
