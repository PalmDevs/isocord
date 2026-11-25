package me.palmdevs.isocord.notifications.notify

import android.util.Log
import java.text.ParseException
import java.text.SimpleDateFormat
import java.util.Locale
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import me.palmdevs.isocord.core.decodeOrNull
import me.palmdevs.isocord.network.ChannelType
import me.palmdevs.isocord.network.MessageFlags
import me.palmdevs.isocord.network.MessageType
import me.palmdevs.isocord.network.NotificationLevel
import me.palmdevs.isocord.network.Status
import me.palmdevs.isocord.notifications.gateway.MemberUpdate
import me.palmdevs.isocord.notifications.gateway.RawChannel
import me.palmdevs.isocord.notifications.gateway.RawChannelOverride
import me.palmdevs.isocord.notifications.gateway.RawGuild
import me.palmdevs.isocord.notifications.gateway.RawGuildSettings
import me.palmdevs.isocord.notifications.gateway.RawMember
import me.palmdevs.isocord.notifications.gateway.RawMessage
import me.palmdevs.isocord.notifications.gateway.RawMuteConfig
import me.palmdevs.isocord.notifications.gateway.RawOverwrite
import me.palmdevs.isocord.notifications.gateway.RawRelationship
import me.palmdevs.isocord.notifications.gateway.RawSession
import me.palmdevs.isocord.notifications.gateway.RawUser
import me.palmdevs.isocord.notifications.gateway.Ready
import me.palmdevs.isocord.notifications.gateway.RoleEvent
import me.palmdevs.isocord.notifications.gateway.ScheduledEventUser

private const val TAG = "IsocordNotifyState"

/** The types drawn as a message. System messages never notify. */
private val MESSAGE_TYPES = setOf(MessageType.DEFAULT, MessageType.REPLY, MessageType.CHAT_INPUT_COMMAND)

class ChannelInfo(
  val id: String,
  val type: Int,
  val name: String?,
  val guildId: String?,
  val parentId: String?,
  val recipientIds: List<String>,
  /** A group DM's icon hash. */
  val icon: String? = null,
  val overwrites: List<RawOverwrite> = emptyList(),
  /** A locked thread, where only moderators send. */
  val locked: Boolean = false,
) {
  val isPrivate get() = type == ChannelType.DM || type == ChannelType.GROUP_DM
  val isThread get() = type in ChannelType.THREADS
}

@Serializable
data class GuildInfo(
  val name: String,
  val defaultNotifications: Int?,
  val myRoles: Set<String>,
  /** For role mentions in the message text. */
  val roleNames: Map<String, String>,
  /** The icon hash, for the conversation icon. */
  val icon: String? = null,
  val ownerId: String? = null,
  /** Each role's permission bits, as decimal strings. */
  val rolePermissions: Map<String, String> = emptyMap(),
)

class UserInfo(val id: String, val name: String, val avatar: String?, val discriminator: String?)

/**
 * What the background session knows of the account: enough to decide whether a message notifies and to name its
 * conversation. Fed by one thread only: the background session's gateway thread, or JS for the app's session
 * ([AppSession]).
 */
class NotificationState(selfId: String = "") {
  var selfId = selfId
    private set
  var self: UserInfo? = null
    private set
  private var status: String? = null
  val guilds = HashMap<String, GuildInfo>()
  val channels = HashMap<String, ChannelInfo>()
  val users = HashMap<String, UserInfo>()
  /** RelationshipType by user id. */
  private val relationships = HashMap<String, Int>()
  /** By guild id, null for direct messages. */
  private val guildSettings = HashMap<String?, GuildSettings>()
  /** Events the account has marked Interested during this session. */
  private val interestedEvents = HashSet<String>()

  fun onReady(ready: Ready) {
    guilds.clear()
    channels.clear()
    users.clear()
    guildSettings.clear()
    interestedEvents.clear()
    selfId = ready.user.id
    self = user(ready.user)
    for (raw in ready.users) users[raw.id] = user(raw)
    ready.guilds.forEachIndexed { index, guild -> onGuild(guild, ready.merged_members.getOrNull(index)) }
    for (channel in ready.private_channels) onChannel(channel)
    for (entry in ready.user_guild_settings?.entries.orEmpty()) onGuildSettings(entry)
    onSessions(ready.sessions)
    onRelationships(ready.relationships)
  }

  /** READY's relationships, replacing those known. */
  fun onRelationships(list: List<RawRelationship>) {
    relationships.clear()
    for (relationship in list) onRelationship(relationship)
  }

  /** RELATIONSHIP_ADD and RELATIONSHIP_UPDATE. Returns the type the user had before. */
  fun onRelationship(raw: RawRelationship): Int? {
    raw.user?.let { users[it.id] = user(it) }
    return relationships.put(raw.id, raw.type)
  }

