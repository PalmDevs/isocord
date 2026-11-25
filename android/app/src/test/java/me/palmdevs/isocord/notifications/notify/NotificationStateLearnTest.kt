package me.palmdevs.isocord.notifications.notify

import me.palmdevs.isocord.network.ChannelType
import me.palmdevs.isocord.network.NotificationLevel
import me.palmdevs.isocord.notifications.gateway.RawChannel
import me.palmdevs.isocord.notifications.gateway.ScheduledEventUser
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

private const val GUILD = "g"

// NotificationState.learn keeps the guild settings JS marks unchanged and replaces or drops the rest.
class NotificationStateLearnTest {
  private val muted = GuildSettings(mute = Mute(null), suppressEveryone = false, suppressRoles = false)

  private fun learn(state: NotificationState, settings: GuildSettings?, unchanged: Boolean) =
    state.learn(DispatchContext(guildId = GUILD, settings = settings, settingsUnchanged = unchanged))

  @Test
  fun unchangedSettingsStay() {
    val state = NotificationState("me")
    learn(state, muted, unchanged = false)
    learn(state, null, unchanged = true)
    assertTrue(state.guildMuted(GUILD))
  }

  // READY's context has no channel and no guild: the direct messages' settings, learned once, stay for the DM that follows.
  @Test
  fun directMessageSettingsLearnedWithoutChannelStay() {
    val state = NotificationState("me")
    val dm = ChannelInfo(id = "dm", type = ChannelType.DM, name = null, guildId = null, parentId = null, recipientIds = emptyList())
    val settings =
      GuildSettings(suppressEveryone = false, suppressRoles = false, channelMutes = mapOf("dm" to Mute(null)))
    state.learn(DispatchContext(settings = settings))
    state.learn(DispatchContext(channel = null, settingsUnchanged = true))
    assertTrue(state.muted(dm))
  }

  @Test
  fun absentSettingsAreDropped() {
    val state = NotificationState("me")
    learn(state, muted, unchanged = false)
    learn(state, null, unchanged = false)
    assertFalse(state.guildMuted(GUILD))
  }

  @Test
  fun forumPostNotifiesWhenAllMessages() {
    val state = NotificationState("me")
    state.onChannel(RawChannel(id = "forum", type = ChannelType.GUILD_FORUM, guild_id = GUILD))
    state.learn(
      DispatchContext(
        guildId = GUILD,
        guild = GuildInfo(name = "Guild", defaultNotifications = NotificationLevel.ALL_MESSAGES, myRoles = emptySet(), roleNames = emptyMap()),
      )
    )
    assertTrue(
      state.forumPostNotifies(
        RawChannel(id = "post", type = ChannelType.PUBLIC_THREAD, guild_id = GUILD, parent_id = "forum", newly_created = true, owner_id = "other")
      )
    )
    assertFalse(
      state.forumPostNotifies(
        RawChannel(id = "own", type = ChannelType.PUBLIC_THREAD, guild_id = GUILD, parent_id = "forum", newly_created = true, owner_id = "me")
      )
    )
  }

  @Test
  fun eventInterestTracksSelfOnly() {
    val state = NotificationState("me")
    state.onEventUser(ScheduledEventUser(guild_scheduled_event_id = "ev1", user_id = "other"), added = true)
    assertFalse(state.isInterestedInEvent("ev1"))
    state.onEventUser(ScheduledEventUser(guild_scheduled_event_id = "ev1", user_id = "me"), added = true)
    assertTrue(state.isInterestedInEvent("ev1"))
    state.onEventUser(ScheduledEventUser(guild_scheduled_event_id = "ev1", user_id = "me"), added = false)
    assertFalse(state.isInterestedInEvent("ev1"))
  }
}
