package me.palmdevs.isocord.network

// Discord protocol facts Kotlin reads. Not exported: JS names its own in src/core.

/** Discord's epoch: a snowflake's time counts milliseconds from it. */
const val DISCORD_EPOCH = 1_420_070_400_000L
/** A snowflake's time sits above its low 22 bits (worker, process, increment). */
const val SNOWFLAKE_TIME_SHIFT = 22

/** Gateway opcodes. */
object GatewayOp {
  const val DISPATCH = 0
  const val HEARTBEAT = 1
  const val IDENTIFY = 2
  const val RESUME = 6
  const val RECONNECT = 7
  const val INVALID_SESSION = 9
  const val HELLO = 10
  const val HEARTBEAT_ACK = 11
  const val GUILD_SUBSCRIPTIONS_BULK = 37
  const val QOS_HEARTBEAT = 40
}

/** WebSocket close codes the gateway sends or the client closes with. */
object GatewayClose {
  /** Ends the session on Discord's side. */
  const val NORMAL = 1000
  /** No close frame: the connection failed. */
  const val ABNORMAL = 1006
  /** The client's own close of a connection it will resume. */
  const val RESUMABLE = 4000
  const val AUTHENTICATION_FAILED = 4004
  const val INVALID_SEQ = 4007
  const val SESSION_TIMED_OUT = 4009
  /** Shards, API version, intents. Reconnecting can't fix them. */
  val FATAL = 4010..4014
}

/** PresenceStatus values the notifications read or send. */
object Status {
  const val DND = "dnd"
  /** IDENTIFY's presence before the client sets one. */
  const val UNKNOWN = "unknown"
}

/** Channel types. */
object ChannelType {
  const val DM = 1
  const val GROUP_DM = 3
  const val ANNOUNCEMENT_THREAD = 10
  const val PUBLIC_THREAD = 11
  const val PRIVATE_THREAD = 12
  const val GUILD_FORUM = 15
  const val GUILD_MEDIA = 16

  val THREADS = setOf(ANNOUNCEMENT_THREAD, PUBLIC_THREAD, PRIVATE_THREAD)
  /** Channels whose threads are posts. */
  val FORUMS = setOf(GUILD_FORUM, GUILD_MEDIA)
}

/** Message types. */
object MessageType {
  const val DEFAULT = 0
  const val REPLY = 19
  const val CHAT_INPUT_COMMAND = 20
}

/** MessageFlags. */
object MessageFlags {
  /** Sent with @silent. */
  const val SUPPRESS_NOTIFICATIONS = 1 shl 12
}

/** Attachment spoilers: a flag, or the older filename prefix. */
object AttachmentSpoiler {
  /** AttachmentFlags.IS_SPOILER. */
  const val FLAG = 1 shl 3
  const val FILENAME_PREFIX = "SPOILER_"
}

/** UserNotificationSettings: a guild's or channel's notification level. */
object NotificationLevel {
  const val ALL_MESSAGES = 0
  const val NO_MESSAGES = 2
  /** Inherit. */
  const val NULL = 3
}

/** GuildNotificationSettingsFlags. */
object GuildNotificationFlags {
  /** Only the channels the user picked show ("Browse Channels"). */
  const val OPT_IN_CHANNELS_ON = 1 shl 14
}

/** ChannelNotificationSettingsFlags. */
object ChannelNotificationFlags {
  /** The channel or category is on the user's channel list. */
  const val OPT_IN_ENABLED = 1 shl 12
}

/** Permission bits. */
object Permission {
  const val ADMINISTRATOR = 1L shl 3
  const val VIEW_CHANNEL = 1L shl 10
  const val SEND_MESSAGES = 1L shl 11
  const val MANAGE_THREADS = 1L shl 34
  const val SEND_MESSAGES_IN_THREADS = 1L shl 38
  /** Every bit: the owner's and an administrator's. */
  const val ALL = -1L
}

/** RelationshipType. */
object RelationshipType {
  const val FRIEND = 1
  const val INCOMING_REQUEST = 3
  const val OUTGOING_REQUEST = 4
}

/** GuildScheduledEventStatus. */
object ScheduledEventStatus {
  const val ACTIVE = 2
}

/** ReadStateType. */
object ReadStateType {
  const val CHANNEL = 0
}

/** The REST paths Kotlin calls, under [Discord.API_BASE]. */
object ApiPath {
  fun messages(channelId: String) = "/channels/$channelId/messages"

  /** The one message `messageId`, which a reaction notification quotes. */
  fun messageAround(channelId: String, messageId: String) = "/channels/$channelId/messages?limit=1&around=$messageId"

  fun messageAck(channelId: String, messageId: String) = "/channels/$channelId/messages/$messageId/ack"

  fun stopRinging(channelId: String) = "/channels/$channelId/call/stop-ringing"

  fun relationship(userId: String) = "/users/@me/relationships/$userId"

  fun eventInterests(guildId: String) = "/users/@me/scheduled-events?guild_ids=$guildId"
}

/** getDefaultAvatarURL: the default avatars a user without one gets. */
object DefaultAvatar {
  /** Picked by id. */
  const val COUNT = 6
  /** Picked by discriminator, for legacy usernames. */
  const val LEGACY_COUNT = 5
}

/** Sticker upload limits (Create Guild Sticker). */
object StickerLimit {
  /** Width and height of a sticker image, in px. */
  const val SIZE = 320
}
