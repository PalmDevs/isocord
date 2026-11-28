package me.palmdevs.isocord.voice

import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjection
import android.util.Log
import android.util.Size
import me.palmdevs.isocord.voice.stream.StreamQuality
import me.palmdevs.isocord.voice.video.CameraDevice
import me.palmdevs.isocord.voice.video.Cameras
import org.webrtc.Camera2Enumerator
import org.webrtc.CameraVideoCapturer
import org.webrtc.EglBase
import org.webrtc.PeerConnectionFactory
import org.webrtc.ScreenCapturerAndroid
import org.webrtc.SurfaceTextureHelper
import org.webrtc.VideoCapturer
import org.webrtc.VideoTrack

private const val TAG = "IsocordVoice"

/** Camera capture limits: 720p30, the official client's default quality. */
const val MAX_WIDTH = 1280
const val MAX_HEIGHT = 720
const val MAX_FRAMERATE = 30

/** Why a camera stopped on its own (`cameraStopped` event, voiceTypes.ts). */
object CameraFailure {
  /** Another app or the system took the camera. */
  const val DISCONNECTED = "disconnected"
  const val ERROR = "error"
  /** No frames for a while. */
  const val FREEZE = "freeze"
}

/** Called on a camera thread when the camera stops on its own: a [CameraFailure] and the capturer's message. */
typealias CameraFailureListener = (reason: String, message: String) -> Unit

/** What a screen capture reports, on a capture thread. */
interface ScreenEvents {
  /** The system ended the projection, such as the "Stop sharing" chip. */
  fun onStop()

  /** The captured content was hidden or shown again (API 34+, single app capture). */
  fun onVisibilityChanged(visible: Boolean)
}

