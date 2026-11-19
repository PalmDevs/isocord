package me.palmdevs.isocord.chat.media

import android.content.Context
import android.widget.ImageView
import coil3.BitmapImage
import coil3.SingletonImageLoader
import coil3.asDrawable
import coil3.request.Disposable
import coil3.request.ImageRequest
import coil3.request.target
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.IsocordProxyImageViewManagerDelegate
import com.facebook.react.viewmanagers.IsocordProxyImageViewManagerInterface

/**
 * `IsocordProxyImageView` (src/native/ProxyImageViewNativeComponent.ts): a proxy picture cropped to its box.
 * Loaded by the chat's Coil loader ([ProxyImage]), so JS views share its caches and the viewer opens on the cached picture.
 */
class ProxyImageView(context: Context) : ImageView(context) {
  private var url = ""
  private var sourceWidth = 0
  private var sourceHeight = 0
  private var request: Disposable? = null
  private var dirty = false

  init {
    SingletonImageLoader.setSafe(::buildImageLoader)
    scaleType = ScaleType.CENTER_CROP
  }

  fun update(url: String = this.url, width: Int = sourceWidth, height: Int = sourceHeight) {
    if (url == this.url && width == sourceWidth && height == sourceHeight) return
    this.url = url
    sourceWidth = width
    sourceHeight = height
    dirty = true
  }

  /**
   *   Loads once all props of an update are in (onAfterUpdateTransaction) and the view has its size.
   *   React Native sets the frame with layout() alone, so Coil cannot measure, and the proxy gets the size explicitly.
   */
  fun load() {
    if (!dirty || width == 0 || height == 0) return
    dirty = false
    request?.dispose()
    // A recycled cell must not show the previous picture while the new one loads.
    setImageDrawable(null)
    if (url.isEmpty()) return
    val loader = SingletonImageLoader.get(context)
    val copy = loadedCopy(context, url)
    // A still the chat already holds at least this large covers the view as it is: no request for another size.
    val cached = copy?.let { loader.memoryCache?.get(it)?.image }
    if (cached is BitmapImage && cached.width >= width && cached.height >= height) {
      setImageDrawable(cached.asDrawable(resources))
      return
    }
    request = loader.enqueue(
      ImageRequest.Builder(context)
        .data(ProxyImage(url, sourceWidth, sourceHeight))
        .size(width, height)
        // A smaller copy, or a GIF, shows while this size loads.
        .placeholderMemoryCacheKey(copy)
        .target(this)
        .build(),
    )
  }

  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
    super.onSizeChanged(w, h, oldw, oldh)
    if (w != oldw || h != oldh) {
      dirty = true
      load()
    }
  }
}

@ReactModule(name = ProxyImageViewManager.NAME)
class ProxyImageViewManager :
  SimpleViewManager<ProxyImageView>(),
  IsocordProxyImageViewManagerInterface<ProxyImageView> {
  private val delegate = IsocordProxyImageViewManagerDelegate<ProxyImageView, ProxyImageViewManager>(this)

  override fun getDelegate(): ViewManagerDelegate<ProxyImageView> = delegate

  override fun getName(): String = NAME

  override fun createViewInstance(context: ThemedReactContext): ProxyImageView = ProxyImageView(context)

  @ReactProp(name = "url")
  override fun setUrl(view: ProxyImageView, value: String?) = view.update(url = value.orEmpty())

  @ReactProp(name = "sourceWidth", defaultInt = 0)
  override fun setSourceWidth(view: ProxyImageView, value: Int) = view.update(width = value)

  @ReactProp(name = "sourceHeight", defaultInt = 0)
  override fun setSourceHeight(view: ProxyImageView, value: Int) = view.update(height = value)

  override fun onAfterUpdateTransaction(view: ProxyImageView) {
    super.onAfterUpdateTransaction(view)
    view.load()
  }

  companion object {
    const val NAME = "IsocordProxyImageView"
  }
}
