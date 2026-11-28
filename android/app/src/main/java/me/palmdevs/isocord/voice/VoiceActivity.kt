package me.palmdevs.isocord.voice

import me.palmdevs.isocord.voice.audio.DEFAULT_THRESHOLD_DBFS

/** Quiet 10 ms frames before a burst ends (MediaEngineStore default `modeOptions.vadTrailing`). */
private const val TRAILING_FRAMES = 25

/** Voice probability that counts as speech (MediaEngineStore default `vadKrispActivationThreshold`). */
private const val VOICE_ACTIVATION = 0.5f

/**
 * Voice activity per 10 ms frame: a burst starts on the first voiced frame and ends after [TRAILING_FRAMES]
 * quiet ones. Fed on the audio record thread while the microphone is open.
 *
 * Fixed sensitivity compares the level with [threshold]. Automatic sensitivity uses RNNoise's voice probability,
 * as the reference's "Advanced Voice Activity" uses Krisp's. Without a probability it falls back to the default
 * threshold.
 */
class VoiceActivity(private val onChange: (speaking: Boolean) -> Unit) {
  /** Off in push to talk. */
  @Volatile var enabled = true
  @Volatile var automatic = false
  @Volatile var threshold = DEFAULT_THRESHOLD_DBFS
  @Volatile private var speaking = false
  @Volatile private var quietFrames = TRAILING_FRAMES

  /** Takes one frame's level in dBFS and RNNoise's voice probability when it ran. */
  fun onFrame(levelDbfs: Double, voice: Float?) {
    if (!enabled) return
    val voiced = when {
      !automatic -> levelDbfs >= threshold
      voice != null -> voice >= VOICE_ACTIVATION
      else -> levelDbfs >= DEFAULT_THRESHOLD_DBFS
    }
    quietFrames = if (voiced) 0 else quietFrames + 1
    val next = voiced || (speaking && quietFrames < TRAILING_FRAMES)
    if (next == speaking) return
    speaking = next
    onChange(next)
  }

  /** Forgets a burst in progress, for when the microphone closes or the mode changes. */
  fun reset() {
    speaking = false
    quietFrames = TRAILING_FRAMES
  }
}
