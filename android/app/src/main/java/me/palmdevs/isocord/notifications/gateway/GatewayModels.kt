@file:Suppress("PropertyName")

package me.palmdevs.isocord.notifications.gateway

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive

// The parts of the gateway's payloads the notifications need. Everything else is skipped while decoding, so READY
// never becomes a tree in memory.

@Serializable
class Envelope(val op: Int, val s: Long? = null, val t: String? = null)

@Serializable
class Payload<T>(val d: T)

@Serializable
class Hello(val heartbeat_interval: Long)

@Serializable
class RawUser(
  val id: String,
  val username: String? = null,
  val global_name: String? = null,
  val avatar: String? = null,
  val discriminator: String? = null,
  /** Discord's own account, which sends the system messages. */
  val system: Boolean = false,
)

@Serializable
class RawMember(val user_id: String? = null, val user: RawUser? = null, val nick: String? = null, val roles: List<String> = emptyList())

@Serializable
class RawChannel(
  val id: String,
  val type: Int = 0,
  val name: String? = null,
  val guild_id: String? = null,
  val parent_id: String? = null,
  val recipient_ids: List<String>? = null,
  val recipients: List<RawUser>? = null,
  /** THREAD_CREATE: a thread just made, not one the session only now hears of. */
  val newly_created: Boolean = false,
  val owner_id: String? = null,
  /** A group DM's own icon hash. */
  val icon: String? = null,
  val permission_overwrites: List<RawOverwrite> = emptyList(),
  val thread_metadata: RawThreadMetadata? = null,
)

/** A channel's permission overwrite for a role or member. Bits as decimal strings. */
@Serializable
class RawOverwrite(val id: String, val allow: String = "0", val deny: String = "0")

@Serializable
class RawThreadMetadata(val locked: Boolean = false)

@Serializable
class RawRole(val id: String, val name: String = "", val permissions: String = "0")

/** GUILD_ROLE_CREATE and GUILD_ROLE_UPDATE carry the role, GUILD_ROLE_DELETE only its id. */
@Serializable
class RoleEvent(val guild_id: String, val role: RawRole? = null, val role_id: String? = null)

@Serializable
class RawGuildProperties(
  val name: String? = null,
  val default_message_notifications: Int? = null,
  val icon: String? = null,
  val owner_id: String? = null,
)

/** READY and GUILD_CREATE carry the guild's own fields under `properties`; GUILD_UPDATE carries them flat. */
@Serializable
class RawGuild(
  val id: String,
  val unavailable: Boolean = false,
  val properties: RawGuildProperties? = null,
  val name: String? = null,
  val default_message_notifications: Int? = null,
  val icon: String? = null,
  val owner_id: String? = null,
  val roles: List<RawRole>? = null,
  val channels: List<RawChannel>? = null,
  val threads: List<RawChannel>? = null,
  val members: List<RawMember>? = null,
)

@Serializable
class RawMuteConfig(val end_time: String? = null)

@Serializable
class RawChannelOverride(
  val channel_id: String? = null,
  val muted: Boolean = false,
  val mute_config: RawMuteConfig? = null,
  val message_notifications: Int? = null,
  val flags: Int = 0,
)

@Serializable
class RawGuildSettings(
  val guild_id: String? = null,
  val muted: Boolean = false,
  val mute_config: RawMuteConfig? = null,
  val suppress_everyone: Boolean = false,
  val suppress_roles: Boolean = false,
  val message_notifications: Int? = null,
  val flags: Int = 0,
  /** A list, or an object keyed by channel id. */
  val channel_overrides: JsonElement? = null,
)

@Serializable
class RawUserGuildSettings(val entries: List<RawGuildSettings> = emptyList(), val partial: Boolean = false)

@Serializable
class RawSession(val session_id: String? = null, val status: String? = null)

