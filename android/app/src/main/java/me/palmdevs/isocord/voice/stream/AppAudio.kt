package me.palmdevs.isocord.voice.stream

import android.annotation.SuppressLint
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioPlaybackCaptureConfiguration
import android.media.AudioRecord
import android.media.projection.MediaProjection
import android.os.Process
import android.util.Log
import androidx.annotation.RequiresApi
import java.nio.ByteBuffer
import org.webrtc.audio.JavaAudioDeviceModule

/** libwebrtc asks for 10 ms buffers (WebRtcAudioRecord `CALLBACK_BUFFER_SIZE_MS`). */
private const val BUFFER_MS = 10L

/** Platform buffers held by the capture record, so a late read doesn't drop audio. */
private const val RECORD_BUFFERS = 4

/** Returned as the capture time: libwebrtc then stamps the buffer itself (`AudioBufferCallback.onBuffer`). */
private const val NO_TIMESTAMP = 0L

private const val STEREO = 2

/**
 * Other apps' audio for our own stream (soundshare). Feeds a recordingless audio device module: libwebrtc's
 * record thread calls [onBuffer] every 10 ms, and the buffer gets the playback capture's PCM in place of the
 * microphone. Apps that opt out of capture, and every voice call, come through as silence.
 */
@RequiresApi(29)
class AppAudio(private val tag: String) : JavaAudioDeviceModule.AudioBufferCallback {
  private val lock = Any()
  // Guarded by lock. Read without it only to stop a blocked read.
  @Volatile private var record: AudioRecord? = null
  private var projection: MediaProjection? = null
  /** Opening failed for this projection. Not retried every 10 ms. */
  private var failed = false

  /** Captures through [projection], the screen capture's own: Android 14 allows one per consent. */
  fun start(projection: MediaProjection) = synchronized(lock) {
    this.projection = projection
    failed = false
  }

  fun stop() {
    // Unblocks a read in progress, so the lock comes free.
    try {
      record?.stop()
    } catch (e: IllegalStateException) {
      Log.d(tag, "app audio record already released", e)
    }
    synchronized(lock) {
      projection = null
      closeRecord()
    }
  }

  /** On libwebrtc's record thread. Blocks for one buffer, which paces the thread. */
  override fun onBuffer(
    buffer: ByteBuffer,
    audioFormat: Int,
    channelCount: Int,
    sampleRate: Int,
    bytesRead: Int,
    captureTimeNs: Long,
  ): Long {
    synchronized(lock) {
      val record = record ?: open(audioFormat, channelCount, sampleRate)
      if (record != null) {
        // Fills the buffer from its start. It came zeroed, so a short read leaves silence.
        val read = record.read(buffer, buffer.capacity(), AudioRecord.READ_BLOCKING)
        if (read >= 0) return NO_TIMESTAMP
        Log.e(tag, "app audio read failed: $read")
        failed = true
        closeRecord()
      }
    }
    // Nothing to read: silence at the real rate.
    Thread.sleep(BUFFER_MS)
    return NO_TIMESTAMP
  }

  /** Opens the playback capture in the format libwebrtc asked for. Callers hold the lock. */
  // RECORD_AUDIO is granted: the voice call already records the microphone.
  @SuppressLint("MissingPermission")
  private fun open(audioFormat: Int, channelCount: Int, sampleRate: Int): AudioRecord? {
    val projection = projection ?: return null
    if (failed) return null
    val channels = if (channelCount == STEREO) AudioFormat.CHANNEL_IN_STEREO else AudioFormat.CHANNEL_IN_MONO
    val format = AudioFormat.Builder().setEncoding(audioFormat).setSampleRate(sampleRate).setChannelMask(channels).build()
    return try {
      val minimum = AudioRecord.getMinBufferSize(sampleRate, channels, audioFormat)
      AudioRecord.Builder()
        .setAudioFormat(format)
        .setBufferSizeInBytes(minimum * RECORD_BUFFERS)
        .setAudioPlaybackCaptureConfig(captureConfig(projection))
        .build()
        .also {
          it.startRecording()
          record = it
          Log.i(tag, "app audio capturing at $sampleRate Hz, $channelCount channels")
        }
    } catch (e: UnsupportedOperationException) {
      openFailed(e)
    } catch (e: IllegalArgumentException) {
      openFailed(e)
    } catch (e: IllegalStateException) {
      openFailed(e)
    } catch (e: SecurityException) {
      openFailed(e)
    }
  }

  private fun openFailed(e: Exception): AudioRecord? {
    Log.e(tag, "app audio capture unavailable", e)
    failed = true
    return null
  }

  private fun closeRecord() {
    record?.release()
    record = null
  }

  /**
   * The usages Android lets other apps capture (AudioPlaybackCaptureConfiguration), minus our own app. The call
   * itself plays as voice communication, which is never captured.
   */
  private fun captureConfig(projection: MediaProjection) =
    AudioPlaybackCaptureConfiguration.Builder(projection)
      .addMatchingUsage(AudioAttributes.USAGE_MEDIA)
      .addMatchingUsage(AudioAttributes.USAGE_GAME)
      .addMatchingUsage(AudioAttributes.USAGE_UNKNOWN)
      .excludeUid(Process.myUid())
      .build()
}
