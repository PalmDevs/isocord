package me.palmdevs.isocord.voice.audio

import android.content.Context
import kotlin.time.Duration.Companion.milliseconds
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import me.palmdevs.isocord.voice.VoiceActivity
import me.palmdevs.isocord.voice.VoiceEvent
import org.webrtc.ExternalAudioProcessingFactory
import org.webrtc.audio.AudioProcessingOptions
import org.webrtc.audio.JavaAudioDeviceModule

/** Push to talk keeps sending this long after release (MediaEngineStore default `modeOptions.delay`). */
private val PTT_RELEASE_DELAY = 20.milliseconds

/**
 * Our microphone path: input mode, push to talk, voice activity, the noise suppression tier, the input gain,
 * level reports and mic failures. State lives on CallEngine's dispatcher, the capture hooks on the record thread.
 */
class AudioInput(private val scope: CoroutineScope, private val host: Host) {
  interface Host {
    /** Opens or closes the encryptor gate and sends op 5. */
    fun transmit(on: Boolean, priority: Boolean)
    fun onProcessingChanged(options: AudioProcessingOptions)
    fun emit(event: VoiceEvent)
  }

  var mode = InputMode()
    private set
  /** Why RNNoise stopped for this call, a [RnnoiseFallback]. */
  private var fallback: String? = null
  private var pttDown = false
  private var pttRelease: Job? = null

  private val voiceActivity = VoiceActivity { speaking -> scope.launch { onVoiceActivity(speaking) } }
  private val monitor = MicMonitor(
    voiceActivity,
    object : MicMonitor.Listener {
      override fun onLevel(dbfs: Double) {
        scope.launch { host.emit(VoiceEvent.InputLevel(dbfs)) }
      }

      override fun onSilenced() {
        scope.launch { host.emit(VoiceEvent.MicrophoneStopped(MicrophoneStop.BUSY, "silenced")) }
      }

      override fun onResumed() {
        scope.launch { host.emit(VoiceEvent.MicrophoneResumed) }
      }
    },
  )
  private val capture = CaptureProcessor(monitor::onProcessed) { reason -> scope.launch { onRnnoiseStopped(reason) } }

  /**
   * Feeds the capture hook. Kept for the process: its native APM is a process singleton, and `destroy()` frees
   * it without clearing the pointer (webrtc-sdk external_audio_processing_factory.cc).
   */
  val processingFactory by lazy { ExternalAudioProcessingFactory().apply { setCapturePostProcessing(capture) } }

  val samples: JavaAudioDeviceModule.SamplesReadyCallback get() = monitor

  /** The noise suppression running now: enhanced steps down to standard when RNNoise stopped. */
  private val tier
    get() = if (mode.noiseSuppression == NoiseSuppression.ENHANCED && fallback != null) {
      NoiseSuppression.STANDARD
    } else {
      mode.noiseSuppression
    }

  /** Our track's processing for the current mode and tier. */
  val processing get() = processingOptions(mode, tier)

  fun recordErrors(context: Context) = RecordErrors(context) { reason, message ->
    monitor.stopped = true
    scope.launch {
      host.emit(VoiceEvent.Error("microphone", message))
      host.emit(VoiceEvent.MicrophoneStopped(reason, message))
    }
  }

  fun setMode(next: InputMode) {
    val switched = next.pushToTalk != mode.pushToTalk
    val enhancing = next.noiseSuppression == NoiseSuppression.ENHANCED && mode.noiseSuppression != NoiseSuppression.ENHANCED
    mode = next
    voiceActivity.enabled = !next.pushToTalk
    voiceActivity.automatic = next.autoThreshold
    voiceActivity.threshold = next.threshold
    capture.denoise = next.noiseSuppression == NoiseSuppression.ENHANCED
    capture.detect = next.autoThreshold
    if (switched) {
      microphoneClosed()
      host.transmit(on = false, priority = false)
    }
    host.onProcessingChanged(processing)
    // RNNoise already stopped this call, for automatic sensitivity.
    fallback?.takeIf { enhancing }?.let { host.emit(VoiceEvent.NoiseSuppressionTier(tier, it)) }
  }

  /** Push to talk: sends while held, then [PTT_RELEASE_DELAY] more. Priority with PRIORITY_SPEAKER. */
  fun setPushToTalk(down: Boolean) {
    if (!mode.pushToTalk || down == pttDown) return
    pttDown = down
    pttRelease?.cancel()
    if (down) return host.transmit(on = true, priority = mode.prioritySpeaker)
    pttRelease = scope.launch {
      delay(PTT_RELEASE_DELAY)
      host.transmit(on = false, priority = false)
    }
  }

  /** Mic gain after processing. [volume] is an amplitude, [DEFAULT_VOLUME] is unity (MediaEngineStore `inputVolume`). */
  fun setInputVolume(volume: Double) {
    capture.gain = (clampVolume(volume) / DEFAULT_VOLUME).toFloat()
  }

  fun setLevelReporting(on: Boolean) {
    monitor.reportLevels = on
  }

  /** The microphone closed: a burst or a held button ends with it. The connection closes its gate itself. */
  fun microphoneClosed() {
    pttRelease?.cancel()
    pttDown = false
    voiceActivity.reset()
  }

  /** The call ended: the next one gives RNNoise another chance. */
  fun callEnded() {
    fallback = null
    capture.restart()
    microphoneClosed()
  }

  private fun onVoiceActivity(speaking: Boolean) {
    if (!mode.pushToTalk) host.transmit(speaking, priority = false)
  }

  /** Steps enhanced down to standard for the rest of the call. Automatic sensitivity falls back to the level. */
  private fun onRnnoiseStopped(reason: String) {
    if (fallback != null) return
    fallback = reason
    if (mode.noiseSuppression != NoiseSuppression.ENHANCED) return
    host.onProcessingChanged(processing)
    host.emit(VoiceEvent.NoiseSuppressionTier(tier, reason))
  }
}
