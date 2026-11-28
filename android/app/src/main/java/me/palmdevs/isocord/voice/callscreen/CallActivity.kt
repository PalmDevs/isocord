package me.palmdevs.isocord.voice.callscreen

import android.app.KeyguardManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.platform.ComposeView
import androidx.core.content.ContextCompat
import me.palmdevs.isocord.voice.telecom.IncomingCalls
import me.palmdevs.isocord.voice.telecom.IncomingRing

private const val TAG = "IsocordCallScreen"

/**
 * The incoming call screen, over the lock screen. Reference: `IncomingCallActivity` (layout `incoming_call_screen`).
 * Native, so it works while JS is not running. Accept dismisses the keyguard and opens the app on the call
 * ([IncomingCalls.answer]). It closes itself when the ring ends.
 */
class CallActivity : ComponentActivity() {
  /** Reference: IncomingCallActivity registers a screen-off receiver. A turned-off screen silences the ring. */
  private val screenOff =
    object : BroadcastReceiver() {
      override fun onReceive(context: Context, intent: Intent) = IncomingCalls.silence(context)
    }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    showOverLockScreen()
    setContentView(
      ComposeView(this).apply {
        setContent {
          val ring by IncomingCalls.ringing.collectAsState()
          val shown = ring
          LaunchedEffect(shown == null) { if (shown == null) finish() }
          if (shown != null) CallScreen(shown, onAccept = { accept(shown) }, onDecline = { IncomingCalls.decline(this@CallActivity, shown.channelId) })
        }
      },
    )
    answerIfAsked(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    answerIfAsked(intent)
  }

  override fun onStart() {
    super.onStart()
    ContextCompat.registerReceiver(this, screenOff, IntentFilter(Intent.ACTION_SCREEN_OFF), ContextCompat.RECEIVER_NOT_EXPORTED)
  }

  override fun onStop() {
    unregisterReceiver(screenOff)
    super.onStop()
  }

  @Suppress("DEPRECATION")
  private fun showOverLockScreen() {
    setShowWhenLocked(true)
    setTurnScreenOn(true)
    // Below API 26 there is no requestDismissKeyguard.
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) window.addFlags(WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD)
  }

  /** The notification's Answer button opens this activity to answer: a broadcast may not start one. */
  private fun answerIfAsked(intent: Intent) {
    if (!intent.getBooleanExtra(EXTRA_ANSWER, false)) return
    IncomingCalls.ringing.value?.let { accept(it) } ?: finish()
  }

  /** Dismisses the keyguard, then answers. A cancelled unlock leaves the call ringing. */
  private fun accept(ring: IncomingRing) {
    val keyguard = getSystemService(KeyguardManager::class.java)
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || !keyguard.isKeyguardLocked) {
      IncomingCalls.answer(this, ring.channelId)
      return
    }
    keyguard.requestDismissKeyguard(
      this,
      object : KeyguardManager.KeyguardDismissCallback() {
        override fun onDismissSucceeded() = IncomingCalls.answer(this@CallActivity, ring.channelId)

        override fun onDismissError() {
          Log.w(TAG, "keyguard dismiss failed")
        }
      },
    )
  }

  companion object {
    private const val EXTRA_ANSWER = "answer"

    /** An intent for the screen. [answer] answers the ring on arrival (the notification's button). */
    fun intent(context: Context, answer: Boolean = false): Intent =
      Intent(context, CallActivity::class.java)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        .putExtra(EXTRA_ANSWER, answer)

    /** Shows the screen. Only while the app is in front: a notification's full-screen intent does it otherwise. */
    fun start(context: Context) = context.startActivity(intent(context))
  }
}
