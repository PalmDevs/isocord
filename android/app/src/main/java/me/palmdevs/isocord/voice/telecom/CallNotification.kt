package me.palmdevs.isocord.voice.telecom

import android.app.Notification
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.annotation.DrawableRes
import androidx.core.app.NotificationChannelCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import androidx.core.graphics.drawable.IconCompat
import me.palmdevs.isocord.MainActivity
import me.palmdevs.isocord.R

/** The buttons of the call notification, as the intent actions [CallActionReceiver] hears. */
internal enum class CallButton(val action: String) {
  Disconnect("me.palmdevs.isocord.call.DISCONNECT"),
  ToggleMute("me.palmdevs.isocord.call.TOGGLE_MUTE"),
  ToggleDeafen("me.palmdevs.isocord.call.TOGGLE_DEAFEN");

  /** What pressing the button asks for, given what the notification shows now. */
  fun toAction(flags: CallFlags): CallAction =
    when (this) {
      Disconnect -> CallAction.Disconnect
      ToggleMute -> CallAction.Mute(!flags.muted)
      ToggleDeafen -> CallAction.Deafen(!flags.deafened)
    }
}

/**
 * The ongoing-call notification. Reference: `VoiceNotificationManager.android` (disconnect, mute and deafen actions,
 * tap returns to the call, icon by mute and deafen state). From API 26 a CallStyle, which Telecom needs.
 */
internal object CallNotification {
  const val ID = 1003
  private const val CHANNEL_ID = "voiceCall"
  private const val REQUEST_OPEN = 100

  /** Creates or renames the channel. Quiet: the notification only shows that a call runs. */
  fun ensureChannel(context: Context, name: String) {
    NotificationManagerCompat.from(context).createNotificationChannel(
      NotificationChannelCompat.Builder(CHANNEL_ID, NotificationManagerCompat.IMPORTANCE_LOW)
        .setName(name)
        .setShowBadge(false)
        .build(),
    )
  }

  fun build(context: Context, details: CallDetails, flags: CallFlags): Notification {
    ensureChannel(context, details.strings.channel)
    val builder =
      NotificationCompat.Builder(context, CHANNEL_ID)
        .setSmallIcon(smallIcon(flags))
        .setContentTitle(details.title)
        .setContentText(details.subtitle)
        .setCategory(NotificationCompat.CATEGORY_CALL)
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .setShowWhen(false)
        .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
        .setContentIntent(openApp(context))
    val mute = muteAction(context, details.strings, flags)
    val deafen = deafenAction(context, details.strings, flags)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      // Person needs a name: a channel we couldn't name falls back to the app's.
      val name = details.title.ifEmpty { context.getString(R.string.app_name) }
      val caller = Person.Builder().setName(name).setImportant(true).build()
      val hangUp = button(context, CallButton.Disconnect)
      builder.setStyle(NotificationCompat.CallStyle.forOngoingCall(caller, hangUp)).addAction(mute).addAction(deafen)
    } else {
      builder.addAction(action(context, R.drawable.ic_call_hang_up, details.strings.disconnect, CallButton.Disconnect))
        .addAction(mute)
        .addAction(deafen)
    }
    return builder.build()
  }

  /** A placeholder for a service whose call ended before it started: it must still go to the foreground. */
  fun placeholder(context: Context): Notification {
    ensureChannel(context, context.getString(R.string.app_name))
    return NotificationCompat.Builder(context, CHANNEL_ID).setSmallIcon(R.drawable.ic_call_mic).setOngoing(true).build()
  }

  @DrawableRes
  private fun smallIcon(flags: CallFlags) =
    when {
      flags.deafened -> R.drawable.ic_call_headphones_off
      flags.muted -> R.drawable.ic_call_mic_off
      else -> R.drawable.ic_call_mic
    }

  /** Shows the state it switches to: "Unmute" while muted. */
  private fun muteAction(context: Context, strings: CallStrings, flags: CallFlags) =
    if (flags.muted) action(context, R.drawable.ic_call_mic, strings.unmute, CallButton.ToggleMute)
    else action(context, R.drawable.ic_call_mic_off, strings.mute, CallButton.ToggleMute)

  private fun deafenAction(context: Context, strings: CallStrings, flags: CallFlags) =
    if (flags.deafened) action(context, R.drawable.ic_call_headphones, strings.undeafen, CallButton.ToggleDeafen)
    else action(context, R.drawable.ic_call_headphones_off, strings.deafen, CallButton.ToggleDeafen)

  private fun action(context: Context, @DrawableRes icon: Int, label: String, button: CallButton) =
    NotificationCompat.Action.Builder(IconCompat.createWithResource(context, icon), label, button(context, button)).build()

  private fun button(context: Context, button: CallButton): PendingIntent =
    PendingIntent.getBroadcast(
      context,
      button.ordinal,
      Intent(context, CallActionReceiver::class.java).setAction(button.action),
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )

  private fun openApp(context: Context): PendingIntent =
    PendingIntent.getActivity(
      context,
      REQUEST_OPEN,
      Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
      PendingIntent.FLAG_IMMUTABLE,
    )
}
