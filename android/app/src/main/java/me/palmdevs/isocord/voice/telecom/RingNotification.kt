package me.palmdevs.isocord.voice.telecom

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import androidx.core.graphics.drawable.IconCompat
import me.palmdevs.isocord.R
import me.palmdevs.isocord.notifications.notify.MessageNotifier
import me.palmdevs.isocord.voice.callscreen.CallActivity

/**
 * The notification of a ringing call: [NotificationCompat.CallStyle.forIncomingCall] with a full-screen intent that
 * opens the call screen. On the `calls` channel, whose ringtone repeats until the call is answered, declined or over.
 * Telecom needs a CallStyle notification for a call it adds.
 */
internal object RingNotification {
  const val ID = 1004
  private const val REQUEST_ANSWER = 110
  private const val REQUEST_DECLINE = 111
  private const val REQUEST_SCREEN = 112
  const val ACTION_DECLINE = "me.palmdevs.isocord.call.DECLINE_RING"
  const val EXTRA_CHANNEL = "channelId"

  /** Posts or replaces the ring. [silent] stops the ringtone and keeps the call ringing. */
  fun post(context: Context, ring: IncomingRing, silent: Boolean = false) {
    MessageNotifier.work(context) {
      if (!canUseFullScreenIntent(context)) Log.w(CALL_TAG, "full-screen intent not allowed: heads-up only")
      val notification = build(context, ring, silent)
      // The ringtone repeats until the call is answered, declined or ends, as a phone call's does.
      if (!silent) notification.flags = notification.flags or Notification.FLAG_INSISTENT
      try {
        NotificationManagerCompat.from(context).notify(ID, notification)
      } catch (e: SecurityException) {
        Log.w(CALL_TAG, "notification permission missing: ${e.javaClass.simpleName}")
      }
    }
  }

  /** Cancels on the notifier's executor, so it never overtakes the post it follows. */
  fun cancel(context: Context) = MessageNotifier.work(context) { NotificationManagerCompat.from(context).cancel(ID) }

  private fun build(context: Context, ring: IncomingRing, silent: Boolean): Notification {
    val avatar = ring.avatarUrl?.let { MessageNotifier.avatar(it) }
    val caller =
      Person.Builder().setName(ring.name.ifEmpty { context.getString(R.string.app_name) }).setImportant(true)
        .apply { avatar?.let { setIcon(IconCompat.createWithBitmap(it)) } }
        .build()
    return NotificationCompat.Builder(context, MessageNotifier.CHANNEL_CALLS)
      .setSmallIcon(R.drawable.ic_notification)
      .setContentTitle(ring.name)
      .setContentText(ring.strings.incoming)
      .setStyle(NotificationCompat.CallStyle.forIncomingCall(caller, decline(context, ring), answer(context)))
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setOngoing(true)
      .setTimeoutAfter(RING_TIMEOUT.inWholeMilliseconds)
      .setOnlyAlertOnce(silent)
      .setSilent(silent)
      .setContentIntent(screen(context))
      .setFullScreenIntent(screen(context), true)
      .build()
  }

  private fun screen(context: Context): PendingIntent =
    PendingIntent.getActivity(context, REQUEST_SCREEN, CallActivity.intent(context), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

  /** An activity, not a receiver: Android 12+ blocks activities started from a notification's broadcast. */
  private fun answer(context: Context): PendingIntent =
    PendingIntent.getActivity(
      context,
      REQUEST_ANSWER,
      CallActivity.intent(context, answer = true),
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )

  private fun decline(context: Context, ring: IncomingRing): PendingIntent =
    PendingIntent.getBroadcast(
      context,
      REQUEST_DECLINE,
      Intent(ACTION_DECLINE, null, context, RingActionReceiver::class.java).putExtra(EXTRA_CHANNEL, ring.channelId),
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )

  /**
   * Whether the system lets the notification open the call screen over the lock screen. Android 14 asks the user for
   * `USE_FULL_SCREEN_INTENT` unless the app is a calling app.
   */
  fun canUseFullScreenIntent(context: Context): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE ||
      context.getSystemService(NotificationManager::class.java).canUseFullScreenIntent()

  /** The settings page where the user allows full-screen intents (Android 14+). */
  fun fullScreenIntentSettings(context: Context): Intent =
    Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:${context.packageName}"))
}
