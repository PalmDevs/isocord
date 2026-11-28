package me.palmdevs.isocord.voice.telecom

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Hears the call notification's buttons. Reference: `NotificationActions` (the official app's action receiver).
 * Not exported: only the notification's own PendingIntents reach it.
 */
class CallActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val button = CallButton.entries.firstOrNull { it.action == intent.action }
    if (button == null) {
      Log.w(CALL_TAG, "unknown call button ${intent.action}")
      return
    }
    CallTelecom.press(button)
  }
}
