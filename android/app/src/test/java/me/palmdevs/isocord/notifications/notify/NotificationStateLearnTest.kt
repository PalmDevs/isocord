package me.palmdevs.isocord.notifications.notify

import me.palmdevs.isocord.network.ChannelType
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
}
