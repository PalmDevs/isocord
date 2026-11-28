package me.palmdevs.isocord.voice.audio

import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.log10
import kotlin.math.max
import kotlin.math.sqrt
import me.palmdevs.isocord.voice.VoiceActivity
import org.webrtc.audio.JavaAudioDeviceModule

/** Frames per `inputLevel` report: about 10 a second. */
private const val LEVEL_REPORT_FRAMES = 10

/** Lowest reported level, so digital silence stays a number in JSON. */
const val LEVEL_FLOOR_DBFS = -100.0

/** All-zero raw frames before the mic counts as taken: 2 s. Android zeroes a client that loses the mic. */
private const val SILENCED_FRAMES = 200

/** 16-bit PCM full scale. */
private const val FULL_SCALE = 32768.0
private const val DECIBELS_PER_DECADE = 20.0
private const val BYTES_PER_SAMPLE = 2

/**
 * Measures each 10 ms mic frame once for voice activity and the level meter. The processed frame from
 * [CaptureProcessor] wins, so a noisy room is measured after suppression. The raw ADM frame stands in
 * when WebRTC isn't processing, such as the meter outside a call.
 * Everything runs on the audio record thread: the processed frame comes first (WebRtcAudioRecord).
 */
class MicMonitor(private val voiceActivity: VoiceActivity, private val listener: Listener) :
  JavaAudioDeviceModule.SamplesReadyCallback {
  interface Listener {
    fun onLevel(dbfs: Double)
    /** Raw frames stayed zero: another app or the privacy toggle has the mic. */
    fun onSilenced()
    /** Sound came back after [stopped] was set. */
    fun onResumed()
  }

  @Volatile var reportLevels = false
  /** The mic failed or went silent. Cleared by the next frame with sound. */
  @Volatile var stopped = false
  private var processed = false
  private var reportFrames = 0
  private var reportPeak = LEVEL_FLOOR_DBFS
  private var zeroFrames = 0

  /** Takes a frame after WebRTC's processing and RNNoise. */
  fun onProcessed(levelDbfs: Double, voice: Float?) {
    processed = true
    measure(levelDbfs, voice)
  }

  override fun onWebRtcAudioRecordSamplesReady(samples: JavaAudioDeviceModule.AudioSamples) {
    checkSilence(samples.data)
    if (processed) {
      processed = false
      return
    }
    measure(levelDbfs(samples.data), null)
  }

  private fun measure(levelDbfs: Double, voice: Float?) {
    voiceActivity.onFrame(levelDbfs, voice)
    if (!reportLevels) return
    reportPeak = max(reportPeak, levelDbfs)
    if (++reportFrames < LEVEL_REPORT_FRAMES) return
    listener.onLevel(reportPeak)
    reportFrames = 0
    reportPeak = LEVEL_FLOOR_DBFS
  }

  private fun checkSilence(pcm: ByteArray) {
    if (pcm.any { it != 0.toByte() }) {
      zeroFrames = 0
      if (stopped) {
        stopped = false
        listener.onResumed()
      }
      return
    }
    if (++zeroFrames != SILENCED_FRAMES || stopped) return
    stopped = true
    listener.onSilenced()
  }

  /** Returns the RMS level of 16-bit little-endian PCM in dBFS. */
  private fun levelDbfs(pcm: ByteArray): Double {
    val samples = ByteBuffer.wrap(pcm).order(ByteOrder.LITTLE_ENDIAN).asShortBuffer()
    val count = pcm.size / BYTES_PER_SAMPLE
    if (count == 0) return Double.NEGATIVE_INFINITY
    var sum = 0.0
    while (samples.hasRemaining()) {
      val sample = samples.get() / FULL_SCALE
      sum += sample * sample
    }
    return DECIBELS_PER_DECADE * log10(sqrt(sum / count))
  }
}
