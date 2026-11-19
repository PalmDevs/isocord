package me.palmdevs.isocord.notifications.notify

import me.palmdevs.isocord.core.Links
import me.palmdevs.isocord.network.AttachmentSpoiler
import me.palmdevs.isocord.network.ChannelType
import me.palmdevs.isocord.network.DISCORD_EPOCH
import me.palmdevs.isocord.network.DefaultAvatar
import me.palmdevs.isocord.network.Discord
import me.palmdevs.isocord.network.SNOWFLAKE_TIME_SHIFT
import me.palmdevs.isocord.notifications.gateway.CallEvent
import me.palmdevs.isocord.notifications.gateway.RawChannel
import me.palmdevs.isocord.notifications.gateway.RawEmbed
import me.palmdevs.isocord.notifications.gateway.RawMessage
import me.palmdevs.isocord.notifications.gateway.RawUser
import me.palmdevs.isocord.notifications.gateway.ReactionAdd
import me.palmdevs.isocord.notifications.gateway.ScheduledEvent

/** Image previews are asked of the media proxy at most this big, never the original. */
private const val PREVIEW_MAX_PX = 720
/** The avatar size asked of the CDN, in pixels. */
private const val AVATAR_PX = 128

/** An image attachment to show in the notification, as a resized media proxy URL. */
class ImagePreview(val id: String, val url: String)

/** One message to notify about, worked out from what a session knows ([describe]). */
class Incoming(
  val channelId: String,
  val guildId: String?,
  val messageId: String,
  val time: Long,
  val authorId: String,
  val authorName: String,
  val avatarUrl: String,
  val text: String,
  /** Group DMs and server channels: messages show their author's name. */
  val isGroup: Boolean,
  val title: String? = null,
  /** DMs and group DMs, which go to the direct messages channel. */
  val isPrivate: Boolean,
  /** From Discord's own account: the system messages channel. */
  val isSystem: Boolean = false,
  val image: ImagePreview? = null,
  /** The conversation icon: the server's, the group's, or the DM author's avatar. */
  val iconUrl: String? = null,
  /** The account may send in the channel, so the notification offers Reply (NotificationData.canReply). */
  val canReply: Boolean = true,
)

fun snowflakeTime(id: String): Long = (id.toLongOrNull()?.ushr(SNOWFLAKE_TIME_SHIFT) ?: 0L) + DISCORD_EPOCH

/** <0, 0, >0 like compareTo, for snowflakes of any length. */
fun compareSnowflakes(a: String, b: String): Int = if (a.length != b.length) a.length - b.length else a.compareTo(b)

/** A user's avatar from the CDN, or their default avatar (getDefaultAvatarURL: by id, or by discriminator for legacy names). */
fun avatarUrl(id: String, avatar: String?, discriminator: String?): String {
  if (avatar != null) return "${Discord.CDN_BASE}/avatars/$id/$avatar.png?size=$AVATAR_PX"
  val legacy = discriminator?.toIntOrNull()?.takeIf { it != 0 }
  val index = legacy?.rem(DefaultAvatar.LEGACY_COUNT) ?: ((id.toLongOrNull() ?: 0L).ushr(SNOWFLAKE_TIME_SHIFT) % DefaultAvatar.COUNT).toInt()
  return "${Discord.CDN_BASE}/embed/avatars/$index.png"
}

/** IconUrlUtils.getForGuild: the server icon, none without one. */
private fun guildIconUrl(id: String, icon: String?): String? = icon?.let { "${Discord.CDN_BASE}/icons/$id/$it.png?size=$AVATAR_PX" }

/**
 * NotificationDataUtils.getIconUrl for MESSAGE_CREATE: the author's avatar in a DM, the group icon in a group DM,
 * the server icon elsewhere. The reference leaves stage channels without one. Here every server channel has it.
 */
private fun conversationIconUrl(channel: ChannelInfo, guild: GuildInfo?, author: RawUser): String? =
  when {
    channel.type == ChannelType.DM -> avatarUrl(author.id, author.avatar, author.discriminator)
    channel.isPrivate -> channel.icon?.let { "${Discord.CDN_BASE}/channel-icons/${channel.id}/$it.png?size=$AVATAR_PX" }
    else -> channel.guildId?.let { guildIconUrl(it, guild?.icon) }
  }

fun describe(message: RawMessage, channel: ChannelInfo, state: NotificationState, account: AccountConfig): Incoming {
  val guild = channel.guildId?.let { state.guilds[it] }
  val authorName = message.member?.nick ?: message.author.global_name ?: message.author.username ?: ""
  return Incoming(
    channelId = channel.id,
    guildId = channel.guildId,
    messageId = message.id,
    time = snowflakeTime(message.id),
    authorId = message.author.id,
    authorName = authorName,
    avatarUrl = avatarUrl(message.author.id, message.author.avatar, message.author.discriminator),
    text = previewText(message, state, guild, account),
    isGroup = channel.type != ChannelType.DM,
    title = title(channel, state, guild, account),
    isPrivate = channel.isPrivate,
    isSystem = message.author.system,
    image = imagePreview(message),
    iconUrl = conversationIconUrl(channel, guild, message.author),
    canReply = state.canSend(channel),
  )
}

