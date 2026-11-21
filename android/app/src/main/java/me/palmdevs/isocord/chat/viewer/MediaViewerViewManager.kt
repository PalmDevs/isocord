package me.palmdevs.isocord.chat.viewer

import com.facebook.react.bridge.ReadableMap
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.IsocordMediaViewerViewManagerDelegate
import com.facebook.react.viewmanagers.IsocordMediaViewerViewManagerInterface
import me.palmdevs.isocord.chat.rows.parseMessage
import me.palmdevs.isocord.chat.rows.parseTheme

/** Exposes [MediaViewerView] to React as `IsocordMediaViewerView` (src/native/MediaViewerViewNativeComponent.ts). */
@ReactModule(name = MediaViewerViewManager.NAME)
class MediaViewerViewManager :
  SimpleViewManager<MediaViewerView>(),
  IsocordMediaViewerViewManagerInterface<MediaViewerView> {
  private val delegate = IsocordMediaViewerViewManagerDelegate<MediaViewerView, MediaViewerViewManager>(this)

  override fun getDelegate(): ViewManagerDelegate<MediaViewerView> = delegate

  override fun getName(): String = NAME

  override fun createViewInstance(context: ThemedReactContext): MediaViewerView = MediaViewerView(context)

  @ReactProp(name = "sources")
  override fun setSources(view: MediaViewerView, value: String?) {
    view.sources = parseViewerSources(value)
  }

  @ReactProp(name = "initialIndex", defaultInt = 0)
  override fun setInitialIndex(view: MediaViewerView, value: Int) {
    view.initialIndex = value
  }

  @ReactProp(name = "origin")
  override fun setOrigin(view: MediaViewerView, value: ReadableMap?) {
    view.origin = value?.let {
      ViewerOrigin(it.getDouble("x").toFloat(), it.getDouble("y").toFloat(), it.getDouble("width").toFloat(), it.getDouble("height").toFloat())
    }
  }

  @ReactProp(name = "message")
  override fun setMessage(view: MediaViewerView, value: String?) {
    view.message = parseMessage(value)
  }

  @ReactProp(name = "theme")
  override fun setTheme(view: MediaViewerView, value: String?) {
    view.theme = parseTheme(value)
  }

  @ReactProp(name = "reactLabel")
  override fun setReactLabel(view: MediaViewerView, value: String?) {
    view.labels = view.labels.copy(react = value.orEmpty())
  }

  @ReactProp(name = "altLabel")
  override fun setAltLabel(view: MediaViewerView, value: String?) {
    view.labels = view.labels.copy(alt = value.orEmpty())
  }

  @ReactProp(name = "closeRequested", defaultBoolean = false)
  override fun setCloseRequested(view: MediaViewerView, value: Boolean) {
    view.closeRequested = value
  }

  @ReactProp(name = "bottomInset", defaultFloat = 0f)
  override fun setBottomInset(view: MediaViewerView, value: Float) {
    view.bottomInset = value
  }

  @ReactProp(name = "speed", defaultFloat = 1f)
  override fun setSpeed(view: MediaViewerView, value: Float) {
    view.speed = value
  }

  override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> =
    listOf("IndexChange", "OverlayChange", "Closing", "Closed", "LinkPress").associate {
      "top$it" to mapOf("registrationName" to "on$it")
    }

  companion object {
    const val NAME = "IsocordMediaViewerView"
  }
}
