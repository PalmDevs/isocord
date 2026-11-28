package me.palmdevs.isocord.voice.telecom

import android.content.Context
import android.os.Build
import android.telecom.DisconnectCause
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.serialization.Serializable

/** `beginCall` JSON (src/native/voiceTypes.ts `CallDetails`): what the notification and Telecom show. */
@Serializable
data class CallDetails(
  val title: String,
  val subtitle: String,
  val strings: CallStrings,
  /** False runs the call without Telecom ([CallAudio]). Read when the call begins, a later change is ignored. */
  val telecom: Boolean = true,
)

@Serializable
data class CallStrings(
  /** The notification channel's name in system settings. */
  val channel: String,
  val disconnect: String,
  val mute: String,
  val unmute: String,
  val deafen: String,
  val undeafen: String,
) {
  companion object {
    /** A ring has no call buttons yet: JS sends the real strings when the app begins the call. */
    val EMPTY = CallStrings("", "", "", "", "", "")
  }
}

/** What the call notification reflects, and which foreground service types the call needs. */
data class CallFlags(
  val muted: Boolean = false,
  val deafened: Boolean = false,
  /** Camera capture running: adds the camera service type. */
  val camera: Boolean = false,
  /** Screen capture running or about to start: adds the mediaProjection service type. */
  val screen: Boolean = false,
  /** The voice connection is up: Telecom `setActive`. */
  val connected: Boolean = false,
)

/** An audio output: a Telecom `CallEndpointCompat`, or an `AudioDeviceInfo` without Telecom. As `voiceTypes.ts` `AudioEndpoint`. */
@Serializable
data class AudioEndpoint(
  val id: String,
  val name: String,
  val kind: String,
  /** `AudioDeviceInfo.getAddress`, such as a Bluetooth MAC. Telecom endpoints have none. */
  val address: String? = null,
  /** A Bluetooth LE headset (CallsUtils `getAudioDeviceToDisplayText` names it "Bluetooth LE"). */
  val lowEnergy: Boolean = false,
)

/** [AudioEndpoint.kind] values, as `voiceTypes.ts` `AudioEndpoint`. */
internal const val KIND_EARPIECE = "earpiece"
internal const val KIND_SPEAKER = "speaker"
internal const val KIND_WIRED = "wired"
internal const val KIND_BLUETOOTH = "bluetooth"
internal const val KIND_STREAMING = "streaming"
internal const val KIND_UNKNOWN = "unknown"

/** Requests from outside the app: notification buttons, headsets, watches, the system. */
sealed interface CallAction {
  data object Disconnect : CallAction
  data class Mute(val on: Boolean) : CallAction
  data class Deafen(val on: Boolean) : CallAction
  /** Telecom put the call on hold (a cellular call) or took it off: no sending, no playback, locally only. */
  data class Hold(val on: Boolean) : CallAction
}

interface CallListener {
  fun onCallAction(action: CallAction)
  fun onEndpoints(available: List<AudioEndpoint>, current: String?)
}

/**
 * The system side of a call: the Telecom call (core-telecom `CallsManager`, API 26+), the foreground service and
 * the CallStyle notification. A call without Telecom ([CallDetails.telecom] false, or below API 26) manages its own
 * audio ([CallAudio]) and keeps the same service and notification. One call at a time.
 * CallEngine is the only caller. All methods are safe from any thread.
 */
object CallTelecom {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
  private val lock = Any()
  // Guarded by lock.
  private var call: ActiveCall? = null
  /** The last call's Telecom teardown: the next call waits for it. */
  private var pendingEnd: Job? = null

  internal val active: ActiveCall? get() = synchronized(lock) { call }

  /** What [begin] found. */
  private enum class Began { Created, Updated, Adopted }

