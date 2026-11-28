package me.palmdevs.isocord.voice.stream

import android.content.Context
import androidx.annotation.RequiresApi
import org.webrtc.DefaultVideoDecoderFactory
import org.webrtc.DefaultVideoEncoderFactory
import org.webrtc.EglBase
import org.webrtc.PeerConnectionFactory
import org.webrtc.audio.AudioDeviceModule
import org.webrtc.audio.AudioProcessingOptions
import org.webrtc.audio.JavaAudioDeviceModule

/** Opus's own rate, so app audio isn't resampled before encoding. */
private const val APP_AUDIO_SAMPLE_RATE = 48_000

/** No echo cancellation, noise suppression, gain control or high-pass filter: app audio is music, not a voice. */
val RAW_AUDIO = AudioProcessingOptions(false, false, false, false)

/** Returns a factory with hardware video codecs first and software VP8 after, sharing [egl]. */
fun createPeerConnectionFactory(audio: AudioDeviceModule, egl: EglBase): PeerConnectionFactory =
  PeerConnectionFactory.builder()
    .setAudioDeviceModule(audio)
    .setVideoEncoderFactory(DefaultVideoEncoderFactory(egl.eglBaseContext, true, false))
    .setVideoDecoderFactory(DefaultVideoDecoderFactory(egl.eglBaseContext))
    .createPeerConnectionFactory()

/**
 * Our own stream's factory and audio device module. A factory's audio sources all carry its module's one
 * recording, so the stream can't share the voice factory without sending the microphone. This module never
 * opens a microphone (`setAudioRecordEnabled(false)`, the webrtc-sdk "recordingless" mode). [appAudio] fills
 * its buffers instead.
 */
@RequiresApi(29)
class StreamMedia private constructor(
  val factory: PeerConnectionFactory,
  private val audio: JavaAudioDeviceModule,
  val appAudio: AppAudio,
) {
  /** Releases everything. The peer connection that used [factory] is disposed first. */
  fun release() {
    appAudio.stop()
    factory.dispose()
    audio.release()
  }

  companion object {
    fun create(context: Context, egl: EglBase, tag: String): StreamMedia {
      val appAudio = AppAudio(tag)
      val audio = JavaAudioDeviceModule.builder(context)
        .setInputSampleRate(APP_AUDIO_SAMPLE_RATE)
        .setUseStereoInput(true)
        .setUseHardwareAcousticEchoCanceler(false)
        .setUseHardwareNoiseSuppressor(false)
        .setAudioBufferCallback(appAudio)
        .createAudioDeviceModule()
      audio.setAudioRecordEnabled(false)
      return StreamMedia(createPeerConnectionFactory(audio, egl), audio, appAudio)
    }
  }
}
