package me.palmdevs.isocord.voice.audio

import android.util.Log
import java.nio.ByteBuffer
import kotlin.time.Duration.Companion.milliseconds
import org.webrtc.ExternalAudioProcessingFactory

private const val TAG = "IsocordVoice"

/** RNNoise's only rate, and the call's capture rate (CallEngine). Other capture rates skip RNNoise. */
internal const val RNNOISE_RATE_HZ = 48_000

/** Frames per timing window: one second. */
private const val TIMING_WINDOW_FRAMES = 100

/** One capture frame (ExternalAudioProcessor::Process: one buffer is 10 ms). */
private val FRAME_DURATION = 10.milliseconds

/** Share of a frame RNNoise may use before the call steps down to standard (docs/voice.md 4.2). */
private const val RNNOISE_BUDGET = 0.3

private val BUDGET_NANOS = (FRAME_DURATION.inWholeNanoseconds * RNNOISE_BUDGET).toLong()

/** Why RNNoise stopped for the call: `noiseSuppressionTier` reasons (voiceTypes.ts). */
object RnnoiseFallback {
  /** Over [RNNOISE_BUDGET] of each frame. */
  const val SLOW = "slow"
  /** WebRTC processes capture at a rate other than 48 kHz. */
  const val SAMPLE_RATE = "sampleRate"
}

/**
 * The capture post-processing hook: runs after WebRTC's AEC, NS and AGC, before the encoder
 * (ExternalAudioProcessingFactory, webrtc-sdk M150). Each call gets channel 0 of one 10 ms frame as floats
 * on the 16-bit scale. Runs RNNoise when [denoise] or [detect] asks for it, then the input gain.
 * Called on the audio record thread.
 */
class CaptureProcessor(
  private val onFrame: (levelDbfs: Double, voice: Float?) -> Unit,
  /** RNNoise stopped for the rest of the call. Takes a [RnnoiseFallback]. */
  private val onStopped: (reason: String) -> Unit,
) : ExternalAudioProcessingFactory.AudioProcessing {
  /** Keeps RNNoise's output: the enhanced tier. */
  @Volatile var denoise = false
  /** Needs RNNoise's voice probability: automatic sensitivity. */
  @Volatile var detect = false
  @Volatile var gain = 1f
  @Volatile private var rate = 0
  @Volatile private var fallback: String? = null
  @Volatile private var restarting = false
  private val handle by lazy { NativeAudio.create() }
  private val frameSize by lazy { NativeAudio.frameSize() }
  private val out by lazy { FloatArray(NativeAudio.outSize()) }
  private var windowNanos = 0L
  private var windowFrames = 0
  private var measured = false
  /** A Kotlin failure here would crash the native capture thread, so the hook turns itself off. */
  private var failed = false

  override fun initialize(sampleRateHz: Int, numChannels: Int) {
    rate = sampleRateHz
  }

  override fun reset(newRate: Int) {
    rate = newRate
  }

  override fun process(numBands: Int, numFrames: Int, buffer: ByteBuffer) {
    if (failed) return
    try {
      processFrame(numFrames, buffer)
    } catch (e: RuntimeException) {
      turnOff(e)
    } catch (e: UnsatisfiedLinkError) {
      turnOff(e)
    }
  }

  private fun turnOff(e: Throwable) {
    failed = true
    Log.e(TAG, "capture processing failed, turned off", e)
  }

  /** Gives RNNoise another chance, for the next call. Any thread. */
  fun restart() {
    fallback = null
    restarting = true
  }

  private fun processFrame(frames: Int, buffer: ByteBuffer) {
    if (restarting) {
      restarting = false
      windowNanos = 0
      windowFrames = 0
      measured = false
    }
    val model = (denoise || detect) && fallback == null && fits(frames)
    val start = System.nanoTime()
    NativeAudio.process(handle, buffer, frames, model, model && denoise, gain, out)
    if (model) time(System.nanoTime() - start)
    val voice = out[NativeAudio.OUT_VOICE].takeIf { model && it >= 0f }
    onFrame(out[NativeAudio.OUT_LEVEL].toDouble(), voice)
  }

  /** Returns whether the frame is RNNoise's size and rate, else stops it for the call. */
  private fun fits(frames: Int): Boolean {
    if (rate == RNNOISE_RATE_HZ && frames == frameSize) return true
    stop(RnnoiseFallback.SAMPLE_RATE, "capture at $rate Hz, $frames samples per frame")
    return false
  }

  /** Averages RNNoise's time per frame over each window and stops it when over budget. */
  private fun time(nanos: Long) {
    windowNanos += nanos
    if (++windowFrames < TIMING_WINDOW_FRAMES) return
    val average = windowNanos / windowFrames
    windowNanos = 0
    windowFrames = 0
    if (!measured) Log.i(TAG, "RNNoise takes ${average / 1000} us per frame, budget ${BUDGET_NANOS / 1000} us")
    measured = true
    if (average > BUDGET_NANOS) stop(RnnoiseFallback.SLOW, "${average / 1000} us per frame")
  }

  private fun stop(reason: String, detail: String) {
    fallback = reason
    Log.w(TAG, "RNNoise off for this call ($reason): $detail")
    onStopped(reason)
  }
}
