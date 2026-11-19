package me.palmdevs.isocord.notifications.notify

import java.io.File
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import me.palmdevs.isocord.network.ChannelType
import me.palmdevs.isocord.notifications.gateway.RawMessage
import me.palmdevs.isocord.notifications.gateway.RawUser
import org.junit.Assert.assertEquals
import org.junit.Test

// Runs the vectors shared with the Unread policy (src/stores/unreadPolicy.test.ts) against the Notify policy rules in
// GuildSettings.kt. Unit tests run in the module directory.

private val VECTORS = File("../../test-vectors/notification-policy")

/** Discord's channel type for a text channel in a server. */
private const val GUILD_TEXT = 0

private const val VECTOR_GUILD = "g"

class NotificationPolicyVectorsTest {
  private fun cases(file: String): List<JsonObject> =
    Json.parseToJsonElement(File(VECTORS, file).readText()).jsonObject.getValue("cases").jsonArray.map { it.jsonObject }

  private fun JsonElement.orNull(): JsonElement? = takeUnless { it is kotlinx.serialization.json.JsonNull }

  private fun mute(element: JsonElement) = Mute(element.jsonObject.getValue("end").orNull()?.jsonPrimitive?.long)

  private fun settings(element: JsonElement?): GuildSettings? {
    val json = element?.orNull()?.jsonObject ?: return null
    return GuildSettings(
      mute = json.getValue("mute").orNull()?.let(::mute),
      suppressEveryone = json.getValue("suppressEveryone").jsonPrimitive.boolean,
      suppressRoles = json.getValue("suppressRoles").jsonPrimitive.boolean,
      level = json.getValue("level").orNull()?.jsonPrimitive?.int,
      channelMutes = json.getValue("channelMutes").jsonObject.mapValues { mute(it.value) },
      channelLevels = json.getValue("channelLevels").jsonObject.mapValues { it.value.jsonPrimitive.int },
      flags = json.getValue("flags").jsonPrimitive.int,
      channelFlags = json.getValue("channelFlags").jsonObject.mapValues { it.value.jsonPrimitive.int },
    )
  }

  private fun channel(element: JsonElement): ChannelInfo {
    val json = element.jsonObject
    val guildId = json.getValue("guildId").orNull()?.jsonPrimitive?.content
    return ChannelInfo(
      id = json.getValue("id").jsonPrimitive.content,
      type = if (guildId == null) ChannelType.DM else GUILD_TEXT,
      name = null,
      guildId = guildId,
      parentId = json.getValue("parentId").orNull()?.jsonPrimitive?.content,
      recipientIds = emptyList(),
    )
  }

  private fun JsonObject.expect(key: String) = get(key)?.jsonPrimitive

  @Test
  fun mute() {
    for (case in cases("mute.json")) {
      val name = case.getValue("name").jsonPrimitive.content
      val now = case.getValue("now").jsonPrimitive.long
      val channel = channel(case.getValue("channel"))
      val settings = settings(case["settings"]) ?: GuildSettings(suppressEveryone = false, suppressRoles = false)
      val expect = case.getValue("expect").jsonObject
      assertEquals(name, expect.expect("muted")?.boolean, settings.muted(channel, now))
      expect.expect("guildMuted")?.let { assertEquals(name, it.boolean, settings.guildMuted(now)) }
      expect.expect("channelMuted")?.let { assertEquals(name, it.boolean, settings.channelMuted(channel.id, now)) }
    }
  }

  @Test
  fun level() {
    for (case in cases("level.json")) {
      val name = case.getValue("name").jsonPrimitive.content
      val guildDefault = case.getValue("guildDefault").orNull()?.jsonPrimitive?.int
      val expected = case.getValue("expect").jsonObject.getValue("level").jsonPrimitive.int
      val channel = channel(case.getValue("channel"))
      assertEquals(name, expected, settings(case["settings"]).resolvedLevel(channel, guildDefault))
    }
  }

  @Test
  fun optIn() {
    for (case in cases("optin.json")) {
      val name = case.getValue("name").jsonPrimitive.content
      val expect = case.getValue("expect").jsonObject
      val settings = settings(case["settings"])!!
      assertEquals(name, expect.expect("optInEnabled")?.boolean, settings.optInEnabled)
      assertEquals(name, expect.expect("channelOrParentOptedIn")?.boolean, settings.optedIn(channel(case.getValue("channel"))))
    }
  }

  @Test
  fun mentioned() {
    for (case in cases("mentioned.json")) {
      val name = case.getValue("name").jsonPrimitive.content
      val json = case.getValue("message").jsonObject
      val me = case.getValue("me").jsonObject
      val message =
        RawMessage(
          id = "1",
          channel_id = "c",
          author = RawUser("author"),
          mentions = json.getValue("mentions").jsonArray.map { RawUser(it.jsonPrimitive.content) },
          mention_roles = json.getValue("mentionRoles").jsonArray.map { it.jsonPrimitive.content },
          mention_everyone = json.getValue("mentionEveryone").jsonPrimitive.boolean,
        )
      val roles = me.getValue("roles").jsonArray.map { it.jsonPrimitive.content }.toSet()
      val expected = case.getValue("expect").jsonObject.expect("mentioned")?.boolean
      assertEquals(name, expected, settings(case["settings"]).mentioned(message, me.getValue("id").jsonPrimitive.content, roles))
    }
  }
}