  fun onRelationshipRemove(id: String) {
    relationships.remove(id)
  }

  /** Tracks the account's own scheduled-event RSVP changes. */
  fun onEventUser(event: ScheduledEventUser, added: Boolean) {
    if (event.user_id != selfId) return
    if (added) interestedEvents.add(event.guild_scheduled_event_id)
    else interestedEvents.remove(event.guild_scheduled_event_id)
  }

  fun isInterestedInEvent(eventId: String) = eventId in interestedEvents

  /** What the app's stores know around a dispatch JS forwards, in place of what they replace. */
  fun learn(context: DispatchContext) {
    for (raw in context.users) users[raw.id] = user(raw)
    for (raw in context.mentionedChannels) onChannel(raw)
    context.parent?.let { onChannel(it) }
    context.channel?.let { onChannel(it) }
    val guildId = context.guildId
    if (!context.guildUnchanged && guildId != null) {
      if (context.guild != null) guilds[guildId] = context.guild else guilds.remove(guildId)
    }
    if (!context.settingsUnchanged) {
      if (context.settings != null) guildSettings[guildId] = context.settings else guildSettings.remove(guildId)
    }
    status = context.status
  }

  /** Do Not Disturb: nothing notifies (the server holds back the official app's pushes too). */
  val dnd get() = status == Status.DND

  /** UserGuildSettingsStore.allowNoMessages, for what isn't a message: a muted channel, category or server. */
  fun muted(channel: ChannelInfo): Boolean {
    val settings = guildSettings[channel.guildId] ?: return false
    return settings.muted(channel, System.currentTimeMillis()) || (!channel.isPrivate && settings.optedOut(channel))
  }

  fun guildMuted(guildId: String) = guildSettings[guildId]?.guildMuted(System.currentTimeMillis()) == true

  /**
   * A new post in a forum or media channel set to notify on all messages, which is when Discord pushes "Forum
   * notifications" (the post's own messages notify as a thread's: on mentions).
   */
  fun forumPostNotifies(thread: RawChannel): Boolean {
    if (!thread.newly_created || thread.owner_id == selfId || dnd) return false
    val forum = channels[thread.parent_id ?: return false] ?: return false
    if (forum.type !in ChannelType.FORUMS || muted(forum)) return false
    val guild = forum.guildId?.let { guilds[it] } ?: return false
    return guildSettings[forum.guildId].resolvedLevel(forum, guild.defaultNotifications) == NotificationLevel.ALL_MESSAGES
  }

  /** READY, GUILD_CREATE and GUILD_UPDATE (which has no channels, so they are kept). */
  fun onGuild(raw: RawGuild, members: List<RawMember>? = raw.members) {
    if (raw.unavailable) return
    val previous = guilds[raw.id]
    val name = raw.properties?.name ?: raw.name ?: previous?.name ?: return
    val myRoles = members?.firstOrNull { (it.user_id ?: it.user?.id) == selfId }?.roles?.toSet()
    guilds[raw.id] =
      GuildInfo(
        name = name,
        defaultNotifications =
          raw.properties?.default_message_notifications ?: raw.default_message_notifications ?: previous?.defaultNotifications,
        myRoles = myRoles ?: previous?.myRoles ?: emptySet(),
        roleNames = raw.roles?.associate { it.id to it.name } ?: previous?.roleNames ?: emptyMap(),
        icon = if (raw.properties != null) raw.properties.icon else raw.icon,
        ownerId = raw.properties?.owner_id ?: raw.owner_id ?: previous?.ownerId,
        rolePermissions = raw.roles?.associate { it.id to it.permissions } ?: previous?.rolePermissions ?: emptyMap(),
      )
    for (channel in raw.channels.orEmpty()) onChannel(channel, raw.id)
    for (thread in raw.threads.orEmpty()) onChannel(thread, raw.id)
  }

  fun onGuildDelete(id: String) {
    guilds.remove(id)
    channels.values.removeAll { it.guildId == id }
  }

  fun onChannel(raw: RawChannel, guildId: String? = raw.guild_id) {
    for (recipient in raw.recipients.orEmpty()) users[recipient.id] = user(recipient)
    channels[raw.id] =
      ChannelInfo(
        id = raw.id,
        type = raw.type,
        name = raw.name,
        guildId = guildId,
        parentId = raw.parent_id,
        recipientIds = raw.recipient_ids ?: raw.recipients?.map { it.id }.orEmpty(),
        icon = raw.icon,
        overwrites = raw.permission_overwrites,
        locked = raw.thread_metadata?.locked == true,
      )
  }

  fun onChannelDelete(id: String) {
    channels.remove(id)
  }

