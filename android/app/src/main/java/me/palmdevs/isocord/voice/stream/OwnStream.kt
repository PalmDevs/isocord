package me.palmdevs.isocord.voice.stream

import android.content.Intent
import android.os.Build
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import me.palmdevs.isocord.voice.LocalVideo
import me.palmdevs.isocord.voice.ScreenEvents
import me.palmdevs.isocord.voice.rtc.ConnectRequest
import me.palmdevs.isocord.voice.rtc.MediaKit
import org.webrtc.PeerConnectionFactory
import org.webrtc.audio.AudioProcessingOptions

/** Playback capture's first API level (AudioPlaybackCaptureConfiguration). */
private const val APP_AUDIO_MIN_SDK = Build.VERSION_CODES.Q

/** What our own stream tells its connection, on the engine's dispatcher. */
interface OwnStreamListener {
  /** The capture size changed. The layer's encoding follows it. */
  fun onCaptureResized()

  /** Capture can't produce frames, or can again (reference `video_state` paused or playing). JS sends op 22. */
  fun onPausedChanged(paused: Boolean)
}

/**
 * Our own Go Live stream around its screen capture: the preset's quality, app audio, preview frames, rotation
 * and pause. Runs on the engine's dispatcher. Display callbacks hop onto it through [scope].
 */
class OwnStream(
  private val kit: MediaKit,
  request: ConnectRequest,
  private val scope: CoroutineScope,
  private val tag: String,
  private val listener: OwnStreamListener,
) {
  val quality = StreamQuality.of(request.streamResolution, request.streamFramerate)
  /** Its own factory when app audio is on, else the shared one (API < 29 has no playback capture). */
  private val media =
    if (request.soundshare && Build.VERSION.SDK_INT >= APP_AUDIO_MIN_SDK) StreamMedia.create(kit.context, kit.egl, tag) else null
  private val watcher = ScreenWatcher(kit.context) { state -> scope.launch { onScreen(state) } }
  private val preview = StreamPreview()
  private var video: LocalVideo? = null
  private var screenOn = true
  private var contentVisible = true
  private var paused = false

  /** The factory the stream's peer connection, tracks and sources come from. */
  val factory: PeerConnectionFactory get() = media?.factory ?: kit.factory

  /** App audio is being captured for the stream's audio sender. */
  var sendsAppAudio = false
    private set

  /** The audio track's processing: none on app audio. Null without it. */
  val audioProcessing: AudioProcessingOptions? get() = if (media != null) RAW_AUDIO else null

  /** Starts the screen capture at the preset's size for the current rotation, then app audio on its projection. */
  fun capture(consent: Intent, events: ScreenEvents): LocalVideo {
    val screen = watcher.current()
    val size = quality.captureSize(screen.width, screen.height)
    val video = LocalVideo.screen(kit.context, factory, kit.egl, consent, quality, size, events)
    this.video = video
    screenOn = screen.on
    video.track.addSink(preview)
    watcher.start()
    startAppAudio(video)
    updatePaused()
    return video
  }

  private fun startAppAudio(video: LocalVideo) {
    val media = media ?: return
    val projection = video.projection
    if (projection == null) {
      Log.w(tag, "screen capture has no projection, no app audio")
      return
    }
    if (Build.VERSION.SDK_INT < APP_AUDIO_MIN_SDK) return
    media.appAudio.start(projection)
    sendsAppAudio = true
  }

  /** The captured app was hidden or shown (MediaProjection `onCapturedContentVisibilityChanged`). */
  fun onVisibilityChanged(visible: Boolean) {
    contentVisible = visible
    updatePaused()
  }

  /** Returns a JPEG of the stream for its preview, or null before the first frame. Any thread. */
  fun previewJpeg(): ByteArray? = preview.jpeg()

  /** Stops what runs beside the capture. Called before the capture is disposed. */
  fun stop() {
    val video = video ?: return
    this.video = null
    video.track.removeSink(preview)
    watcher.stop()
    if (Build.VERSION.SDK_INT >= APP_AUDIO_MIN_SDK) media?.appAudio?.stop()
    sendsAppAudio = false
    paused = false
  }

  /** Releases the stream's factory. Called after its peer connection is disposed. */
  fun release() {
    stop()
    preview.release()
    if (Build.VERSION.SDK_INT >= APP_AUDIO_MIN_SDK) media?.release()
  }

  /** A rotation resizes the capture within the preset. Screen off pauses the stream. */
  private fun onScreen(state: ScreenState) {
    val video = video ?: return
    screenOn = state.on
    updatePaused()
    if (video.resize(quality.captureSize(state.width, state.height))) listener.onCaptureResized()
  }

  private fun updatePaused() {
    val next = !screenOn || !contentVisible
    if (next == paused) return
    paused = next
    Log.i(tag, "stream ${if (next) "paused" else "resumed"}")
    listener.onPausedChanged(next)
  }
}
