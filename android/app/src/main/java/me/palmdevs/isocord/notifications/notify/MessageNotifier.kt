package me.palmdevs.isocord.notifications.notify

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationChannelGroup
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Shader
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.util.Log
import android.util.LruCache
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import androidx.core.app.RemoteInput
import androidx.core.content.FileProvider
import androidx.core.graphics.drawable.IconCompat
import com.facebook.react.modules.network.OkHttpClientProvider
import java.io.File
import java.util.concurrent.Executors
import kotlinx.serialization.builtins.ListSerializer
import me.palmdevs.isocord.MainActivity
import me.palmdevs.isocord.R
import me.palmdevs.isocord.core.Links
import me.palmdevs.isocord.core.decodeOrNull
import me.palmdevs.isocord.network.ApiPath
import me.palmdevs.isocord.notifications.gateway.EventInterest
import me.palmdevs.isocord.notifications.gateway.RawMessage
import okhttp3.Request

private const val TAG = "IsocordNotify"

/**
 * Message notifications: one MessagingStyle notification per channel, tagged with the channel id.
 * Holds the channel's unread messages until read anywhere (MESSAGE_ACK), marked read, or swiped away.
 * All work runs on [executor] in arrival order, so an ack never overtakes its message.
 */
object MessageNotifier {
  /** NOTIF_SETTINGS (NotificationSettingsConstants) string ids, so the channels match the official app's. */
  const val CHANNEL_DIRECT = "directMessages"
  const val CHANNEL_SERVER = "messages"
  private const val CHANNEL_CALLS = "calls"
  private const val CHANNEL_FRIEND_REQUESTS = "friendRequests"
  private const val CHANNEL_REACTIONS = "reactions"
  private const val CHANNEL_FORUM = "forumThreadCreated"
  private const val CHANNEL_EVENTS = "guildEventLive"
  private const val CHANNEL_SYSTEM = "systemMessages"
  /**
   * Isocord's own: everything but calls while the app is in front, at default importance, so it sounds but doesn't
   * pop up over the app.
   */
  private const val CHANNEL_IN_APP = "inApp"
  /** The two in-app channels of an earlier build, which [CHANNEL_IN_APP] replaced. */
  private val OLD_CHANNELS = listOf("directMessagesInApp", "messagesInApp")
  /** Isocord's own: the background connection's status. */
  const val CHANNEL_CONNECTION = "isocordConnection"
  private const val GROUP_REALTIME = "111_realtime"
  private const val GROUP_SOCIAL = "222_social"
  private const val GROUP_SERVER = "333_server"
  private const val GROUP_OTHER = "444_other"
  /** Notifications are told apart by their tag (the channel id); the id is the same for all. */
  private const val NOTIFICATION_ID = 1
  /** Alerts, tagged by what they are about ("call:<channel>", "friend:<user>", ...). */
  private const val ALERT_ID = 2
  /** A call stops ringing after this long even if the gateway never says so (CALL_UPDATE, CALL_DELETE). */
  private const val CALL_TIMEOUT_MS = 60_000L
  /** DirectReplyAction's RemoteInput key. */
  const val REPLY_KEY = "remote_input_key"
  /** The newest messages kept per conversation. */
  private const val MAX_MESSAGES = 10
  private const val IMAGE_DIR = "notifications"
  /** The newest message a notification holds, to tell after a restart whether it has been read. */
  private const val EXTRA_LAST_MESSAGE = "isocord.lastMessageId"

  val executor = Executors.newSingleThreadExecutor { Thread(it, "isocord-notify") }

  private class Entry(
    val messageId: String,
    /** Null for the account's own replies. */
    val authorId: String?,
    val authorName: String,
    val avatarUrl: String?,
    val text: String,
    val time: Long,
    val image: File?,
  )

  private class Conversation(
    val channelId: String,
    var guildId: String?,
    var title: String?,
    var isGroup: Boolean,
    var notificationChannel: String,
    /** NotificationRenderer's large icon, which Android shows as the conversation icon. */
    var iconUrl: String? = null,
    /** As of the newest message. */
    var canReply: Boolean = true,
    val entries: MutableList<Entry> = mutableListOf(),
  )

  private val conversations = HashMap<String, Conversation>()
  private val avatars = LruCache<String, Bitmap>(64)
  private var self: Person? = null
  private val client by lazy { OkHttpClientProvider.getOkHttpClient() }

  /** The account's name for its own replies, from READY. */
  fun setSelf(id: String, name: String) =
    executor.execute { self = Person.Builder().setKey(id).setName(name).build() }

