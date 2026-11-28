package me.palmdevs.isocord.voice.telecom

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.telecom.DisconnectCause
import android.util.Log
import kotlin.time.Duration.Companion.seconds
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.buildJsonObject
import me.palmdevs.isocord.MainActivity
import me.palmdevs.isocord.core.Links
import me.palmdevs.isocord.network.ApiPath
import me.palmdevs.isocord.notifications.gateway.AppVisibility
import me.palmdevs.isocord.notifications.notify.DiscordRest
import me.palmdevs.isocord.notifications.notify.NotificationPrefs
import me.palmdevs.isocord.voice.callscreen.CallActivity

/** A call stops ringing after this long even if the gateway never says so (CALL_UPDATE, CALL_DELETE). */
internal val RING_TIMEOUT = 60.seconds

/** An answered ring waits this long for the app to join before Telecom drops it. JS gives up a join after 30 s. */
private val ANSWER_TIMEOUT = 45.seconds

/**
 * Calls that ring the account while the app's session is paused or open: the Telecom call, the notification with its
 * full-screen intent and the call screen. The reference shows its `IncomingCallActivity` from the push of a ring
 * (`CALL_RING`) and stops it when the call ends or the ring list loses the account. Answering opens the app on the call
 * ([Links.call]), which joins and then begins its own call, adopting the answered Telecom call ([CallTelecom.begin]).
 * One ring at a time. All methods are safe from any thread.
 */
object IncomingCalls {
  private const val TAG = "IsocordRing"
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
  private val lock = Any()
  private val current = MutableStateFlow<IncomingRing?>(null)
  // Guarded by lock.
  private var timeout: Job? = null
  private var answerTimeout: Job? = null

  /** The call ringing now, which the call screen shows. Null once it is answered, declined or over. */
  val ringing: StateFlow<IncomingRing?> get() = current

  /** Starts ringing, or keeps ringing a call that already does. A ring for another call replaces the one before. */
  fun ring(context: Context, request: IncomingRing) {
    val app = context.applicationContext
    val held = current.value
    if (held?.channelId == request.channelId) return
    if (held != null) dismiss(app, DisconnectCause.CANCELED)
    val added = CallTelecom.ring(app, request.toDetails(), RingListener(app, request.channelId)) { answer(app, request.channelId) }
    // Already in a call: the reference reports no incoming call then (TelecomManager.processIncomingRing).
    if (!added) return
    current.value = request
    RingNotification.post(app, request)
    if (AppVisibility.visible) CallActivity.start(app)
    synchronized(lock) {
      timeout = scope.launch {
        delay(RING_TIMEOUT)
        Log.d(TAG, "ring timed out")
        stop(app, request.channelId, DisconnectCause.MISSED)
      }
    }
  }

  /** The call no longer rings the account, or is over: the ring goes without a word to Discord. */
  fun stop(context: Context, channelId: String, cause: Int = DisconnectCause.REMOTE) {
    if (current.value?.channelId != channelId) return
    dismiss(context.applicationContext, cause)
  }

  /** The user answered. Opens the app on the call. It joins from there. */
  fun answer(context: Context, channelId: String) {
    val app = context.applicationContext
    val ring = current.value
    if (ring == null || ring.channelId != channelId) {
      Log.w(TAG, "answer with no ring")
      return
    }
    synchronized(lock) {
      timeout?.cancel()
      answerTimeout = scope.launch {
        delay(ANSWER_TIMEOUT)
        Log.w(TAG, "answered call not joined")
        CallTelecom.endRing(DisconnectCause.LOCAL)
      }
    }
    CallTelecom.answerRing()
    current.value = null
    RingNotification.cancel(app)
    app.startActivity(
      Intent(Intent.ACTION_VIEW, Uri.parse(Links.call(channelId)), app, MainActivity::class.java)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
    )
  }

  /** The user declined: stops the ring for the account (CallActionCreators.stopRinging) and ends it here. */
  fun decline(context: Context, channelId: String) {
    val app = context.applicationContext
    if (current.value?.channelId != channelId) return
    dismiss(app, DisconnectCause.REJECTED)
    val account = NotificationPrefs.account(app) ?: return
    scope.launch(Dispatchers.IO) {
      // No recipients: the current user, as stopRinging(channelId) sends.
      DiscordRest.post(account, ApiPath.stopRinging(channelId), buildJsonObject {})
    }
  }

  /** The screen turned off: the ringtone stops and the call keeps ringing. Reference behaviour unchecked, see docs/voice.md. */
  fun silence(context: Context) {
    val ring = current.value ?: return
    RingNotification.post(context.applicationContext, ring, silent = true)
  }

  /** JS began a call, so a ring that waits goes (the reference's reconcile cancels the incoming call). */
  internal fun callStarting(context: Context) {
    if (current.value != null) dismiss(context.applicationContext, DisconnectCause.LOCAL)
  }

  /** The app joined the answered call: its Telecom call is the app's now. */
  internal fun adopted() {
    synchronized(lock) {
      answerTimeout?.cancel()
      answerTimeout = null
    }
  }

  private fun dismiss(app: Context, cause: Int) {
    synchronized(lock) {
      timeout?.cancel()
      timeout = null
    }
    current.value = null
    RingNotification.cancel(app)
    CallTelecom.endRing(cause)
  }

  private fun IncomingRing.toDetails() = CallDetails(title = name, subtitle = group.orEmpty(), strings = CallStrings.EMPTY)
}

/** Hears the ring's Telecom call before the app begins it: a disconnect from a headset or the system declines. */
private class RingListener(private val context: Context, private val channelId: String) : CallListener {
  override fun onCallAction(action: CallAction) {
    if (action is CallAction.Disconnect) IncomingCalls.decline(context, channelId)
  }

  override fun onEndpoints(available: List<AudioEndpoint>, current: String?) = Unit
}