  /**
   * Adds the Telecom call or starts [CallAudio], starts the service, or updates the details of the running call.
   * Call while in front. A call the user answered from a ring is adopted: it keeps its Telecom call and gets the
   * service. Adopted without Telecom, it ends the ring's Telecom call first.
   */
  fun begin(context: Context, details: CallDetails, listener: CallListener) {
    // A ring that waits is for a call the user did not choose now (the reference cancels it).
    if (active?.ring == RingStage.Ringing) IncomingCalls.callStarting(context)
    val (running, began) =
      synchronized(lock) {
        val held = call
        if (held == null) {
          val usesTelecom = details.telecom && telecomSupported()
          ActiveCall(context.applicationContext, details, listener, usesTelecom).also { call = it } to Began.Created
        } else {
          held.details = details
          held.listener = listener
          val answered = held.ring == RingStage.Answered
          held.ring = RingStage.None
          held to if (answered) Began.Adopted else Began.Updated
        }
      }
    when (began) {
      Began.Updated -> CallService.refresh()
      Began.Adopted -> {
        IncomingCalls.adopted()
        // A ring below API 26 had no Telecom call, so the call manages its own audio.
        if (running.usesTelecom && !details.telecom) dropTelecom(running)
        else if (!running.usesTelecom) CallAudio.start(running, null)
        CallService.start(running.context)
      }
      Began.Created -> {
        // The service first: its notification is due within 5 s of the Telecom call.
        CallService.start(running.context)
        if (running.usesTelecom) addTelecomCall(running) else CallAudio.start(running, synchronized(lock) { pendingEnd })
      }
    }
  }

  /** Ends the answered ring's Telecom call and runs the call without it, once Telecom has let go of the audio. */
  private fun dropTelecom(running: ActiveCall) {
    val ring = running.telecom
    // Callbacks of the old Telecom call stop reaching the call from here.
    running.telecom = null
    running.usesTelecom = false
    val teardown = ring?.end(DisconnectCause.LOCAL)
    synchronized(lock) { if (teardown != null) pendingEnd = teardown }
    CallAudio.start(running, teardown)
  }

  private fun telecomSupported() = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O

  /**
   * Adds an incoming Telecom call for a ring. [onAnswer] is Telecom's request to answer, from a headset or the system.
   * Returns false when a call already runs. No service: the ring's notification is posted by [RingNotification].
   */
  fun ring(context: Context, details: CallDetails, listener: CallListener, onAnswer: () -> Unit): Boolean {
    val ringing =
      synchronized(lock) {
        if (call != null) return false
        ActiveCall(context.applicationContext, details, listener, telecomSupported(), RingStage.Ringing, onAnswer)
          .also { call = it }
      }
    if (ringing.usesTelecom) addTelecomCall(ringing)
    return true
  }

  /** The user answered the ring. Telecom makes the call active, and the app's `beginCall` adopts it. */
  fun answerRing() {
    val ringing = active?.takeIf { it.ring == RingStage.Ringing } ?: return
    ringing.ring = RingStage.Answered
    ringing.telecom?.answer()
  }

  /** Ends a ring that is not the app's yet, answered or not. [cause] is a `DisconnectCause` code. */
  fun endRing(cause: Int) {
    if (active?.ring == RingStage.None) return
    end(cause)
  }

  /** Adds the Telecom call of a call that [ActiveCall.usesTelecom]. */
  private fun addTelecomCall(started: ActiveCall) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val telecom = TelecomCall(started, scope)
    started.telecom = telecom
    telecom.start(synchronized(lock) { pendingEnd })
  }

  /** Updates the notification, Telecom's mute and active state, and the service types. */
  fun update(flags: CallFlags) {
    val running = active ?: return
    running.flags = flags
    CallService.refresh()
    running.telecom?.activate()
  }

  /** Switches audio output to an endpoint from [CallListener.onEndpoints]. */
  fun requestEndpoint(id: String) {
    val running = active ?: return
    if (running.usesTelecom) running.telecom?.requestEndpoint(id) else CallAudio.select(id)
  }

  /**
   * Disconnects the Telecom call or releases the call's own audio, stops the service and removes the notification.
   * [cause] is a `DisconnectCause` code.
   */
  fun end(cause: Int = DisconnectCause.LOCAL) {
    val ended = synchronized(lock) { call.also { call = null } } ?: return
    if (!ended.usesTelecom) CallAudio.stop()
    val teardown = ended.telecom?.end(cause)
    // A call without Telecom keeps the teardown of a ring it dropped.
    synchronized(lock) { if (teardown != null) pendingEnd = teardown }
    CallService.stop(ended.context)
  }

  /** A notification button, as the user pressed it. */
  internal fun press(button: CallButton) {
    val running = active
    if (running == null) {
      Log.w(CALL_TAG, "${button.action} with no call")
      return
    }
    running.dispatch(button.toAction(running.flags))
  }
}
