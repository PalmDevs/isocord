package me.palmdevs.isocord.notifications.notify

import kotlinx.serialization.Serializable
import me.palmdevs.isocord.network.ChannelNotificationFlags
import me.palmdevs.isocord.network.GuildNotificationFlags
import me.palmdevs.isocord.network.NotificationLevel
import me.palmdevs.isocord.notifications.gateway.RawMessage

/** A mute that lasts until `end` (ms), or for good when null. */
@Serializable
class Mute(val end: Long?) {
  /** MuteTimers.computeIsMuted: muted until the end time, included. */
  fun active(now: Long) = end == null || end >= now
}

/**
 * The account's notification settings for one guild, or for direct messages. The rules here are the Notify policy
 * (GLOSSARY.md). They take the clock as an argument and touch no Android classes.
 */
@Serializable
class GuildSettings(
  val mute: Mute? = null,
  val suppressEveryone: Boolean,
  val suppressRoles: Boolean,
  val level: Int? = null,
  val channelMutes: Map<String, Mute> = emptyMap(),
  val channelLevels: Map<String, Int> = emptyMap(),
  /** GuildNotificationFlags. */
  val flags: Int = 0,
  /** ChannelNotificationFlags of the channels and categories that have any. */
  val channelFlags: Map<String, Int> = emptyMap(),
) {
  /** UserGuildSettingsStore.isMuted: the guild's own mute. */
  fun guildMuted(now: Long) = mute?.active(now) == true

  /** UserGuildSettingsStore.isChannelMuted: the channel's or category's own mute. */
  fun channelMuted(id: String, now: Long) = channelMutes[id]?.active(now) == true

  /**
   * UserGuildSettingsStore.isGuildOrCategoryOrChannelMuted. The parent is a channel's category or a thread's channel.
   * A private channel has only its own mute.
   */
  fun muted(channel: ChannelInfo, now: Long): Boolean {
    if (channelMuted(channel.id, now)) return true
    if (channel.isPrivate) return false
    return guildMuted(now) || (channel.parentId != null && channelMuted(channel.parentId, now))
  }

  /** UserGuildSettingsStore.isOptInEnabled: the server shows only the channels the user picked. */
  val optInEnabled get() = flags and GuildNotificationFlags.OPT_IN_CHANNELS_ON != 0

  /** UserGuildSettingsStore.isChannelRecordOrParentOptedIn: the channel, or the category it is in. */
  fun optedIn(channel: ChannelInfo): Boolean {
    fun picked(id: String?) = id != null && (channelFlags[id] ?: 0) and ChannelNotificationFlags.OPT_IN_ENABLED != 0
    return picked(channel.id) || picked(channel.parentId)
  }

  /**
   * UserGuildSettingsStore.allowNoMessages' opt-in part: in a server with opt-in channels, a channel the user didn't
   * pick, itself or by its parent, never notifies.
   */
  fun optedOut(channel: ChannelInfo) = optInEnabled && !optedIn(channel)
}

/**
 * UserGuildSettingsStore.resolvedMessageNotifications: the channel's level, else its parent's, else the guild's.
 * Where the guild's is unset the server's default applies, and all messages when the guild is unknown.
 */
fun GuildSettings?.resolvedLevel(channel: ChannelInfo, guildDefault: Int?): Int {
  this?.channelLevels?.get(channel.id)?.let { return it }
  channel.parentId?.let { parent -> this?.channelLevels?.get(parent)?.let { return it } }
  val level = this?.level
  return if (level == null || level == NotificationLevel.NULL) guildDefault ?: NotificationLevel.ALL_MESSAGES else level
}

/** isRawMessageMentioned: mentions the account, or @everyone or one of its roles where the guild doesn't suppress them. */
fun GuildSettings?.mentioned(message: RawMessage, selfId: String, myRoles: Set<String>): Boolean {
  if (message.mentions.any { it.id == selfId }) return true
  if (message.mention_everyone && this?.suppressEveryone != true) return true
  return this?.suppressRoles != true && message.mention_roles.any { it in myRoles }
}
