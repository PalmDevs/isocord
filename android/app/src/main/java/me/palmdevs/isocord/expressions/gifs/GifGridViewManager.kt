package me.palmdevs.isocord.expressions.gifs

import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.IsocordGifGridViewManagerDelegate
import com.facebook.react.viewmanagers.IsocordGifGridViewManagerInterface
import me.palmdevs.isocord.chat.rows.parseTheme

/** Exposes [GifGridView] to React as `IsocordGifGridView` (src/native/GifGridViewNativeComponent.ts). */
@ReactModule(name = GifGridViewManager.NAME)
class GifGridViewManager :
  SimpleViewManager<GifGridView>(),
  IsocordGifGridViewManagerInterface<GifGridView> {
  private val delegate = IsocordGifGridViewManagerDelegate<GifGridView, GifGridViewManager>(this)

  override fun getDelegate(): ViewManagerDelegate<GifGridView> = delegate

  override fun getName(): String = NAME

  override fun createViewInstance(context: ThemedReactContext): GifGridView = GifGridView(context)

  // A list is at most a few hundred tiles: parsed on the main thread.
  @ReactProp(name = "tiles")
  override fun setTiles(view: GifGridView, value: String?) {
    view.tiles = parseGifTiles(value)
  }

  @ReactProp(name = "theme")
  override fun setTheme(view: GifGridView, value: String?) {
    view.theme = parseTheme(value)
  }

  @ReactProp(name = "bottomPadding", defaultFloat = 0f)
  override fun setBottomPadding(view: GifGridView, value: Float) {
    view.bottomPadding = value
  }

  override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> =
    listOf("PressItem", "LongPressItem", "AtTop").associate { "top$it" to mapOf("registrationName" to "on$it") }

  companion object {
    const val NAME = "IsocordGifGridView"
  }
}