/** One local video source a session sends: the camera, or the screen for Go Live. */
class LocalVideo private constructor(
  private val context: Context,
  factory: PeerConnectionFactory,
  egl: EglBase,
  @Volatile private var capturer: VideoCapturer,
  /** A [StreamType] value. */
  val type: String,
  size: Size,
  val framerate: Int,
  /** The Go Live quality, for the screen only. */
  val quality: StreamQuality?,
) {
  private val helper = SurfaceTextureHelper.create("capture", egl.eglBaseContext)
  private val source = factory.createVideoSource(capturer.isScreencast)
  val track: VideoTrack

  /** The camera capture runs on, null for the screen. Camera thread after a switch. */
  @Volatile private var camera: CameraDevice? = null
  /** The camera's callbacks, kept for a capturer that replaces a lost camera. */
  private var cameraEvents: CameraEvents? = null
  @Volatile private var disposed = false

  /** The size capture was asked for. */
  var width = size.width
    private set
  var height = size.height
    private set

  /** The screen capture's projection, once it runs. App audio shares it. */
  val projection: MediaProjection? get() = (capturer as? ScreenCapturerAndroid)?.mediaProjection

  init {
    capturer.initialize(helper, context, source.capturerObserver)
    capturer.startCapture(width, height, framerate)
    track = factory.createVideoTrack(type, source)
    Log.i(TAG, "capturing $type at ${width}x$height, $framerate fps")
  }

  /**
   * Switches to [Cameras.preferred], or the default camera when it is gone, without renegotiating: the track and
   * its senders stay. Does nothing for the screen or the camera already in use.
   */
  fun switchCamera() {
    val capturer = capturer as? CameraVideoCapturer ?: return
    val target = Cameras.resolve(context) ?: return
    if (target.id == camera?.id) return
    capturer.switchCamera(
      object : CameraVideoCapturer.CameraSwitchHandler {
        override fun onCameraSwitchDone(isFrontCamera: Boolean) = onCamera(target)

        override fun onCameraSwitchError(errorDescription: String) {
          Log.w(TAG, "camera switch to ${target.id} failed: $errorDescription")
        }
      },
      target.id,
    )
  }

  private fun onCamera(device: CameraDevice) {
    camera = device
    Cameras.setCurrent(device)
    Log.i(TAG, "camera ${device.id} (${device.facing})")
  }

  /**
   * Moves to the default camera when ours is gone, such as an unplugged USB camera. Returns false when it is still
   * there or no other camera is, and the failure stands.
   */
  private fun fallBack(): Boolean {
    val lost = camera ?: return false
    if (Cameras.list(context).any { it.id == lost.id }) return false
    val device = Cameras.resolve(context) ?: return false
    Log.i(TAG, "camera ${lost.id} gone, falling back to ${device.id}")
    // CameraCapturer stops itself after this callback and posts the session's stop on this thread. A switch
    // needs a running camera, so a new capturer starts after that stop, on the same source and track.
    helper.handler.post { helper.handler.post { restartOn(device) } }
    return true
  }

  /** On the camera thread. CameraCapturer's stop waits on this thread, so no lock is shared with [dispose]. */
  private fun restartOn(device: CameraDevice) {
    if (disposed) return
    capturer.dispose()
    capturer = Camera2Enumerator(context).createCapturer(device.id, cameraEvents)
    capturer.initialize(helper, context, source.capturerObserver)
    capturer.startCapture(width, height, framerate)
    onCamera(device)
  }

  /** Changes the capture size, such as after a rotation. Returns false when it is unchanged. */
  fun resize(size: Size): Boolean {
    if (size.width == width && size.height == height) return false
    width = size.width
    height = size.height
    // ScreenCapturerAndroid resizes its virtual display in place from Android 12.
    capturer.changeCaptureFormat(width, height, framerate)
    Log.i(TAG, "capturing $type at ${width}x$height")
    return true
  }

  fun dispose() {
    disposed = true
    if (camera != null) Cameras.setCurrent(null)
    capturer.stopCapture()
    capturer.dispose()
    track.dispose()
    source.dispose()
    helper.dispose()
  }

  companion object {
    /**
     * Returns the remembered camera ([Cameras.resolve]), else the front one, else the first, or null without a
     * camera. Frames carry their rotation (Camera2Session `getFrameOrientation`: sensor and display rotation, per
     * frame), so viewers see us upright.
     */
    fun camera(
      context: Context,
      factory: PeerConnectionFactory,
      egl: EglBase,
      onFailure: CameraFailureListener,
    ): LocalVideo? {
      val device = Cameras.resolve(context) ?: return null
      val events = CameraEvents(onFailure)
      // Camera2Enumerator's device names are the Camera2 ids.
      val capturer = Camera2Enumerator(context).createCapturer(device.id, events)
      val video = LocalVideo(context, factory, egl, capturer, StreamType.VIDEO, Size(MAX_WIDTH, MAX_HEIGHT), MAX_FRAMERATE, null)
      video.onCamera(device)
      video.cameraEvents = events
      events.fallBack = video::fallBack
      return video
    }

    /** Captures the screen with a MediaProjection consent result, at [size] and [quality]'s frame rate. */
    fun screen(
      context: Context,
      factory: PeerConnectionFactory,
      egl: EglBase,
      consent: Intent,
      quality: StreamQuality,
      size: Size,
      events: ScreenEvents,
    ): LocalVideo {
      val capturer = ScreenCapturerAndroid(consent, ProjectionEvents(events))
      return LocalVideo(context, factory, egl, capturer, StreamType.SCREEN, size, quality.framerate, quality)
    }
  }
}

/** Turns the projection's callbacks into [ScreenEvents]. */
private class ProjectionEvents(private val events: ScreenEvents) : MediaProjection.Callback() {
  override fun onStop() {
    Log.i(TAG, "screen capture stopped by the system")
    events.onStop()
  }

  override fun onCapturedContentVisibilityChanged(isVisible: Boolean) = events.onVisibilityChanged(isVisible)
}

/**
 * Turns the camera's failure callbacks into [CameraFailureListener] calls. Switching cameras raises none. A lost
 * camera that [fallBack] replaces raises none either.
 */
private class CameraEvents(private val onFailure: CameraFailureListener) : CameraVideoCapturer.CameraEventsHandler {
  /** Set once the capture exists. Returns whether it moved to another camera. */
  @Volatile var fallBack: () -> Boolean = { false }

  override fun onCameraError(errorDescription: String) {
    if (!fallBack()) onFailure(CameraFailure.ERROR, errorDescription)
  }

  override fun onCameraDisconnected() {
    if (!fallBack()) onFailure(CameraFailure.DISCONNECTED, "camera disconnected")
  }

  override fun onCameraFreezed(errorDescription: String) = onFailure(CameraFailure.FREEZE, errorDescription)

  override fun onCameraOpening(cameraName: String) = Unit

  override fun onFirstFrameAvailable() = Unit

  override fun onCameraClosed() = Unit
}
