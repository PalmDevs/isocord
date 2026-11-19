package me.palmdevs.isocord.notifications.notify

import me.palmdevs.isocord.network.Permission
import me.palmdevs.isocord.notifications.gateway.RawOverwrite

// The account's permissions in a channel, as src/core/discord/permissions.ts and src/stores/permissions.ts work them
// out. The background session has no app stores to ask.

/**
 * Returns whether the account may send in a channel (canSendMessages). Private channels, and a server not known yet,
 * allow it, as DM_PERMISSIONS does. A thread takes its parent's overwrites.
 */
fun NotificationState.canSend(channel: ChannelInfo): Boolean {
  if (channel.isPrivate) return true
  val guildId = channel.guildId ?: return true
  val guild = guilds[guildId] ?: return true
  val source = if (channel.isThread) channel.parentId?.let { channels[it] } ?: channel else channel
  val permissions = permissions(guildId, guild, source, selfId)
  if (permissions and Permission.VIEW_CHANNEL == 0L) return false
  if (channel.isThread) {
    if (channel.locked && permissions and Permission.MANAGE_THREADS == 0L) return false
    return permissions and Permission.SEND_MESSAGES_IN_THREADS != 0L
  }
  return permissions and Permission.SEND_MESSAGES != 0L
}

/** Returns computePermissions: the roles' bits, then @everyone's, the roles' and the member's overwrites. */
private fun permissions(guildId: String, guild: GuildInfo, channel: ChannelInfo, userId: String): Long {
  if (guild.ownerId == userId) return Permission.ALL
  fun role(id: String) = bits(guild.rolePermissions[id])
  var permissions = guild.myRoles.fold(role(guildId)) { all, id -> all or role(id) }
  if (permissions and Permission.ADMINISTRATOR != 0L) return Permission.ALL
  var allow = 0L
  var deny = 0L
  var member: RawOverwrite? = null
  for (overwrite in channel.overwrites) {
    when (overwrite.id) {
      // @everyone's applies first, before the union of the roles'.
      guildId -> permissions = (permissions and bits(overwrite.deny).inv()) or bits(overwrite.allow)
      userId -> member = overwrite
      in guild.myRoles -> {
        allow = allow or bits(overwrite.allow)
        deny = deny or bits(overwrite.deny)
      }
    }
  }
  permissions = (permissions and deny.inv()) or allow
  member?.let { permissions = (permissions and bits(it.deny).inv()) or bits(it.allow) }
  return permissions
}

/** Permission bits from their decimal string. Unsigned, so bit 63 parses too. */
private fun bits(value: String?): Long = value?.toULongOrNull()?.toLong() ?: 0L
