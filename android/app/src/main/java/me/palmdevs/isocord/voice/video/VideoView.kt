package me.palmdevs.isocord.voice.video

import android.content.Context
import android.graphics.Matrix
import android.graphics.SurfaceTexture
import android.opengl.EGL14
import android.util.Log
import android.view.TextureView
import me.palmdevs.isocord.voice.CallEngine
import me.palmdevs.isocord.voice.VideoKey
import me.palmdevs.isocord.voice.rtc.RtcContext
import org.webrtc.EglBase
import org.webrtc.EglRenderer
import org.webrtc.GlRectDrawer
import org.webrtc.VideoFrame
import org.webrtc.VideoSink

/** The render thread's name and log prefix. */
private const val RENDERER_NAME = "IsocordVideo"

private const val TAG = "IsocordVideo"

/** Makes `eglSwapBuffers` never wait for the consumer: the texture's queue drops frames instead. */
private const val SWAP_INTERVAL_ASYNC = 0

/** A frame listener at scale 0 gets no bitmap, only the call on the render thread (`EglRenderer.notifyCallbacks`). */
private const val LISTENER_NO_BITMAP = 0f

/**
 * `IsocordVideoView` (src/native/IsocordVideoViewNativeComponent.ts): shows the video of one user and connection,
 * following the engine's track changes. A TextureView fed by webrtc's `EglRenderer`, as `SurfaceEglRenderer` feeds
 * `SurfaceViewRenderer`. Stock webrtc has no TextureView renderer.
 * The buffer keeps the frame's size and a transform scales it into the view. A view that animates its size shows its
 * last frame, scaled, instead of a SurfaceView's black resize, and it follows React's transforms and clipping.
 *
 * The renderer and the track live from the first attach until React drops the view ([dispose]): React detaches and
 * reattaches a view it moves. The texture and its EGL surface outlive a move too, so a moved view keeps its frame.
 * A TextureView that isn't drawn consumes no frames. A swap into its full queue would block the render thread on a
 * held frame, and the capturer or decoder behind every view of the track would stall. So the queue never blocks.
 */
/** How a frame fills its view (`fit` prop). */
enum class VideoFit {
  COVER,
  CONTAIN,
  /** VoicePanelVideoRenderer's focused camera: cover when frame and view share an orientation, else contain. */
  CAMERA,
}

