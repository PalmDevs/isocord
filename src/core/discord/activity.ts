/** Constants ActivityTypes. */
export const ActivityType = {
    PLAYING: 0,
    STREAMING: 1,
    LISTENING: 2,
    WATCHING: 3,
    CUSTOM_STATUS: 4,
    COMPETING: 5,
} as const

/** The custom status activity's name (userSettingToActivity). */
export const CUSTOM_STATUS_ACTIVITY_NAME = 'Custom Status'