  /**
   *   NotifSettingsUtils.buildChannelsAndMapping's groups and channels, for Isocord's notifications.
   *   Importance follows inferImportanceFromBehavior on NOTIF_SETTINGS: "popup" is HIGH, "default" with sound DEFAULT.
   *   Calls ring with the ringtone. The connection status is MIN.
   *   Recreating a channel only updates its name, so this is safe at every start.
   */
  fun ensureChannels(context: Context, account: AccountConfig) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(NotificationManager::class.java)
    manager.createNotificationChannelGroups(
      listOf(
        NotificationChannelGroup(GROUP_REALTIME, account.string("groupRealtime")),
        NotificationChannelGroup(GROUP_SOCIAL, account.string("groupSocial")),
        NotificationChannelGroup(GROUP_SERVER, account.string("groupServer")),
        NotificationChannelGroup(GROUP_OTHER, account.string("groupOther")),
      )
    )
    OLD_CHANNELS.forEach { manager.deleteNotificationChannel(it) }
    val high = NotificationManager.IMPORTANCE_HIGH
    fun channel(id: String, name: String, importance: Int, group: String) =
      NotificationChannel(id, name, importance).apply { this.group = group }
    manager.createNotificationChannels(
      listOf(
        channel(CHANNEL_CALLS, account.string("channelCalls"), high, GROUP_REALTIME).apply {
          setSound(
            RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE),
            AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE).build(),
          )
          setShowBadge(false)
        },
        channel(CHANNEL_DIRECT, account.string("channelDirectMessages"), high, GROUP_SOCIAL),
        channel(CHANNEL_FRIEND_REQUESTS, account.string("channelFriendRequests"), high, GROUP_SOCIAL),
        channel(CHANNEL_REACTIONS, account.string("channelReactions"), NotificationManager.IMPORTANCE_DEFAULT, GROUP_SOCIAL),
        channel(CHANNEL_SERVER, account.string("channelMessages"), high, GROUP_SERVER),
        channel(CHANNEL_FORUM, account.string("channelForum"), high, GROUP_SERVER),
        channel(CHANNEL_EVENTS, account.string("channelEvents"), high, GROUP_SERVER),
        channel(CHANNEL_SYSTEM, account.string("channelSystem"), high, GROUP_OTHER),
        channel(CHANNEL_IN_APP, account.string("channelInApp"), NotificationManager.IMPORTANCE_DEFAULT, GROUP_OTHER),
        channel(CHANNEL_CONNECTION, account.string("channelConnection"), NotificationManager.IMPORTANCE_MIN, GROUP_REALTIME)
          .apply { setShowBadge(false) },
      )
    )
  }

  /** `inApp`: posted by the app while in front, on the channel that doesn't pop up. */
  fun post(context: Context, incoming: Incoming, alertEveryMessage: Boolean, inApp: Boolean) =
    work(context) {
      val (kind, channel) =
        when {
          incoming.isSystem -> NotificationKind.SYSTEM_MESSAGES to CHANNEL_SYSTEM
          incoming.isPrivate -> NotificationKind.DIRECT_MESSAGES to CHANNEL_DIRECT
          else -> NotificationKind.MESSAGES to CHANNEL_SERVER
        }
      if (!NotificationPrefs.kindEnabled(context, kind)) return@work
      val notificationChannel = if (inApp) CHANNEL_IN_APP else channel
      val conversation =
        conversations.getOrPut(incoming.channelId) {
          Conversation(incoming.channelId, incoming.guildId, incoming.title, incoming.isGroup, notificationChannel)
        }
      // The app and the background session can both hear a message around the hand-over.
      if (conversation.entries.any { it.messageId == incoming.messageId }) return@work
      conversation.title = incoming.title
      conversation.isGroup = incoming.isGroup
      conversation.guildId = incoming.guildId
      conversation.iconUrl = incoming.iconUrl
      conversation.canReply = incoming.canReply
      conversation.notificationChannel = notificationChannel
      conversation.entries +=
        Entry(
          messageId = incoming.messageId,
          authorId = incoming.authorId,
          authorName = incoming.authorName,
          avatarUrl = incoming.avatarUrl,
          text = incoming.text,
          time = incoming.time,
          image = incoming.image?.let { saveImage(context, it) },
        )
      while (conversation.entries.size > MAX_MESSAGES) conversation.entries.removeAt(0).image?.delete()
      // Without "Notify on every new message in conversations" only the first message of a conversation alerts;
      // later ones update it quietly (setOnlyAlertOnce).
      show(context, conversation, alert = alertEveryMessage)
    }

  /** MESSAGE_ACK and Mark As Read: the messages up to `messageId` are read, and go. */
  fun ack(context: Context, channelId: String, messageId: String) = work(context) { applyAck(context, channelId, messageId) }

  /**
   * After a READY: the session that heard the acks in between is gone, so every notification is checked against the
   * channels' read states (`read_state`), the ones shown before the process last started included.
   */
  fun reconcile(context: Context, readUpTo: Map<String, String>) =
    work(context) {
      for (channelId in conversations.keys.toList()) readUpTo[channelId]?.let { applyAck(context, channelId, it) }
      val shown = context.getSystemService(NotificationManager::class.java).activeNotifications
      for (notification in shown) {
        val channelId = notification.tag ?: continue
        if (notification.id != NOTIFICATION_ID || conversations.containsKey(channelId)) continue
        val last = notification.notification.extras.getString(EXTRA_LAST_MESSAGE) ?: continue
        val read = readUpTo[channelId] ?: continue
        if (compareSnowflakes(last, read) <= 0) NotificationManagerCompat.from(context).cancel(channelId, NOTIFICATION_ID)
      }
    }

  private fun applyAck(context: Context, channelId: String, messageId: String) {
    val conversation = conversations[channelId]
    if (conversation == null) {
      // Shown before the process last started; nothing is known of it but that it is read now.
      NotificationManagerCompat.from(context).cancel(channelId, NOTIFICATION_ID)
      return
    }
    val read = conversation.entries.filter { compareSnowflakes(it.messageId, messageId) <= 0 }
    if (read.isEmpty()) return
    conversation.entries.removeAll(read)
    read.forEach { it.image?.delete() }
    if (conversation.entries.isEmpty()) clear(context, channelId) else show(context, conversation, alert = false)
  }

  /** A reply sent from the notification joins the conversation as the account's own, which also ends the reply spinner. */
  fun addReply(context: Context, channelId: String, nonce: String, text: String) =
    work(context) {
      val conversation = conversations[channelId] ?: return@work
      conversation.entries += Entry(nonce, null, "", null, text, System.currentTimeMillis(), null)
      show(context, conversation, alert = false)
    }

  /** Shows the conversation again unchanged: a reply that failed, so the reply spinner stops. */
  fun refresh(context: Context, channelId: String) =
    work(context) { conversations[channelId]?.let { show(context, it, alert = false) } }

  /** Swiped away, read or replaced: the conversation is forgotten. */
  fun dismissed(context: Context, channelId: String) = work(context) { clear(context, channelId) }

  /** Another account, or no account: every message notification and alert goes (an Accept must not reach the new account). */
  fun cancelAll(context: Context) =
    work(context) {
      for (channelId in conversations.keys.toList()) clear(context, channelId)
      val manager = NotificationManagerCompat.from(context)
      for (shown in context.getSystemService(NotificationManager::class.java).activeNotifications)
        if (shown.id == ALERT_ID) manager.cancel(shown.tag, ALERT_ID)
      File(context.cacheDir, IMAGE_DIR).deleteRecursively()
    }

  private fun clear(context: Context, channelId: String) {
    conversations.remove(channelId)?.entries?.forEach { it.image?.delete() }
    NotificationManagerCompat.from(context).cancel(channelId, NOTIFICATION_ID)
  }

  /** Runs on [executor] with the CPU kept awake, as avatar and image downloads would otherwise stall in Doze. */
  private fun work(context: Context, block: () -> Unit) {
    val wakeLock =
      context.getSystemService(PowerManager::class.java).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "isocord:notify")
    wakeLock.acquire(30_000)
    executor.execute {
      try {
        block()
      } catch (error: Exception) {
        Log.w(TAG, "notification failed: ${error.javaClass.simpleName}: ${error.message}")
      } finally {
        if (wakeLock.isHeld) wakeLock.release()
      }
    }
  }

  /** A call, friend request, reaction, forum post or event, unless its kind is turned off. `inApp` as in [post]. */
  fun alert(context: Context, alert: Alert, inApp: Boolean) =
    work(context) {
      val account = NotificationPrefs.account(context) ?: return@work
      val (kind, channel) =
        when (alert.kind) {
          AlertKind.CALL -> NotificationKind.CALLS to CHANNEL_CALLS
          AlertKind.FRIEND_REQUEST, AlertKind.FRIEND_ACCEPTED -> NotificationKind.FRIEND_REQUESTS to CHANNEL_FRIEND_REQUESTS
          AlertKind.REACTION -> NotificationKind.REACTIONS to CHANNEL_REACTIONS
          AlertKind.FORUM_POST -> NotificationKind.FORUM_POSTS to CHANNEL_FORUM
          AlertKind.EVENT -> NotificationKind.EVENTS to CHANNEL_EVENTS
          else -> return@work
        }
      if (!NotificationPrefs.kindEnabled(context, kind)) return@work
      alert.interestIn?.let { event ->
        val interests =
          DiscordRest.get(account, ApiPath.eventInterests(event.guildId))
            ?.let { decodeOrNull(ListSerializer(EventInterest.serializer()), it) }
        if (interests?.none { it.guild_scheduled_event_id == event.eventId } != false) return@work
      }
      val text =
        alert.previewOf?.let { ref ->
          // MESSAGE_REACTION_ADD doesn't carry the message.
          val message =
            DiscordRest.get(account, ApiPath.messageAround(ref.channelId, ref.messageId))
              ?.let { decodeOrNull(ListSerializer(RawMessage.serializer()), it) }
              ?.firstOrNull { it.id == ref.messageId }
          listOfNotNull(alert.text, message?.let { previewText(it, null, null, account) }).joinToString(" ")
        } ?: alert.text
      // Calls, unlike the rest, pop up even over the app: Isocord has no call screen of its own to ring.
      val notificationChannel = if (inApp && alert.kind != AlertKind.CALL) CHANNEL_IN_APP else channel
      val builder =
        NotificationCompat.Builder(context, notificationChannel)
          .setSmallIcon(R.drawable.ic_notification)
          .setContentTitle(alert.title)
          .setContentText(text)
          .setStyle(NotificationCompat.BigTextStyle().bigText(text))
          .setSubText(alert.subText)
          .setLargeIcon(alert.iconUrl?.let { avatar(it) })
          .setPriority(NotificationCompat.PRIORITY_HIGH)
          .setAutoCancel(true)
          // A replay after the hand-over posts the same tag again; it shouldn't sound twice.
          .setOnlyAlertOnce(alert.kind != AlertKind.CALL)
          .setContentIntent(openIntent(context, alert.link, alert.tag.hashCode()))
      when (alert.kind) {
        AlertKind.CALL ->
          builder
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setOngoing(true)
            .setTimeoutAfter(CALL_TIMEOUT_MS)
            .addAction(
              R.drawable.ic_notification,
              account.string("decline"),
              NotificationActionReceiver.alertIntent(context, NotificationActionReceiver.DECLINE_CALL, alert),
            )
        AlertKind.FRIEND_REQUEST ->
          builder
            .setCategory(NotificationCompat.CATEGORY_SOCIAL)
            .addAction(
              R.drawable.ic_notification,
              account.string("accept"),
              NotificationActionReceiver.alertIntent(context, NotificationActionReceiver.ACCEPT_FRIEND, alert),
            )
            .addAction(
              R.drawable.ic_notification,
              account.string("ignore"),
              NotificationActionReceiver.alertIntent(context, NotificationActionReceiver.IGNORE_FRIEND, alert),
            )
        AlertKind.EVENT -> builder.setCategory(NotificationCompat.CATEGORY_EVENT)
        else -> builder.setCategory(NotificationCompat.CATEGORY_SOCIAL)
      }
      val notification = builder.build()
      // The ringtone repeats until the call is answered, declined or ends, as a phone call's does.
      if (alert.kind == AlertKind.CALL) notification.flags = notification.flags or Notification.FLAG_INSISTENT
      try {
        NotificationManagerCompat.from(context).notify(alert.tag, ALERT_ID, notification)
      } catch (e: SecurityException) {
        Log.w(TAG, "notification permission missing: ${e.javaClass.simpleName}")
      }
    }

  /** The call stopped ringing, the request was answered elsewhere: its alert goes. */
  fun cancelAlert(context: Context, tag: String) =
    work(context) { NotificationManagerCompat.from(context).cancel(tag, ALERT_ID) }

  private fun openIntent(context: Context, link: String?, code: Int): PendingIntent {
    val intent =
      if (link != null) Intent(Intent.ACTION_VIEW, Uri.parse(link), context, MainActivity::class.java)
      else Intent(context, MainActivity::class.java)
    return PendingIntent.getActivity(
      context,
      code,
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun show(context: Context, conversation: Conversation, alert: Boolean) {
    val account = NotificationPrefs.account(context) ?: return
    val manager = NotificationManagerCompat.from(context)
    if (!manager.areNotificationsEnabled()) return
    val last = conversation.entries.lastOrNull() ?: return
    val me = self ?: Person.Builder().setName(account.string("you")).build()
    val style = NotificationCompat.MessagingStyle(me)
    if (conversation.isGroup) style.conversationTitle = conversation.title
    style.isGroupConversation = conversation.isGroup
    for (entry in conversation.entries) {
      val person =
        entry.authorId?.let { id ->
          Person.Builder()
            .setKey(id)
            .setName(entry.authorName)
            .apply { entry.avatarUrl?.let { url -> avatar(url)?.let { setIcon(IconCompat.createWithBitmap(it)) } } }
            .build()
        }
      val message = NotificationCompat.MessagingStyle.Message(entry.text, entry.time, person)
      entry.image?.let { file ->
        val uri = imageUri(context, file)
        message.setData("image/webp", uri)
      }
      style.addMessage(message)
    }

    val channelId = conversation.channelId
    val code = channelId.hashCode()
    val link = Links.channel(conversation.guildId, channelId, last.messageId)
    val open = openIntent(context, link, code)
    val reply =
      NotificationCompat.Action.Builder(
          R.drawable.ic_notification_message,
          account.string("reply"),
          NotificationActionReceiver.intent(context, NotificationActionReceiver.REPLY, channelId, last.messageId, mutable = true),
        )
        .addRemoteInput(RemoteInput.Builder(REPLY_KEY).setLabel(account.string("reply")).build())
        .setSemanticAction(NotificationCompat.Action.SEMANTIC_ACTION_REPLY)
        .setShowsUserInterface(false)
        .build()
    val markRead =
      NotificationCompat.Action.Builder(
          R.drawable.ic_notification_message,
          account.string("markAsRead"),
          NotificationActionReceiver.intent(context, NotificationActionReceiver.MARK_READ, channelId, last.messageId),
        )
        .setSemanticAction(NotificationCompat.Action.SEMANTIC_ACTION_MARK_AS_READ)
        .setShowsUserInterface(false)
        .build()

    val notification =
      NotificationCompat.Builder(context, conversation.notificationChannel)
        .setSmallIcon(R.drawable.ic_notification_message)
        .setStyle(style)
        // Without it a group conversation shows a blank circle beside a lone sender.
        .setLargeIcon(conversation.iconUrl?.let { avatar(it) })
        .setCategory(NotificationCompat.CATEGORY_MESSAGE)
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .setWhen(last.time)
        .setShowWhen(true)
        .setAutoCancel(true)
        .setOnlyAlertOnce(!alert)
        .setContentIntent(open)
        .setDeleteIntent(NotificationActionReceiver.intent(context, NotificationActionReceiver.DISMISS, channelId, last.messageId))
        // getDirectReplyAction: Reply only where the account may send.
        .apply { if (conversation.canReply) addAction(reply) }
        .addAction(markRead)
        .addExtras(Bundle().apply { putString(EXTRA_LAST_MESSAGE, last.messageId) })
        .build()
    try {
      manager.notify(channelId, NOTIFICATION_ID, notification)
    } catch (e: SecurityException) {
      // The notification permission was taken away.
      Log.w(TAG, "notification permission missing: ${e.javaClass.simpleName}")
    }
  }

  /** A content URI System UI may read, which MessagingStyle needs for inline images. */
  private fun imageUri(context: Context, file: File): Uri {
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.notifications", file)
    context.grantUriPermission("com.android.systemui", uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
    return uri
  }

  private fun saveImage(context: Context, image: ImagePreview): File? {
    val bytes = download(image.url) ?: return null
    val dir = File(context.cacheDir, IMAGE_DIR).apply { mkdirs() }
    return File(dir, "${image.id}.webp").apply { writeBytes(bytes) }
  }

  /** Avatars cut into a circle, as the official app's conversation notifications show them. */
  private fun avatar(url: String): Bitmap? {
    avatars.get(url)?.let { return it }
    val bytes = download(url) ?: return null
    val source = BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: return null
    val size = minOf(source.width, source.height)
    val circle = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { shader = BitmapShader(source, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP) }
    Canvas(circle).drawCircle(size / 2f, size / 2f, size / 2f, paint)
    avatars.put(url, circle)
    return circle
  }

  private fun download(url: String): ByteArray? =
    try {
      client.newCall(Request.Builder().url(url).build()).execute().use { if (it.isSuccessful) it.body?.bytes() else null }
    } catch (error: Exception) {
      Log.w(TAG, "download failed: ${error.javaClass.simpleName}")
      null
    }
}

/** FileProvider of the notification images, its own class so it can't clash with other libraries' FileProviders. */
class NotificationImageProvider : FileProvider()
