package me.palmdevs.isocord.voice.audio

/** Volume that plays at unity (media-engine Constants `DEFAULT_VOLUME`). */
const val DEFAULT_VOLUME = 100.0

/** Highest volume, as amplitude (VolumeSlider: `MAX_EMBEDDED_VOLUME_PERCEPTUAL` through `perceptualToAmplitude`). */
const val MAX_VOLUME = 200.0

/** Returns [volume] clamped to the reference's range. */
fun clampVolume(volume: Double) = volume.coerceIn(0.0, MAX_VOLUME)

/**
 * Output volume and each remote user's volume and local mute, per context (MediaEngineStore `outputVolume`,
 * `localVolumes`, `localMutes`). Volumes are amplitudes where [DEFAULT_VOLUME] is unity, as the reference
 * stores them. Kept for the process: JS sends them again after a reload.
 */
class PlaybackVolumes {
  private data class UserKey(val context: String, val userId: String)

  var output = DEFAULT_VOLUME
    set(value) {
      field = clampVolume(value)
    }
  private val volumes = mutableMapOf<UserKey, Double>()
  private val mutes = mutableSetOf<UserKey>()

  fun setVolume(context: String, userId: String, volume: Double) {
    volumes[UserKey(context, userId)] = clampVolume(volume)
  }

  fun setMute(context: String, userId: String, muted: Boolean) {
    val key = UserKey(context, userId)
    if (muted) mutes += key else mutes -= key
  }

  /** Returns the playback gain for a user's audio track (AudioTrack.setVolume, 1.0 is unity). */
  fun gain(context: String, userId: String): Double {
    val key = UserKey(context, userId)
    if (key in mutes) return 0.0
    return (volumes[key] ?: DEFAULT_VOLUME) / DEFAULT_VOLUME * (output / DEFAULT_VOLUME)
  }
}
