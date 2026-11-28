package me.palmdevs.isocord.voice.video

import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.IsocordVideoViewManagerDelegate
import com.facebook.react.viewmanagers.IsocordVideoViewManagerInterface
import me.palmdevs.isocord.voice.rtc.RtcContext

/** Exposes [VideoView] to React as `IsocordVideoView` (src/native/IsocordVideoViewNativeComponent.ts). */
@ReactModule(name = VideoViewManager.NAME)
class VideoViewManager :
  SimpleViewManager<VideoView>(),
  IsocordVideoViewManagerInterface<VideoView> {
  private val delegate = IsocordVideoViewManagerDelegate<VideoView, VideoViewManager>(this)

  override fun getDelegate(): ViewManagerDelegate<VideoView> = delegate

  override fun getName(): String = NAME

  override fun createViewInstance(context: ThemedReactContext): VideoView = VideoView(context)

  /** React deleted the view: its renderer and track go. A detach alone keeps them, for a view React moves. */
  override fun onDropViewInstance(view: VideoView) {
    super.onDropViewInstance(view)
    view.dispose()
  }

  @ReactProp(name = "context")
  override fun setContext(view: VideoView, value: String?) = view.update(rtcContext = value ?: RtcContext.DEFAULT)

  @ReactProp(name = "userId")
  override fun setUserId(view: VideoView, value: String?) = view.update(userId = value.orEmpty())

  @ReactProp(name = "mirror", defaultBoolean = false)
  override fun setMirror(view: VideoView, value: Boolean) = view.setMirror(value)

  @ReactProp(name = "paused", defaultBoolean = false)
  override fun setPaused(view: VideoView, value: Boolean) = view.setPaused(value)

  @ReactProp(name = "fit")
  override fun setFit(view: VideoView, value: String?) = view.setFit(
    when (value) {
      FIT_CONTAIN -> VideoFit.CONTAIN
      FIT_CAMERA -> VideoFit.CAMERA
      else -> VideoFit.COVER
    },
  )

  companion object {
    const val NAME = "IsocordVideoView"
    private const val FIT_CONTAIN = "contain"
    private const val FIT_CAMERA = "camera"
  }
}