@Serializable
class RawReadState(
  val id: String,
  /** 0 for channels; other types track things Isocord does not notify about. */
  val read_state_type: Int = 0,
  /** A string, or the number 0 when nothing was read. */
  val last_message_id: JsonElement? = null,
) {
  fun lastMessageId(): String? = (last_message_id as? JsonPrimitive)?.content?.takeIf { it != "0" && it != "null" }
}

@Serializable
class RawReadStates(val entries: List<RawReadState> = emptyList())

/** RelationshipType: 1 friend, 2 blocked, 3 incoming request, 4 outgoing request. */
@Serializable
class RawRelationship(val id: String, val type: Int = 0, val user: RawUser? = null)

@Serializable
class Ready(
  val session_id: String,
  val resume_gateway_url: String? = null,
  val user: RawUser,
  val users: List<RawUser> = emptyList(),
  val guilds: List<RawGuild> = emptyList(),
  val merged_members: List<List<RawMember>> = emptyList(),
  val private_channels: List<RawChannel> = emptyList(),
  val user_guild_settings: RawUserGuildSettings? = null,
  val sessions: List<RawSession> = emptyList(),
  val read_state: RawReadStates? = null,
  val relationships: List<RawRelationship> = emptyList(),
)

@Serializable
class RawAttachment(
  val id: String,
  val filename: String = "",
  val content_type: String? = null,
  val proxy_url: String? = null,
  val width: Int? = null,
  val height: Int? = null,
  val flags: Int = 0,
)

@Serializable
class RawSticker(val name: String? = null)

@Serializable
class RawEmbedField(val name: String = "", val value: String = "")

@Serializable
class RawEmbed(val title: String? = null, val description: String? = null, val fields: List<RawEmbedField> = emptyList())

@Serializable
class RawMessage(
  val id: String,
  val channel_id: String,
  val guild_id: String? = null,
  val author: RawUser,
  val member: RawMember? = null,
  val content: String = "",
  val type: Int = 0,
  val flags: Int = 0,
  val mentions: List<RawUser> = emptyList(),
  val mention_roles: List<String> = emptyList(),
  val mention_everyone: Boolean = false,
  val attachments: List<RawAttachment> = emptyList(),
  val embeds: List<RawEmbed> = emptyList(),
  val sticker_items: List<RawSticker> = emptyList(),
  val message_snapshots: List<JsonElement> = emptyList(),
)

@Serializable
class MessageAck(val channel_id: String, val message_id: String)

@Serializable
class ChannelRef(val id: String, val guild_id: String? = null)

@Serializable
class ThreadListSync(val guild_id: String, val threads: List<RawChannel> = emptyList())

@Serializable
class MemberUpdate(val guild_id: String, val user: RawUser, val roles: List<String> = emptyList())

@Serializable
class RawVoiceState(val user_id: String)

/** CALL_CREATE and CALL_UPDATE: a DM or group DM call, and whom it is ringing. */
@Serializable
class CallEvent(val channel_id: String, val ringing: List<String> = emptyList(), val voice_states: List<RawVoiceState> = emptyList())

@Serializable
class RawEmoji(val id: String? = null, val name: String? = null)

@Serializable
class ReactionAdd(
  val user_id: String,
  val channel_id: String,
  val message_id: String,
  val guild_id: String? = null,
  val member: RawMember? = null,
  val emoji: RawEmoji,
  /** Who wrote the message reacted to. */
  val message_author_id: String? = null,
)

@Serializable
class ScheduledEvent(
  val id: String,
  val guild_id: String,
  val name: String = "",
  /** GuildScheduledEventStatus: 1 scheduled, 2 active, 3 completed, 4 canceled. */
  val status: Int = 0,
  val channel_id: String? = null,
)

/** GET /users/@me/scheduled-events: the events the account is interested in. */
@Serializable
class EventInterest(val guild_scheduled_event_id: String)

/** GUILD_SCHEDULED_EVENT_USER_ADD and _REMOVE: a user's RSVP change. */
@Serializable
class ScheduledEventUser(val guild_scheduled_event_id: String, val user_id: String, val guild_id: String? = null)
