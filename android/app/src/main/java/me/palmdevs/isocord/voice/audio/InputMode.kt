package me.palmdevs.isocord.voice.audio

import kotlinx.serialization.Serializable
import org.webrtc.audio.AudioProcessingOptions

/** `InputMode.mode` values (voiceTypes.ts). MediaEngineStore `InputModes`. */
object InputModeKind {
  const val VOICE_ACTIVITY = "voiceActivity"
  const val PUSH_TO_TALK = "pushToTalk"
}

/** `InputMode.noiseSuppression` and `noiseSuppressionTier` values (voiceTypes.ts). */
object NoiseSuppression {
  const val OFF = "off"
  /** WebRTC's NS, or the platform's (MediaEngineStore `noiseSuppression`). */
  const val STANDARD = "standard"
  /** RNNoise after WebRTC's processing, in place of Krisp (MediaEngineStore `noiseCancellation`). */
  const val ENHANCED = "enhanced"
}

/** Speech threshold on the mic level, dBFS (MediaEngineStore default `modeOptions.threshold`). */
const val DEFAULT_THRESHOLD_DBFS = -60.0

/** WebRTC's default for voice (AudioOptions `highpass_filter`). The reference has no setting for it. */
private const val HIGH_PASS_FILTER = true

/** `setInputMode` JSON (voiceTypes.ts `InputMode`). Defaults are MediaEngineStore's on mobile. */
@Serializable
data class InputMode(
  val mode: String = InputModeKind.VOICE_ACTIVITY,
  /** `modeOptions.autoThreshold`, off outside the desktop app. */
  val autoThreshold: Boolean = false,
  val threshold: Double = DEFAULT_THRESHOLD_DBFS,
  /** Krisp `noiseCancellation` is on by default, so enhanced. */
  val noiseSuppression: String = NoiseSuppression.ENHANCED,
  val echoCancellation: Boolean = true,
  val autoGainControl: Boolean = true,
  /** We have PRIORITY_SPEAKER: push to talk sends the priority flag. */
  val prioritySpeaker: Boolean = false,
) {
  val pushToTalk get() = mode == InputModeKind.PUSH_TO_TALK
}

/**
 * Returns our track's processing with [tier] the noise suppression running now. Automatic mode uses the
 * platform's AEC and NS where the device has them, else WebRTC's. Android has no platform AGC.
 */
fun processingOptions(mode: InputMode, tier: String) =
  AudioProcessingOptions(mode.echoCancellation, tier == NoiseSuppression.STANDARD, mode.autoGainControl, HIGH_PASS_FILTER)
