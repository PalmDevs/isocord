/** MessageTypes: the types the app names. */
export const MessageType = {
    DEFAULT: 0,
    RECIPIENT_ADD: 1,
    RECIPIENT_REMOVE: 2,
    CALL: 3,
    CHANNEL_NAME_CHANGE: 4,
    CHANNEL_ICON_CHANGE: 5,
    CHANNEL_PINNED_MESSAGE: 6,
    USER_JOIN: 7,
    GUILD_BOOST: 8,
    GUILD_BOOST_TIER_1: 9,
    GUILD_BOOST_TIER_2: 10,
    GUILD_BOOST_TIER_3: 11,
    CHANNEL_FOLLOW_ADD: 12,
    GUILD_STREAM: 13,
    GUILD_DISCOVERY_DISQUALIFIED: 14,
    GUILD_DISCOVERY_REQUALIFIED: 15,
    GUILD_DISCOVERY_GRACE_PERIOD_INITIAL_WARNING: 16,
    GUILD_DISCOVERY_GRACE_PERIOD_FINAL_WARNING: 17,
    THREAD_CREATED: 18,
    REPLY: 19,
    CHAT_INPUT_COMMAND: 20,
    THREAD_STARTER_MESSAGE: 21,
    GUILD_INVITE_REMINDER: 22,
    CONTEXT_MENU_COMMAND: 23,
    AUTO_MODERATION_ACTION: 24,
    ROLE_SUBSCRIPTION_PURCHASE: 25,
    INTERACTION_PREMIUM_UPSELL: 26,
    STAGE_START: 27,
    STAGE_END: 28,
    STAGE_SPEAKER: 29,
    STAGE_RAISE_HAND: 30,
    STAGE_TOPIC: 31,
    GUILD_APPLICATION_PREMIUM_SUBSCRIPTION: 32,
    PRIVATE_CHANNEL_INTEGRATION_ADDED: 33,
    PRIVATE_CHANNEL_INTEGRATION_REMOVED: 34,
    PREMIUM_REFERRAL: 35,
    GUILD_INCIDENT_ALERT_MODE_ENABLED: 36,
    GUILD_INCIDENT_ALERT_MODE_DISABLED: 37,
    GUILD_INCIDENT_REPORT_RAID: 38,
    GUILD_INCIDENT_REPORT_FALSE_ALARM: 39,
    GUILD_DEADCHAT_REVIVE_PROMPT: 40,
    CUSTOM_GIFT: 41,
    GUILD_GAMING_STATS_PROMPT: 42,
    PURCHASE_NOTIFICATION: 44,
    VOICE_HANGOUT_INVITE: 45,
    POLL_RESULT: 46,
    CHANGELOG: 47,
    CHAT_WALLPAPER_SET: 56,
    CHAT_WALLPAPER_REMOVED: 57,
    PREMIUM_GROUP_INVITE: 64,
    VOICE_SESSION: 65,
    MEDIA_MENTION_MESSAGE: 68,
    GUILD_SPACE_MESSAGE: 69,
} as const

const M = MessageType

/** MessageTypesSets.UNDELETABLE. */
export const UNDELETABLE_MESSAGE_TYPES: ReadonlySet<number> = new Set([
    M.RECIPIENT_ADD,
    M.RECIPIENT_REMOVE,
    M.CALL,
    M.CHANNEL_NAME_CHANGE,
    M.CHANNEL_ICON_CHANGE,
    M.THREAD_STARTER_MESSAGE,
    M.PREMIUM_REFERRAL,
    M.CHAT_WALLPAPER_SET,
    M.CHAT_WALLPAPER_REMOVED,
    M.PREMIUM_GROUP_INVITE,
    M.MEDIA_MENTION_MESSAGE,
])

/** MessageTypesSets.USER_MESSAGE: whatever is not in it is a system message. */
export const USER_MESSAGE_TYPES: ReadonlySet<number> = new Set([
    M.DEFAULT,
    M.REPLY,
    M.CHAT_INPUT_COMMAND,
    M.CONTEXT_MENU_COMMAND,
    M.INTERACTION_PREMIUM_UPSELL,
    M.CUSTOM_GIFT,
    M.VOICE_HANGOUT_INVITE,
    M.CHANGELOG,
    M.MEDIA_MENTION_MESSAGE,
])

