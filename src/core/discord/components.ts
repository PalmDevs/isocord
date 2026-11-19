/** Message component types (ComponentType in the API). */
export const ComponentType = {
    ACTION_ROW: 1,
    BUTTON: 2,
    STRING_SELECT: 3,
    TEXT_INPUT: 4,
    USER_SELECT: 5,
    ROLE_SELECT: 6,
    MENTIONABLE_SELECT: 7,
    CHANNEL_SELECT: 8,
    SECTION: 9,
    TEXT_DISPLAY: 10,
    THUMBNAIL: 11,
    MEDIA_GALLERY: 12,
    FILE: 13,
    SEPARATOR: 14,
    CONTAINER: 17,
} as const

/** The select menus: they open a sheet of options and send `values`. */
export const SELECT_COMPONENT_TYPES: ReadonlySet<number> = new Set([
    ComponentType.STRING_SELECT,
    ComponentType.USER_SELECT,
    ComponentType.ROLE_SELECT,
    ComponentType.MENTIONABLE_SELECT,
    ComponentType.CHANNEL_SELECT,
])

/** ButtonStyle in the API. DESTRUCTIVE is the API's DANGER. */
export const ButtonStyle = {
    PRIMARY: 1,
    SECONDARY: 2,
    SUCCESS: 3,
    DESTRUCTIVE: 4,
    LINK: 5,
    PREMIUM: 6,
} as const

/** SeparatorSpacingSize: the padding around a separator. */
export const SeparatorSpacing = {
    SMALL: 1,
    LARGE: 2,
} as const

/** SnowflakeSelectDefaultValueTypes: what a user, role, mentionable or channel select's default names. */
export const SelectDefaultValueType = {
    USER: 'user',
    ROLE: 'role',
    CHANNEL: 'channel',
} as const

/** InteractionTypes: the `type` of POST /interactions. */
export const InteractionType = {
    APPLICATION_COMMAND: 2,
    MESSAGE_COMPONENT: 3,
} as const

/** InteractionCallbackError.ReasonCodes: INTERACTION_FAILURE's `reason_code`. */
export const InteractionFailureReason = {
    UNKNOWN: 1,
    /** The application did not answer within three seconds. */
    TIMEOUT: 2,
    ACTIVITY_LAUNCH_UNKNOWN_APPLICATION: 3,
    ACTIVITY_LAUNCH_UNKNOWN_CHANNEL: 4,
    ACTIVITY_LAUNCH_UNKNOWN_GUILD: 5,
    ACTIVITY_LAUNCH_INVALID_PLATFORM: 6,
    ACTIVITY_LAUNCH_NOT_IN_EXPERIMENT: 7,
    ACTIVITY_LAUNCH_INVALID_CHANNEL_TYPE: 8,
    ACTIVITY_LAUNCH_INVALID_CHANNEL_NO_AFK: 9,
    ACTIVITY_LAUNCH_INVALID_DEV_PREVIEW_GUILD_SIZE: 10,
    ACTIVITY_LAUNCH_INVALID_USER_AGE_GATE: 11,
    ACTIVITY_LAUNCH_INVALID_USER_VERIFICATION_LEVEL: 12,
    ACTIVITY_LAUNCH_INVALID_USER_PERMISSIONS: 13,
    ACTIVITY_LAUNCH_INVALID_CONFIGURATION_NOT_EMBEDDED: 14,
    ACTIVITY_LAUNCH_INVALID_CONFIGURATION_PLATFORM_NOT_SUPPORTED: 15,
    ACTIVITY_LAUNCH_INVALID_CONFIGURATION_PLATFORM_NOT_RELEASED: 16,
    ACTIVITY_LAUNCH_FAILED_TO_LAUNCH: 17,
    ACTIVITY_LAUNCH_INVALID_USER_NO_ACCESS_TO_ACTIVITY: 18,
    ACTIVITY_LAUNCH_INVALID_LOCATION_TYPE: 19,
    ACTIVITY_LAUNCH_INVALID_USER_REGION_FOR_APPLICATION: 20,
} as const
