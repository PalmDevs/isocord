package me.palmdevs.isocord.voice.telecom

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Hears the ring notification's Decline button (DismissCallAction in the reference). Answer opens the call screen's
 * activity instead. Not exported: only the notification's own PendingIntent reaches it.
 */
class RingActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val channelId = intent.getStringExtra(RingNotification.EXTRA_CHANNEL)
    if (intent.action != RingNotification.ACTION_DECLINE || channelId == null) {
      Log.w(CALL_TAG, "unknown ring action ${intent.action}")
      return
    }
    IncomingCalls.decline(context, channelId)
  }
}