  fun onMemberUpdate(update: MemberUpdate) {
    if (update.user.id != selfId) return
    val guild = guilds[update.guild_id] ?: return
    guilds[update.guild_id] = guild.copy(myRoles = update.roles.toSet())
  }

  /** GUILD_ROLE_CREATE, GUILD_ROLE_UPDATE and GUILD_ROLE_DELETE. */
  fun onRole(event: RoleEvent) {
    val guild = guilds[event.guild_id] ?: return
    val role = event.role
    guilds[event.guild_id] =
      if (role != null)
        guild.copy(roleNames = guild.roleNames + (role.id to role.name), rolePermissions = guild.rolePermissions + (role.id to role.permissions))
      else guild.copy(roleNames = guild.roleNames - event.role_id.orEmpty(), rolePermissions = guild.rolePermissions - event.role_id.orEmpty())
  }

  /** READY's `user_guild_settings` entries and USER_GUILD_SETTINGS_UPDATE: one guild's settings, replaced whole. */
  fun onGuildSettings(raw: RawGuildSettings) {
    fun decode(element: JsonElement) = decodeOrNull(RawChannelOverride.serializer(), element)
    // Keyed by channel id, the entries may leave `channel_id` out (parseGuildSettings in stores/settings.ts).
    val overrides =
      when (val value = raw.channel_overrides) {
        is JsonArray -> value.mapNotNull { element -> decode(element)?.let { o -> o.channel_id?.let { it to o } } }
        is JsonObject -> value.mapNotNull { (id, element) -> decode(element)?.let { (it.channel_id ?: id) to it } }
        else -> emptyList()
      }
    guildSettings[raw.guild_id] =
      GuildSettings(
        mute = mute(raw.muted, raw.mute_config),
        suppressEveryone = raw.suppress_everyone,
        suppressRoles = raw.suppress_roles,
        level = raw.message_notifications,
        channelMutes = overrides.mapNotNull { (id, o) -> mute(o.muted, o.mute_config)?.let { id to it } }.toMap(),
        channelLevels =
          overrides
            .mapNotNull { (id, o) -> o.message_notifications?.takeIf { it != NotificationLevel.NULL }?.let { id to it } }
            .toMap(),
        flags = raw.flags,
        channelFlags = overrides.filter { (_, o) -> o.flags != 0 }.associate { (id, o) -> id to o.flags },
      )
  }

  /** The first session is the account's combined status (PresenceStore's own presence, SESSIONS_REPLACE). */
  fun onSessions(sessions: List<RawSession>) {
    sessions.firstOrNull()?.status?.let { status = it }
  }

  /**
   * NotificationTextUtils.shouldNotify, for both sessions and the in-app notifications. The app checks the channel on
   * screen first (inAppNotifications/store.ts). Not checked yet: blocked users, message requests, focus mode, thread
   * notification settings.
   */
  fun shouldNotify(message: RawMessage, channel: ChannelInfo): Boolean {
    if (message.author.id == selfId) return false
    if (message.flags and MessageFlags.SUPPRESS_NOTIFICATIONS != 0) return false
    if (message.type !in MESSAGE_TYPES) return false
    if (status == Status.DND) return false
    val settings = guildSettings[channel.guildId]
    if (settings?.channelMuted(channel.id, System.currentTimeMillis()) == true) return false
    if (channel.isPrivate) return true
    val guildId = channel.guildId ?: return false
    // UserGuildSettingsStore.allowNoMessages: a muted server, category or channel, an unpicked channel, or "Nothing".
    if (settings?.muted(channel, System.currentTimeMillis()) == true || settings?.optedOut(channel) == true) return false
    val guild = guilds[guildId]
    val level = settings.resolvedLevel(channel, guild?.defaultNotifications)
    if (level == NotificationLevel.NO_MESSAGES) return false
    if (level == NotificationLevel.ALL_MESSAGES && !channel.isThread) return true
    return settings.mentioned(message, selfId, guild?.myRoles.orEmpty())
  }

  fun user(raw: RawUser) =
    UserInfo(raw.id, raw.global_name ?: raw.username ?: "", raw.avatar, raw.discriminator)

  private fun mute(muted: Boolean, config: RawMuteConfig?): Mute? {
    if (!muted) return null
    val end = config?.end_time ?: return Mute(null)
    return Mute(parseTime(end) ?: return Mute(null))
  }

  private fun parseTime(iso: String): Long? =
    try {
      // Discord's times carry up to microseconds, which SimpleDateFormat can't read; the mute ends to the second.
      val trimmed = iso.replace(Regex("\\.\\d+"), "")
      SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.US).parse(trimmed)?.time
    } catch (e: ParseException) {
      Log.w(TAG, "bad mute end time: ${e.javaClass.simpleName}")
      null
    }
}
