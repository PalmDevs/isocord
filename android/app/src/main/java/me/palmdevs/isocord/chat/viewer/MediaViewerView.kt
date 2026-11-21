package me.palmdevs.isocord.chat.viewer

import android.content.Context
import android.graphics.Color
import android.view.MotionEvent
import android.widget.FrameLayout
import androidx.compose.foundation.LocalIndication
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
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
import me.palmdevs.isocord.chat.ChatFonts
import me.palmdevs.isocord.chat.ChatRipple
import me.palmdevs.isocord.chat.list.ChatActions
import me.palmdevs.isocord.chat.list.LocalChatActions
import me.palmdevs.isocord.chat.list.LocalChatFonts
import me.palmdevs.isocord.chat.list.LocalChatTheme
import me.palmdevs.isocord.chat.media.LocalGifvPool
import me.palmdevs.isocord.chat.media.buildImageLoader
import me.palmdevs.isocord.chat.media.rememberGifvPool
import me.palmdevs.isocord.chat.rows.ChatRow
import me.palmdevs.isocord.chat.rows.ChatTheme

/**
 * The Android view behind `IsocordMediaViewerView` (src/native/MediaViewerViewNativeComponent.ts): the media
 * viewer's pager, footer and gestures ([MediaViewer]). JS lays it over the whole window and draws the header on top.
 */
class MediaViewerView(context: Context) : FrameLayout(context) {
  var sources by mutableStateOf<List<ViewerSource>>(emptyList())
  var initialIndex by mutableIntStateOf(0)
  var origin by mutableStateOf<ViewerOrigin?>(null)
  var message by mutableStateOf<ChatRow.Message?>(null)
  var theme by mutableStateOf(ChatTheme())
  var labels by mutableStateOf(ViewerLabels())
  var closeRequested by mutableStateOf(false)
  var bottomInset by mutableFloatStateOf(0f)
  var speed by mutableFloatStateOf(1f)

  private var layoutPosted = false

  // React Native ignores layout requests from native children; Compose's own are honoured here (see ChatView).
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
    // Gesture handler hit-tests background-less view groups as see-through (shouldHandlerlessViewBecomeTouchTarget).
    // Without a background, touches fall through to the chat panels' pan below.
    setBackgroundColor(Color.TRANSPARENT)
    SingletonImageLoader.setSafe(::buildImageLoader)
    val fonts = ChatFonts(context.assets)
    val actions = ChatActions(onLinkPress = { url -> emit("topLinkPress") { putString("url", url) } }, onMessageLongPress = {})
    val viewerActions = ViewerActions(
      onIndexChange = { index -> emit("topIndexChange") { putInt("index", index) } },
      onOverlayChange = { visible -> emit("topOverlayChange") { putBoolean("visible", visible) } },
      onClosing = { emit("topClosing") },
      onClosed = { emit("topClosed") },
      onLinkPress = actions.onLinkPress,
    )
    addView(
      ComposeView(context).apply {
        setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnDetachedFromWindow)
        setContent {
          val gifvPool = rememberGifvPool()
          CompositionLocalProvider(
            LocalChatTheme provides theme,
            LocalChatFonts provides fonts,
            LocalChatActions provides actions,
            LocalGifvPool provides gifvPool,
            LocalIndication provides remember(theme.ripple) { ChatRipple(theme.ripple) },
          ) {
            MediaViewer(
              sources = sources,
              initialIndex = initialIndex,
              origin = origin,
              message = message,
              labels = labels,
              closeRequested = closeRequested,
              bottomInset = bottomInset.dp,
              speed = speed,
              actions = viewerActions,
            )
          }
        }
      },
      LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT),
    )
  }

  private fun emit(name: String, fill: WritableMap.() -> Unit = {}) {
    val reactContext = context as? ReactContext ?: return
    val data = Arguments.createMap().apply(fill)
    UIManagerHelper.getEventDispatcher(reactContext)
      ?.dispatchEvent(ViewerEvent(UIManagerHelper.getSurfaceId(this), id, name, data))
  }

  // A ComposeView throws when it is measured without a window; React Native measures before attaching.
  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    if (isAttachedToWindow) return super.onMeasure(widthMeasureSpec, heightMeasureSpec)
    setMeasuredDimension(MeasureSpec.getSize(widthMeasureSpec), MeasureSpec.getSize(heightMeasureSpec))
  }

  // React Native sets the frame with layout() alone; the content is measured against the new size here.
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

  /**
   * Passes on the cancel Gesture Handler sends when a system gesture takes over the touch (see ChatView).
   * Without it a held picture still fires its long press.
   */
  override fun onTouchEvent(event: MotionEvent): Boolean {
    if (event.actionMasked == MotionEvent.ACTION_CANCEL) getChildAt(0)?.dispatchTouchEvent(event)
    return super.onTouchEvent(event)
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    layoutPosted = false
    requestLayout()
  }

  override fun requestLayout() {
    super.requestLayout()
    if (!layoutPosted) {
      layoutPosted = true
      post(measureAndLayout)
    }
  }

  private class ViewerEvent(surfaceId: Int, viewId: Int, private val name: String, private val data: WritableMap) :
    Event<ViewerEvent>(surfaceId, viewId) {
    override fun getEventName(): String = name

    override fun getEventData(): WritableMap = data

    override fun canCoalesce(): Boolean = false
  }
}
