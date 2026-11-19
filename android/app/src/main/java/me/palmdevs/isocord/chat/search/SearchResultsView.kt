package me.palmdevs.isocord.chat.search

import android.content.Context
import android.widget.FrameLayout
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.unit.dp
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import coil3.SingletonImageLoader
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.events.Event
import me.palmdevs.isocord.chat.ChatFonts
import me.palmdevs.isocord.chat.media.buildImageLoader
import me.palmdevs.isocord.chat.rows.ChatTheme

/**
 * The Android view behind `IsocordSearchResultsView`: a Compose list of search results fed by the `rows` and `theme`
 * props. The hosting (measure and layout under React Native) is the same as [ChatView]'s.
 */
class SearchResultsView(context: Context) : FrameLayout(context) {
  var rows by mutableStateOf<List<SearchRow>>(emptyList())
    private set
  var theme by mutableStateOf(ChatTheme())
    private set
  var lineClamp by mutableIntStateOf(4)
  var inertContent by mutableStateOf(false)
  var maxContentHeight by mutableFloatStateOf(0f)
  var topPadding by mutableFloatStateOf(0f)
  var bottomPadding by mutableFloatStateOf(0f)
  var resultLongPress by mutableStateOf(false)

  /** The Compose list is at its very top: the only place a pull refreshes. */
  private var listAtTop = true

  /** Pull to refresh around the list, off unless `refreshable`. */
  private val swipeRefresh = SwipeRefreshLayout(context).apply {
    isEnabled = false
    setOnRefreshListener { emit("topRefresh") }
    // The ComposeView's own canScrollVertically reads the semantics under the last touch, which can be stale.
    setOnChildScrollUpCallback { _, _ -> !listAtTop }
  }

  var refreshable: Boolean
    get() = swipeRefresh.isEnabled
    set(value) {
      swipeRefresh.isEnabled = value
    }

  var refreshing: Boolean
    get() = swipeRefresh.isRefreshing
    set(value) {
      swipeRefresh.isRefreshing = value
    }

  fun updateTheme(next: ChatTheme) {
    theme = next
    swipeRefresh.setColorSchemeColors(next.textDefault.toArgb())
    swipeRefresh.setProgressBackgroundColorSchemeColor(next.jumpBackground.toArgb())
  }

  /** Unchanged rows keep their previous instances (Compose compares the lists they hold by identity). */
  fun updateRows(next: List<SearchRow>) {
    val previous = rows.associateBy { it.key }
    rows = next.map { row -> previous[row.key]?.takeIf { it == row } ?: row }
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
    swipeRefresh.addView(
      ComposeView(context).apply {
        setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnDetachedFromWindow)
        setContent {
          SearchResultsList(
            rows = rows,
            theme = theme,
            fonts = fonts,
            lineClamp = lineClamp,
            inertContent = inertContent,
            maxContentHeight = maxContentHeight.dp,
            topPadding = topPadding.dp,
            bottomPadding = bottomPadding.dp,
            onLinkPress = { url -> emit("topLinkPress") { putString("url", url) } },
            onResultLongPress = if (resultLongPress) {
              { key -> emit("topResultLongPress") { putString("key", key) } }
            } else {
              null
            },
            onEndReached = { emit("topEndReached") },
            onScrollDrag = { emit("topScrollDrag") },
            onAtTopChange = { listAtTop = it },
          )
        }
      },
      LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT),
    )
    addView(swipeRefresh, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
  }

  private fun emit(name: String, fill: WritableMap.() -> Unit = {}) {
    val reactContext = context as? ReactContext ?: return
    val data = Arguments.createMap().apply(fill)
    UIManagerHelper.getEventDispatcherForReactTag(reactContext, id)
      ?.dispatchEvent(SearchEvent(UIManagerHelper.getSurfaceId(this), id, name, data))
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

  private class SearchEvent(surfaceId: Int, viewId: Int, private val name: String, private val data: WritableMap) :
    Event<SearchEvent>(surfaceId, viewId) {
    override fun getEventName(): String = name

    override fun getEventData(): WritableMap = data

    override fun canCoalesce(): Boolean = false
  }
}
