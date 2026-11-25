package me.palmdevs.isocord.notifications.notify

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.RemoteInput
import com.facebook.react.modules.network.OkHttpClientProvider
import java.io.IOException
import kotlin.random.Random
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import me.palmdevs.isocord.network.ApiPath
import me.palmdevs.isocord.network.DISCORD_EPOCH
import me.palmdevs.isocord.network.Discord
import me.palmdevs.isocord.network.SNOWFLAKE_TIME_SHIFT
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

private const val TAG = "IsocordNotifyAction"

/**
 * The notification actions (NotificationActions in the official app): Reply, Mark As Read, and the dismiss swipe.
 * The official app hands Reply and Mark As Read to a headless JS task. Here Kotlin sends them, since JS may not run.
 */
class NotificationActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      DECLINE_CALL, ACCEPT_FRIEND, IGNORE_FRIEND -> return onAlertAction(context, intent)
    }
    val channelId = intent.getStringExtra(EXTRA_CHANNEL) ?: return
    val messageId = intent.getStringExtra(EXTRA_MESSAGE) ?: return
    when (intent.action) {
      DISMISS -> MessageNotifier.dismissed(context, channelId)
      MARK_READ -> {
        // Gone at once, like the official app's MarkAsReadAction; the server's MESSAGE_ACK follows.
        MessageNotifier.ack(context, channelId, messageId)
        val account = NotificationPrefs.account(context) ?: return
        val pending = goAsync()
        rest.launch {
          DiscordRest.post(account, ApiPath.messageAck(channelId, messageId), buildJsonObject { put("token", JsonNull) })
          pending.finish()
        }
      }
      REPLY -> {
        val text = RemoteInput.getResultsFromIntent(intent)?.getCharSequence(MessageNotifier.REPLY_KEY)?.toString()?.trim()
        val account = NotificationPrefs.account(context)
        if (text.isNullOrEmpty() || account == null) return MessageNotifier.refresh(context, channelId)
        val pending = goAsync()
        rest.launch {
          // The composer's body (send.ts): content, a nonce, no TTS.
          val nonce = nonce()
          val sent =
            DiscordRest.post(
              account,
              ApiPath.messages(channelId),
              buildJsonObject {
                put("content", text)
                put("nonce", nonce)
                put("tts", false)
              },
            )
          if (sent) MessageNotifier.addReply(context, channelId, nonce, text) else MessageNotifier.refresh(context, channelId)
          pending.finish()
        }
      }
    }
  }

  /**
   *   Decline (DismissCallAction: CallActionCreators.stopRinging), Accept (RelationshipActionCreators.acceptFriendRequest)
   *   and Ignore (cancelFriendRequest). The alert goes at once. The gateway's CALL_UPDATE or RELATIONSHIP_* event follows.
   */
  private fun onAlertAction(context: Context, intent: Intent) {
    val tag = intent.getStringExtra(EXTRA_TAG) ?: return
    val account = NotificationPrefs.account(context) ?: return
    MessageNotifier.cancelAlert(context, tag)
    val pending = goAsync()
    rest.launch {
      val channelId = intent.getStringExtra(EXTRA_CHANNEL)
      val userId = intent.getStringExtra(EXTRA_USER)
      when (intent.action) {
        DECLINE_CALL ->
          if (channelId != null)
            DiscordRest.post(
              account,
              ApiPath.stopRinging(channelId),
              buildJsonObject { put("recipients", buildJsonArray { add(account.userId) }) },
            )
        ACCEPT_FRIEND -> if (userId != null) DiscordRest.send(account, "PUT", ApiPath.relationship(userId), buildJsonObject {})
        IGNORE_FRIEND -> if (userId != null) DiscordRest.send(account, "DELETE", ApiPath.relationship(userId), null)
      }
      pending.finish()
    }
  }

  companion object {
    const val REPLY = "me.palmdevs.isocord.notifications.REPLY"
    const val DECLINE_CALL = "me.palmdevs.isocord.notifications.DECLINE_CALL"
    const val ACCEPT_FRIEND = "me.palmdevs.isocord.notifications.ACCEPT_FRIEND"
    const val IGNORE_FRIEND = "me.palmdevs.isocord.notifications.IGNORE_FRIEND"
    private const val EXTRA_TAG = "tag"
    private const val EXTRA_USER = "userId"
    const val MARK_READ = "me.palmdevs.isocord.notifications.MARK_READ"
    const val DISMISS = "me.palmdevs.isocord.notifications.DISMISS"
    private const val EXTRA_CHANNEL = "channelId"
    private const val EXTRA_MESSAGE = "messageId"
    /** createNonce fills the low snowflake bits below this with a random number. */
    private const val NONCE_RANDOM = 4096
    private val rest = CoroutineScope(SupervisorJob() + Dispatchers.IO.limitedParallelism(1))

    /** A snowflake for now, as createNonce makes them. */
    private fun nonce(): String =
      (((System.currentTimeMillis() - DISCORD_EPOCH) shl SNOWFLAKE_TIME_SHIFT) + Random.nextInt(NONCE_RANDOM)).toString()

    fun alertIntent(context: Context, action: String, alert: Alert): PendingIntent {
      val intent =
        Intent(action, null, context, NotificationActionReceiver::class.java)
          .putExtra(EXTRA_TAG, alert.tag)
          .putExtra(EXTRA_CHANNEL, alert.channelId)
          .putExtra(EXTRA_USER, alert.userId)
      return PendingIntent.getBroadcast(
        context,
        (action + alert.tag).hashCode(),
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }

    /** `mutable` for Reply: the system writes the typed text into the intent. */
    fun intent(context: Context, action: String, channelId: String, messageId: String, mutable: Boolean = false): PendingIntent {
      val intent =
        Intent(action, null, context, NotificationActionReceiver::class.java)
          .putExtra(EXTRA_CHANNEL, channelId)
          .putExtra(EXTRA_MESSAGE, messageId)
      val flags =
        PendingIntent.FLAG_UPDATE_CURRENT or
          if (mutable && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE
          else if (mutable) 0
          else PendingIntent.FLAG_IMMUTABLE
      return PendingIntent.getBroadcast(context, (action + channelId).hashCode(), intent, flags)
    }
  }
}

/** REST calls with the account headers the app's RestClient sends (`accountHeaders` in rest.ts), from a notification. */
object DiscordRest {
  private val JSON = "application/json".toMediaType()

  fun post(account: AccountConfig, path: String, body: kotlinx.serialization.json.JsonObject): Boolean =
    send(account, "POST", path, body) != null

  /** The response body, or null when the request failed. */
  fun get(account: AccountConfig, path: String): String? = send(account, "GET", path, null)

  /** The response body (empty for 204), or null when the request failed. */
  fun send(account: AccountConfig, method: String, path: String, body: kotlinx.serialization.json.JsonObject?): String? =
    try {
      val request =
        Request.Builder()
          .url(Discord.API_BASE + path)
          // Bytes, so OkHttp doesn't add a charset the app's requests don't have.
          .method(method, body?.toString()?.toByteArray()?.toRequestBody(JSON))
          .apply { account.requestHeaders().forEach { (name, value) -> header(name, value) } }
          .build()
      OkHttpClientProvider.getOkHttpClient().newCall(request).execute().use {
        if (it.isSuccessful) it.body?.string() ?: ""
        else {
          Log.w(TAG, "$method $path failed: ${it.code}")
          null
        }
      }
    } catch (e: IOException) {
      Log.w(TAG, "request failed: ${e.javaClass.simpleName}")
      null
    } catch (e: IllegalArgumentException) {
      Log.w(TAG, "bad request: ${e.javaClass.simpleName}")
      null
    }
}