/** MessageTypesSets.REPLYABLE. */
export const REPLYABLE_MESSAGE_TYPES: ReadonlySet<number> = new Set([
    M.DEFAULT,
    M.USER_JOIN,
    M.REPLY,
    M.CHAT_INPUT_COMMAND,
    M.CONTEXT_MENU_COMMAND,
    M.AUTO_MODERATION_ACTION,
    M.ROLE_SUBSCRIPTION_PURCHASE,
    M.GUILD_APPLICATION_PREMIUM_SUBSCRIPTION,
    M.PRIVATE_CHANNEL_INTEGRATION_ADDED,
    M.PRIVATE_CHANNEL_INTEGRATION_REMOVED,
    M.PREMIUM_REFERRAL,
    M.GUILD_INCIDENT_ALERT_MODE_ENABLED,
    M.GUILD_INCIDENT_ALERT_MODE_DISABLED,
    M.GUILD_INCIDENT_REPORT_RAID,
    M.GUILD_INCIDENT_REPORT_FALSE_ALARM,
    M.GUILD_DEADCHAT_REVIVE_PROMPT,
    M.CUSTOM_GIFT,
    M.GUILD_GAMING_STATS_PROMPT,
    M.VOICE_HANGOUT_INVITE,
    M.POLL_RESULT,
    M.GUILD_SPACE_MESSAGE,
])

/** Types the chat draws as a message: default, reply and slash command. */
export const CHAT_MESSAGE_TYPES: ReadonlySet<number> = new Set([
    M.DEFAULT,
    M.REPLY,
    M.CHAT_INPUT_COMMAND,
])

/** MessageTypesSets.FORWARDABLE. */
export const FORWARDABLE_MESSAGE_TYPES: ReadonlySet<number> = new Set([
    M.DEFAULT,
    M.REPLY,
    M.CHAT_INPUT_COMMAND,
    M.CONTEXT_MENU_COMMAND,
    M.PREMIUM_REFERRAL,
    M.GUILD_SPACE_MESSAGE,
])

/** canForwardMessage: the only MessageFlags a forwardable message may carry. */
export const FORWARDABLE_FLAGS =
    (1 << 0) | // CROSSPOSTED
    (1 << 1) | // IS_CROSSPOST
    (1 << 2) | // SUPPRESS_EMBEDS
    (1 << 4) | // URGENT
    (1 << 5) | // HAS_THREAD
    (1 << 8) | // FAILED_TO_MENTION_SOME_ROLES_IN_THREAD
    (1 << 9) | // GUILD_FEED_HIDDEN
    (1 << 10) | // SHOULD_SHOW_LINK_NOT_DISCORD_WARNING
    (1 << 12) | // SUPPRESS_NOTIFICATIONS
    (1 << 13) | // IS_VOICE_MESSAGE
    (1 << 14) | // HAS_SNAPSHOT
    (1 << 15) | // IS_COMPONENTS_V2
    (1 << 19) | // IS_GUILD_OFFICIAL
    (1 << 20) // IS_SCHEDULED

/** ForwardConstants.MAX_DESTINATION_COUNT: places a forward or a share goes to at once. */
export const MAX_DESTINATION_COUNT = 5

/** Chat types plus the thread starter, which a preview shows as a message. */
export const PREVIEW_MESSAGE_TYPES: ReadonlySet<number> = new Set([
    ...CHAT_MESSAGE_TYPES,
    M.THREAD_STARTER_MESSAGE,
])

/** MessageFlags. */
export const MessageFlag = {
    CROSSPOSTED: 1 << 1,
    SUPPRESS_EMBEDS: 1 << 2,
    HAS_THREAD: 1 << 5,
    EPHEMERAL: 1 << 6,
    SUPPRESS_NOTIFICATIONS: 1 << 12,
    IS_VOICE_MESSAGE: 1 << 13,
    /** The message is laid out by components only (MessageRecord.isMessageComponentsV2). */
    IS_COMPONENTS_V2: 1 << 15,
} as const

/** AttachmentFlags. */
export const AttachmentFlag = {
    IS_THUMBNAIL: 1 << 1,
    IS_SPOILER: 1 << 3,
    IS_VOICE_MESSAGE: 1 << 13,
} as const

/** The filename prefix that marks an attachment as a spoiler, older than the IS_SPOILER flag. */
export const SPOILER_FILENAME_PREFIX = 'SPOILER_'

/** MessageReferenceType.FORWARD. */
export const MESSAGE_REFERENCE_FORWARD = 1

/** Messages can be this long, or MAX_MESSAGE_LENGTH_PREMIUM with Nitro (useMessageMaxLength in the reference). */
export const MAX_MESSAGE_LENGTH = 2000
export const MAX_MESSAGE_LENGTH_PREMIUM = 4000
const NITRO = 2

export const maxMessageLength = (premiumType: number | undefined) =>
    premiumType === NITRO ? MAX_MESSAGE_LENGTH_PREMIUM : MAX_MESSAGE_LENGTH

/** ReactionTypes: a reaction's `type` in reaction requests and events. BURST is a super reaction. */
export const ReactionType = {
    NORMAL: 0,
    BURST: 1,
} as const

/** Interaction message types: the response shows who ran the command above it (createExecutedCommand). */
export const INTERACTION_MESSAGE_TYPES: ReadonlySet<number> = new Set([
    M.CHAT_INPUT_COMMAND,
    M.CONTEXT_MENU_COMMAND,
])
