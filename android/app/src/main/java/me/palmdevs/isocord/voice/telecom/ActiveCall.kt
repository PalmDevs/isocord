package me.palmdevs.isocord.voice.telecom

import android.content.Context
import android.util.Log

internal const val CALL_TAG = "IsocordCall"

/** Where an incoming call is. [None] for a call the user started or joined. */
internal enum class RingStage {
  None,
  /** Telecom added the call and the user has not answered. */
  Ringing,
  /** Answered: waiting for the app to join and begin its own call, which adopts this one. */
  Answered,
}

/** The one running call: what the notification shows, who hears the actions, and its Telecom half if any. */
internal class ActiveCall(
  val context: Context,
  details: CallDetails,
  listener: CallListener,
  usesTelecom: Boolean,
  ring: RingStage = RingStage.None,
  /** Telecom's request to answer, from a headset or the system. Only an incoming call has one. */
  val onAnswer: (() -> Unit)? = null,
) {
  @Volatile var details = details
  @Volatile var listener = listener
  @Volatile var flags = CallFlags()
  @Volatile var ring = ring
  /** Has a Telecom call, or is adding one. False: [CallAudio] runs the audio, and the service has no phoneCall type. */
  @Volatile var usesTelecom = usesTelecom
  /** Null without Telecom, after Telecom refused the call, or once an adopted ring dropped it. */
  @Volatile var telecom: TelecomCall? = null

  /** Hands an action to the listener. A throwing listener must not tear down the Telecom call. */
  fun dispatch(action: CallAction) {
    try {
      listener.onCallAction(action)
    } catch (e: Exception) {
      Log.e(CALL_TAG, "call action $action failed", e)
    }
  }

  fun publishEndpoints(available: List<AudioEndpoint>, current: String?) {
    try {
      listener.onEndpoints(available, current)
    } catch (e: Exception) {
      Log.e(CALL_TAG, "endpoints update failed", e)
    }
  }
}
