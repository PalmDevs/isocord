package me.palmdevs.isocord.expressions.gifs

import android.content.Context
import android.widget.FrameLayout
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.unit.dp
import coil3.SingletonImageLoader
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.events.Event
import me.palmdevs.isocord.chat.ChatFonts
import me.palmdevs.isocord.chat.media.buildImageLoader
import me.palmdevs.isocord.chat.rows.ChatTheme
import me.palmdevs.isocord.core.DisposeAfterDetach

/**
 * The Android view behind `IsocordGifGridView`: a Compose [GifGrid] fed by the props. Hosted under React Native
 * like the expression grid (ExpressionGridView).
 */
class GifGridView(context: Context) : FrameLayout(context) {
  var tiles by mutableStateOf<List<GifTile>>(emptyList())
  var theme by mutableStateOf(ChatTheme())
  var bottomPadding by mutableFloatStateOf(0f)

  private var layoutPosted = false

  private val measureAndLayout = Runnable {
    layoutPosted = false
    if (!isAttachedToWindow) return@Runnable
    measure(
      MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
      MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY),
    )
    layout(left, top, right, bottom)
  }

  init {
    SingletonImageLoader.setSafe(::buildImageLoader)
    val fonts = ChatFonts(context.assets)
    addView(
      ComposeView(context).apply {
        setViewCompositionStrategy(DisposeAfterDetach)
        setContent {
          GifGrid(
            tiles = tiles,
            theme = theme,
            fonts = fonts,
            bottomPadding = bottomPadding.dp,
            onPress = { key -> emit("topPressItem") { putString("key", key) } },
            onLongPress = { key -> emit("topLongPressItem") { putString("key", key) } },
            onAtTop = { atTop -> emit("topAtTop") { putBoolean("atTop", atTop) } },
          )
        }
      },
      LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT),
    )
  }

  private fun emit(name: String, fill: WritableMap.() -> Unit) {
    val reactContext = context as? ReactContext ?: return
    val data = Arguments.createMap().apply(fill)
    UIManagerHelper.getEventDispatcher(reactContext)
      ?.dispatchEvent(GifGridEvent(UIManagerHelper.getSurfaceId(this), id, name, data))
  }

  // A ComposeView throws when it is measured without a window; React Native measures before attaching.
  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    if (isAttachedToWindow) return super.onMeasure(widthMeasureSpec, heightMeasureSpec)
    setMeasuredDimension(MeasureSpec.getSize(widthMeasureSpec), MeasureSpec.getSize(heightMeasureSpec))
  }

  // React Native sets the frame with layout() alone, so a resize has to reach the Compose child here.
  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    val width = right - left
    val height = bottom - top
    val child = getChildAt(0)
    if (child != null && isAttachedToWindow && (child.measuredWidth != width || child.measuredHeight != height)) {
      child.measure(
        MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
        MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY),
      )
    }
    super.onLayout(changed, left, top, right, bottom)
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    layoutPosted = false
    requestLayout()
  }

  // React Native ignores layout requests from native children; Compose's own (new tiles, loaded images) are honoured.
  override fun requestLayout() {
    super.requestLayout()
    if (!layoutPosted) {
      layoutPosted = true
      post(measureAndLayout)
    }
  }

  private class GifGridEvent(surfaceId: Int, viewId: Int, private val name: String, private val data: WritableMap) :
    Event<GifGridEvent>(surfaceId, viewId) {
    override fun getEventName(): String = name

    override fun getEventData(): WritableMap = data

    override fun canCoalesce(): Boolean = false
  }
}