/**
 * MessageNotificationHeader getLocationLabel, as the in-app notifications show it: the group's name (or its
 * people), "#channel, server", "thread, #channel". Without the in-app card's channel icon, text channels get a "#".
 */
fun title(channel: ChannelInfo, state: NotificationState, guild: GuildInfo?, account: AccountConfig): String? {
  if (channel.type == ChannelType.DM) return null
  if (channel.isPrivate)
    return channel.name?.takeIf { it.isNotEmpty() }
      ?: channel.recipientIds.mapNotNull { state.users[it]?.name }.joinToString(", ").takeIf { it.isNotEmpty() }
      ?: account.string("unnamedGroup")
  val name = channel.name ?: return guild?.name
  if (channel.isThread) {
    val parent = channel.parentId?.let { state.channels[it]?.name } ?: return name
    return "$name, #$parent"
  }
  return guild?.let { "#$name, ${it.name}" } ?: "#$name"
}

/**
 * previewText (features/messages/preview.ts): the content with mentions and custom emoji flattened, else a label
 * for what the message carries. Spoilers are masked, which the in-app preview does not do. The official app gets its
 * text from the push, then renders `<t:…>` timestamps (renderNotificationMessageContent). Not done here yet.
 */
fun previewText(message: RawMessage, state: NotificationState?, guild: GuildInfo?, account: AccountConfig): String {
  val names = message.mentions.associate { it.id to (it.global_name ?: it.username ?: "") }
  val content =
    maskSpoilers(message.content, account)
      .replace(Regex("<@!?(\\d+)>")) { "@" + (names[it.groupValues[1]] ?: "") }
      .replace(Regex("<@&(\\d+)>")) { "@" + (guild?.roleNames?.get(it.groupValues[1]) ?: "") }
      .replace(Regex("<#(\\d+)>")) { "#" + (state?.channels?.get(it.groupValues[1])?.name ?: "") }
      .replace(Regex("<a?:(\\w+):\\d+>"), ":$1:")
      .trim()
  if (content.isNotEmpty()) return content
  message.attachments.firstOrNull()?.let { attachment ->
    val type = attachment.content_type ?: ""
    return account.string(
      when {
        type.startsWith("image/") -> "previewImage"
        type.startsWith("video/") -> "previewVideo"
        type.startsWith("audio/") -> "previewAudio"
        else -> "previewFile"
      }
    )
  }
  if (message.message_snapshots.isNotEmpty()) return account.string("previewForwarded")
  message.sticker_items.firstOrNull()?.let { return it.name?.takeIf { name -> name.isNotEmpty() } ?: account.string("previewSticker") }
  message.embeds.firstOrNull()?.let { embed ->
    return embedText(embed)?.let { maskSpoilers(it, account).trim() }?.takeIf { it.isNotEmpty() } ?: account.string("previewEmbed")
  }
  return ""
}

private fun maskSpoilers(text: String, account: AccountConfig): String =
  text.replace(Regex("\\|\\|(.+?)\\|\\|", RegexOption.DOT_MATCHES_ALL)) { account.string("spoiler") }

/** getContentlessNotificationBody (NotificationTextUtils): "title description", either alone, else the first field. */
private fun embedText(embed: RawEmbed): String? {
  val title = embed.title?.takeIf { it.isNotBlank() }
  val description = embed.description?.takeIf { it.isNotBlank() }
  if (description != null) return title?.let { "$it $description" } ?: description
  if (title != null) return title
  return embed.fields.firstOrNull()?.let { "${it.name} ${it.value}" }
}

/** The first image attachment that isn't a spoiler, asked of the media proxy at a small size. */
private fun imagePreview(message: RawMessage): ImagePreview? {
  val image =
    message.attachments.firstOrNull {
      it.content_type?.startsWith("image/") == true &&
        it.flags and AttachmentSpoiler.FLAG == 0 &&
        !it.filename.startsWith(AttachmentSpoiler.FILENAME_PREFIX) &&
        it.proxy_url != null
    } ?: return null
  val width = image.width ?: PREVIEW_MAX_PX
  val height = image.height ?: PREVIEW_MAX_PX
  val scale = minOf(1.0, PREVIEW_MAX_PX.toDouble() / maxOf(width, height, 1))
  val separator = if (image.proxy_url!!.contains('?')) '&' else '?'
  val url =
    "${image.proxy_url}${separator}format=webp&width=${(width * scale).toInt().coerceAtLeast(1)}" +
      "&height=${(height * scale).toInt().coerceAtLeast(1)}"
  return ImagePreview(image.id, url)
}

/** What isn't a message, by the NOTIF_SETTINGS channel it goes to and the toggle that turns it off. */
object AlertKind {
  const val CALL = "call"
  const val FRIEND_REQUEST = "friendRequest"
  const val FRIEND_ACCEPTED = "friendAccepted"
  const val REACTION = "reaction"
  const val FORUM_POST = "forumPost"
  const val EVENT = "event"
}