class VideoView(context: Context) :
  TextureView(context),
  TextureView.SurfaceTextureListener,
  VideoSink {
  private val renderer = EglRenderer(RENDERER_NAME)
  private val scale = Matrix()
  /** Runs once on the render thread with the new EGL surface current. */
  private val asyncSwap =
    EglRenderer.FrameListener {
      if (!EGL14.eglSwapInterval(EGL14.eglGetCurrentDisplay(), SWAP_INTERVAL_ASYNC)) {
        Log.w(TAG, "swap interval refused: EGL error ${EGL14.eglGetError()}")
      }
    }
  private var key = VideoKey(RtcContext.DEFAULT, "")
  /** The key this view is attached under, null before the first attach or without a user. */
  private var bound: VideoKey? = null
  private var initialised = false
  private var disposed = false
  private var fit = VideoFit.COVER
  /** Rotated size the layout is for, 0 before the first frame. Main thread. */
  private var frameWidth = 0
  private var frameHeight = 0
  /** Rotated size of the newest frame, written by the track's thread. */
  @Volatile private var latestWidth = 0
  @Volatile private var latestHeight = 0
  /** The texture kept while React moves the view, so it shows its last frame at once. */
  private var keptTexture: SurfaceTexture? = null

  init {
    surfaceTextureListener = this
    // Contain leaves bars outside the frame: React's background shows there.
    isOpaque = false
  }

  fun update(rtcContext: String = key.context, userId: String = key.userId) {
    key = VideoKey(rtcContext, userId)
    bind()
  }

  fun setFit(fit: VideoFit) {
    this.fit = fit
    applyLayout()
  }

  fun setMirror(mirror: Boolean) = renderer.setMirror(mirror)

  /** Keeps the last frame and drops new ones while [paused]. The track stays attached, so a resume is instant. */
  fun setPaused(paused: Boolean) = if (paused) renderer.pauseVideo() else renderer.disableFpsReduction()

  /** From the track's thread. A new frame size reaches the layout with the draw that shows it. */
  override fun onFrame(frame: VideoFrame) {
    latestWidth = frame.rotatedWidth
    latestHeight = frame.rotatedHeight
    renderer.onFrame(frame)
  }

  /** Attaches under the current key, replacing the old one when the props changed. No-op until initialised. */
  private fun bind() {
    if (!initialised || bound == key) return
    unbind()
    if (key.userId.isEmpty()) return
    CallEngine.attach(key, this)
    bound = key
  }

  private fun unbind() {
    bound?.let { CallEngine.detach(it, this) }
    bound = null
  }

  /**
   * Sizes the buffer to the frame, and scales it into the view: whole for contain, cropped by the view's bounds for
   * cover. TextureView stretches the buffer to its bounds, so the scale only corrects the aspect.
   */
  private fun applyLayout() {
    val viewWidth = width.toFloat()
    val viewHeight = height.toFloat()
    if (frameWidth == 0 || frameHeight == 0 || viewWidth == 0f || viewHeight == 0f) return
    surfaceTexture?.setDefaultBufferSize(frameWidth, frameHeight)
    val frameAspect = frameWidth.toFloat() / frameHeight
    val wider = frameAspect > viewWidth / viewHeight
    val cover = when (fit) {
      VideoFit.COVER -> true
      VideoFit.CONTAIN -> false
      VideoFit.CAMERA -> (frameWidth >= frameHeight) == (viewWidth >= viewHeight)
    }
    // Contain fits the frame's long side to the view, cover its short side.
    val fullWidth = wider != cover
    val shownWidth = if (fullWidth) viewWidth else viewHeight * frameAspect
    val shownHeight = if (fullWidth) viewWidth / frameAspect else viewHeight
    scale.setScale(shownWidth / viewWidth, shownHeight / viewHeight, viewWidth / 2, viewHeight / 2)
    setTransform(scale)
  }

  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
    // TextureView resets the buffer to the view's size here.
    super.onSizeChanged(w, h, oldw, oldh)
    applyLayout()
  }

  override fun onSurfaceTextureAvailable(texture: SurfaceTexture, width: Int, height: Int) {
    adoptLatestFrameSize()
    applyLayout()
    renderer.createEglSurface(texture)
    // Each new surface swaps with the default interval until set.
    renderer.addFrameListener(asyncSwap, LISTENER_NO_BITMAP)
  }

  /** [onSizeChanged] handles it. */
  override fun onSurfaceTextureSizeChanged(texture: SurfaceTexture, width: Int, height: Int) = Unit

  /**
   * Keeps the texture and its EGL surface while React moves the view: [onAttachedToWindow] puts it back with its
   * last frame. A new texture stayed empty until the next frame. After [dispose], the texture goes.
   */
  override fun onSurfaceTextureDestroyed(texture: SurfaceTexture): Boolean {
    if (disposed) return true
    keptTexture = texture
    return false
  }

  /**
   * Runs inside the draw that latches a new buffer, before TextureView applies the transform. A frame of a new
   * size so gets its layout in the same draw, never a draw late.
   */
  override fun onSurfaceTextureUpdated(texture: SurfaceTexture) {
    if (adoptLatestFrameSize()) applyLayout()
  }

  /** Takes the newest frame's size for the layout. Returns whether it changed. */
  private fun adoptLatestFrameSize(): Boolean {
    val width = latestWidth
    val height = latestHeight
    if (width == frameWidth && height == frameHeight) return false
    frameWidth = width
    frameHeight = height
    return true
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    keptTexture?.let {
      keptTexture = null
      setSurfaceTexture(it)
      // The new layer resets the buffer to the view's size in the first draw.
      post(::applyLayout)
    }
    if (initialised || disposed) return
    renderer.init(CallEngine.eglContext, EglBase.CONFIG_PLAIN, GlRectDrawer())
    initialised = true
    bind()
  }

  /** Releases the renderer, the track and a texture kept while detached. From [VideoViewManager.onDropViewInstance]. */
  fun dispose() {
    disposed = true
    unbind()
    // Waits for the render thread to let go of the texture, as `SurfaceEglRenderer.surfaceDestroyed` does.
    if (initialised) renderer.release()
    initialised = false
    keptTexture?.release()
    keptTexture = null
  }
}
