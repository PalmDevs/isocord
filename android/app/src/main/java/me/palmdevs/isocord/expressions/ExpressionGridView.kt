package me.palmdevs.isocord.expressions

import android.content.Context
import android.widget.FrameLayout
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.compose.ui.unit.dp
import coil3.SingletonImageLoader
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.events.Event
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import me.palmdevs.isocord.chat.ChatFonts
import me.palmdevs.isocord.chat.media.buildImageLoader
import me.palmdevs.isocord.chat.rows.ChatTheme

/** Parses the grids' sections off the main thread: an emoji grid is thousands of items. */
private val parser = CoroutineScope(SupervisorJob() + Dispatchers.Default.limitedParallelism(1))

/**
 * The Android view behind `IsocordExpressionGridView`: a Compose [ExpressionGrid] fed by the props. The hosting
 * (measure and layout under React Native) is the same as the chat's.
 */
class ExpressionGridView(context: Context) : FrameLayout(context) {
  private var sections by mutableStateOf<List<GridSection>>(emptyList())
  var kind by mutableStateOf(GridKind.Emoji)
  var theme by mutableStateOf(ChatTheme())
  var animate by mutableStateOf(true)
  var bottomPadding by mutableFloatStateOf(0f)
  private var scrollRequest by mutableStateOf<ScrollRequest?>(null)
  private var generation = 0

  /** Takes the `sections` prop; the newest one parsed wins. */
  fun setSectionsJson(json: String?) {
    val current = ++generation
    if (json.isNullOrEmpty()) {
      sections = emptyList()
      return
    }
    parser.launch {
      val parsed = parseGridSections(json)
      post { if (current == generation) sections = parsed }
    }
  }

  fun scrollToSection(index: Int) {
    scrollRequest = ScrollRequest(index)
  }

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
        setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnDetachedFromWindow)
        setContent {
          ExpressionGrid(
            sections = sections,
            kind = kind,
            theme = theme,
            fonts = fonts,
            animate = animate,
            bottomPadding = bottomPadding.dp,
            scrollRequest = scrollRequest,
            onPress = { key -> emit("topPressItem") { putString("key", key) } },
            onLongPress = { key -> emit("topLongPressItem") { putString("key", key) } },
            onActiveSection = { index -> emit("topActiveSection") { putInt("index", index) } },
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
    UIManagerHelper.getEventDispatcherForReactTag(reactContext, id)
      ?.dispatchEvent(GridEvent(UIManagerHelper.getSurfaceId(this), id, name, data))
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

  // React Native ignores layout requests from native children; Compose's own (new rows, loaded images) are honoured.
  override fun requestLayout() {
    super.requestLayout()
    if (!layoutPosted) {
      layoutPosted = true
      post(measureAndLayout)
    }
  }

  private class GridEvent(surfaceId: Int, viewId: Int, private val name: String, private val data: WritableMap) :
    Event<GridEvent>(surfaceId, viewId) {
    override fun getEventName(): String = name

    override fun getEventData(): WritableMap = data

    override fun canCoalesce(): Boolean = false
  }
}