/** An alert's notification tag, by what it is about. One alert per tag, replaced in place. */
object AlertTag {
  fun call(channelId: String) = "call:$channelId"

  fun friend(userId: String) = "friend:$userId"

  fun reaction(messageId: String) = "reaction:$messageId"

  fun forum(threadId: String) = "forum:$threadId"

  fun event(eventId: String) = "event:$eventId"
}

/** A message, by its channel. */
class MessageRef(val channelId: String, val messageId: String)

/** A scheduled event, by its guild. */
class EventRef(val guildId: String, val eventId: String)

/** A notification that isn't a message: a call, friend request, reaction, forum post, starting event. */
class Alert(
  val kind: String,
  /** [AlertTag]. */
  val tag: String,
  val title: String,
  val text: String = "",
  val subText: String? = null,
  /** A round avatar beside the text. */
  val iconUrl: String? = null,
  /** What a tap opens, an `isocord://channel/…` link; the app as it was when null. */
  val link: String? = null,
  /** Calls: the channel whose ringing Decline stops. */
  val channelId: String? = null,
  /** Friend requests: whose request Accept and Ignore answer. */
  val userId: String? = null,
  /** Reactions: the message whose text is fetched and put after `text`. */
  val previewOf: MessageRef? = null,
  /** Events: posted only if the account is interested in the event. */
  val interestIn: EventRef? = null,
)

/** CALL_CREATE / CALL_UPDATE ringing the account: "Incoming call" from the caller or the group. */
fun callAlert(call: CallEvent, channel: ChannelInfo, state: NotificationState, account: AccountConfig): Alert {
  val caller = call.voice_states.firstOrNull { it.user_id != state.selfId }?.user_id?.let { state.users[it] }
  return Alert(
    kind = AlertKind.CALL,
    tag = AlertTag.call(channel.id),
    title = title(channel, state, null, account) ?: caller?.name ?: "",
    text = account.string("incomingCall"),
    iconUrl = caller?.let { avatarUrl(it.id, it.avatar, it.discriminator) },
    link = Links.channel(null, channel.id),
    channelId = channel.id,
  )
}

/** RELATIONSHIP_ADD: an incoming request, or an outgoing one that became a friend. */
fun friendAlert(user: UserInfo, accepted: Boolean, account: AccountConfig) =
  Alert(
    kind = if (accepted) AlertKind.FRIEND_ACCEPTED else AlertKind.FRIEND_REQUEST,
    tag = AlertTag.friend(user.id),
    title = user.name,
    text = account.string(if (accepted) "friendAccepted" else "friendRequest").replace("{username}", user.name),
    iconUrl = avatarUrl(user.id, user.avatar, user.discriminator),
    userId = if (accepted) null else user.id,
  )

/**
 * ReactionNotification's "Reacted {emoji} to you:" plus the message, under the reactor's name and the message's place.
 * The reference words it by content (image, file). Here the message's text or label stands in.
 */
fun reactionAlert(event: ReactionAdd, channel: ChannelInfo, state: NotificationState, account: AccountConfig): Alert {
  val reactor = event.member?.user ?: state.users[event.user_id]?.let { RawUser(it.id, it.name, null, it.avatar, it.discriminator) }
  val name = event.member?.nick ?: reactor?.global_name ?: reactor?.username ?: ""
  val emoji = if (event.emoji.id != null) ":${event.emoji.name}:" else event.emoji.name ?: ""
  val guild = channel.guildId?.let { state.guilds[it] }
  return Alert(
    kind = AlertKind.REACTION,
    tag = AlertTag.reaction(event.message_id),
    title = name,
    text = account.string("reacted").replace("{emoji}", emoji),
    subText = title(channel, state, guild, account),
    iconUrl = reactor?.let { avatarUrl(it.id, it.avatar, it.discriminator) },
    link = Links.channel(channel.guildId, channel.id, event.message_id),
    previewOf = MessageRef(channel.id, event.message_id),
  )
}

/** THREAD_CREATE of a new post: its title, under "#forum, server". */
fun forumAlert(thread: RawChannel, forum: ChannelInfo, state: NotificationState, account: AccountConfig) =
  Alert(
    kind = AlertKind.FORUM_POST,
    tag = AlertTag.forum(thread.id),
    title = thread.name ?: "",
    text = title(forum, state, forum.guildId?.let { state.guilds[it] }, account) ?: "",
    // getIconUrl for FORUM_THREAD_CREATED: the server icon.
    iconUrl = forum.guildId?.let { guildIconUrl(it, state.guilds[it]?.icon) },
    link = Links.channel(forum.guildId, thread.id),
  )

/** GUILD_SCHEDULED_EVENT_UPDATE to active: "Happening Now", for the events the account is interested in. */
fun eventAlert(event: ScheduledEvent, state: NotificationState, account: AccountConfig) =
  Alert(
    kind = AlertKind.EVENT,
    tag = AlertTag.event(event.id),
    title = event.name,
    text = account.string("happeningNow"),
    subText = state.guilds[event.guild_id]?.name,
    link = event.channel_id?.let { Links.channel(event.guild_id, it) },
    interestIn = EventRef(event.guild_id, event.id),
  )
