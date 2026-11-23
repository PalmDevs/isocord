package me.palmdevs.isocord.notifications.notify

import android.content.Context
import kotlinx.serialization.Serializable
import me.palmdevs.isocord.notifications.Handover
import me.palmdevs.isocord.notifications.gateway.GatewayDispatch
import me.palmdevs.isocord.notifications.gateway.RawChannel
import me.palmdevs.isocord.notifications.gateway.RawRelationship
import me.palmdevs.isocord.notifications.gateway.RawUser

/**
 * What the app's stores know around a dispatch JS forwards (src/features/systemNotifications/forward.ts). The app's
 * READY may be partial or cached, so JS sends the facts each decision needs instead.
 */
@Serializable
class DispatchContext(
  val channel: RawChannel? = null,
  /** The category, or a thread's channel. */
  val parent: RawChannel? = null,
  /** The channels the message text mentions, for its preview. */
  val mentionedChannels: List<RawChannel> = emptyList(),
  /** Null outside a server. */
  val guildId: String? = null,
  val guild: GuildInfo? = null,
  /** JS sent this guild before and it is unchanged: [guild] is left out and what is held stays. */
  val guildUnchanged: Boolean = false,
  /** The account's settings for [guildId], or for direct messages. */
  val settings: GuildSettings? = null,
  /** Likewise for [settings]. */
  val settingsUnchanged: Boolean = false,
  /** Group DM recipients, the caller, the reactor, the new friend. */
  val users: List<RawUser> = emptyList(),
  /** The account's status. */
  val status: String? = null,
)

/** READY as the app forwards it: only the relationships, to tell an accepted request. */
@Serializable
private class ReadyRelationships(val relationships: List<RawRelationship> = emptyList())

/**
 * The app's own gateway session while in front. JS forwards its dispatches, and the background session's rules decide
 * them ([SessionNotifier]). Used from the native modules thread only, where [NotificationsModule.dispatch] runs.
 */
class AppSession(context: Context, @Volatile var account: AccountConfig) {
  private val state = NotificationState(account.userId)
  private val notifier = SessionNotifier(context, inApp = true)

  /** `event` is the dispatch's `d` as JSON. Returns whether a MESSAGE_CREATE notifies. */
  fun dispatch(type: String, event: String, context: DispatchContext): Boolean {
    val dispatch = GatewayDispatch.ofPayload(type, event)
    // Every context is learned, READY and RESUMED included: JS sends a guild or settings object only once.
    state.learn(context)
    if (type == "READY" || type == "RESUMED") {
      Handover.shared.appSettled()
      if (type == "READY") state.onRelationships(dispatch.decode(ReadyRelationships.serializer()).relationships)
      return false
    }
    return notifier.onDispatch(dispatch, state, account)
  }
}
