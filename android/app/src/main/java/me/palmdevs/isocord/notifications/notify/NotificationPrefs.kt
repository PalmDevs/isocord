package me.palmdevs.isocord.notifications.notify

import android.content.Context
import android.util.Base64
import android.util.Log
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import me.palmdevs.isocord.core.AppJson
import me.palmdevs.isocord.core.decodeOrNull

private const val TAG = "IsocordNotifyPrefs"

/**
 * What the background connection needs of the current account, written by JS (`configure`) whenever a session
 * starts, so the service can reconnect without JS after a reboot or after the system restarts it.
 */
@Serializable
data class AccountConfig(
  val userId: String,
  val token: String,
  val capabilities: Long,
  /** IDENTIFY's `properties`, as JSON: the account's super properties as the app is in the background. */
  val properties: String,
  /** The account headers of REST calls made from a notification (reply, mark as read), built by JS. */
  val headers: Map<String, String> = emptyMap(),
  /** The UI text of the notifications, already translated by JS (`t()`), by key. */
  val strings: Map<String, String>,
) {
  /**
   * Returns [headers], or for a config saved before JS sent them (an update before the app is opened) the token and
   * the super properties, which serve Reply and Mark as read.
   */
  fun requestHeaders(): Map<String, String> =
    headers.ifEmpty {
      mapOf("Authorization" to token, "X-Super-Properties" to Base64.encodeToString(properties.toByteArray(), Base64.NO_WRAP))
    }

  /** Returns the text under `key`, or "" with a warning when JS sent none. */
  fun string(key: String): String =
    strings[key]
      ?: run {
        Log.w(TAG, "missing string: $key")
        ""
      }
}

/**
 * The kinds of notification that can be turned off one by one, under "Notify me about" (the NOTIF_SETTINGS the
 * official app lists by category).
 */
object NotificationKind {
  const val CALLS = "calls"
  const val DIRECT_MESSAGES = "directMessages"
  const val FRIEND_REQUESTS = "friendRequests"
  const val REACTIONS = "reactions"
  const val MESSAGES = "messages"
  const val FORUM_POSTS = "forumPosts"
  const val EVENTS = "events"
  const val SYSTEM_MESSAGES = "systemMessages"

  /** Every kind, in the order the settings list them. */
  val ALL = listOf(CALLS, DIRECT_MESSAGES, FRIEND_REQUESTS, REACTIONS, MESSAGES, FORUM_POSTS, EVENTS, SYSTEM_MESSAGES)
}

/** App-private storage of the background notification settings and the account they run for. */
object NotificationPrefs {
  private const val FILE = "isocord.notifications"
  private const val ENABLED = "enabled"
  private const val EVERY_MESSAGE = "everyMessage"
  private const val ACCOUNT = "account"

  private fun prefs(context: Context) = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)

  /** "Get notifications outside of Discord." (SystemNotificationsSetting). Off until turned on. */
  fun enabled(context: Context) = prefs(context).getBoolean(ENABLED, false)

  fun setEnabled(context: Context, value: Boolean) = prefs(context).edit().putBoolean(ENABLED, value).apply()

  /** AndroidMessageNotificationsSetting, "Notify on every new message in conversations"; off by default as there. */
  fun everyMessage(context: Context) = prefs(context).getBoolean(EVERY_MESSAGE, false)

  fun setEveryMessage(context: Context, value: Boolean) = prefs(context).edit().putBoolean(EVERY_MESSAGE, value).apply()

  /** On unless turned off. */
  fun kindEnabled(context: Context, kind: String) = prefs(context).getBoolean("kind.$kind", true)

  fun setKindEnabled(context: Context, kind: String, value: Boolean) =
    prefs(context).edit().putBoolean("kind.$kind", value).apply()

  fun account(context: Context): AccountConfig? =
    prefs(context).getString(ACCOUNT, null)?.let { decodeOrNull(AccountConfig.serializer(), it) }

  fun setAccount(context: Context, account: AccountConfig?) {
    val editor = prefs(context).edit()
    if (account == null) editor.remove(ACCOUNT) else editor.putString(ACCOUNT, AppJson.encodeToString(account))
    editor.apply()
  }
}
