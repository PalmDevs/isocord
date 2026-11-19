package me.palmdevs.isocord.chat

import android.content.Context
import android.widget.FrameLayout
import androidx.compose.foundation.LocalIndication
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import coil3.SingletonImageLoader
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.events.Event
import me.palmdevs.isocord.chat.list.ChatActions
import me.palmdevs.isocord.chat.list.LocalChatActions
import me.palmdevs.isocord.chat.list.LocalChatFonts
import me.palmdevs.isocord.chat.list.LocalChatTheme
import me.palmdevs.isocord.chat.media.buildImageLoader
import me.palmdevs.isocord.chat.rows.ChatTheme
import me.palmdevs.isocord.chat.rows.Reaction
import me.palmdevs.isocord.chat.rows.Reactions

/**
 * The Android view behind `IsocordReactionsView`: one message's reaction chips, drawn by the chat's [Reactions].
 * Chip taps and holds report the chat's `isocord://` links with `onLinkPress`.
 * It reports its size with `onContentSize`: JS gives it no width, so the chips size it.
 */
class ReactionsView(context: Context) : FrameLayout(context) {
  var messageId by mutableStateOf("")
  var reactions by mutableStateOf(emptyList<Reaction>())
  var theme by mutableStateOf(ChatTheme())

  private var reportedWidth = -1
  private var reportedHeight = -1
  private var layoutPosted = false

  private val measureAndLayout = Runnable {
    layoutPosted = false
    if (!isAttachedToWindow) return@Runnable
    measureContent()
    layout(left, top, right, bottom)
  }

  private val actions = ChatActions(
    onLinkPress = { url -> emit(LINK_EVENT) { putString("url", url) } },
    onMessageLongPress = {},
  )

  init {
    SingletonImageLoader.setSafe(::buildImageLoader)
    val fonts = ChatFonts(context.assets)
    addView(
      ComposeView(context).apply {
        setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnDetachedFromWindow)
        setContent {
          CompositionLocalProvider(
            LocalChatTheme provides theme,
            LocalChatFonts provides fonts,
            LocalChatActions provides actions,
            LocalIndication provides remember(theme.ripple) { ChatRipple(theme.ripple) },
          ) {
            Reactions(messageId, reactions, addReaction = false, modifier = Modifier)
          }
        }
      },
      LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT),
    )
  }

  /** Measures the chips on one line and reports their size (dp) when it changed. */
  private fun measureContent() {
    val child = getChildAt(0) ?: return
    val unbounded = MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED)
    child.measure(unbounded, unbounded)
    val width = child.measuredWidth
    val height = child.measuredHeight
    if (width == reportedWidth && height == reportedHeight) return
    reportedWidth = width
    reportedHeight = height
    val density = resources.displayMetrics.density
    emit(SIZE_EVENT) {
      putDouble("width", (width / density).toDouble())
      putDouble("height", (height / density).toDouble())
    }
  }

  private fun emit(name: String, fill: WritableMap.() -> Unit = {}) {
    val reactContext = context as? ReactContext ?: return
    val data = Arguments.createMap().apply(fill)
    UIManagerHelper.getEventDispatcherForReactTag(reactContext, id)
      ?.dispatchEvent(ReactionsEvent(UIManagerHelper.getSurfaceId(this), id, name, data))
  }

  // A ComposeView throws when it is measured without a window; React Native measures before attaching.
  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    setMeasuredDimension(MeasureSpec.getSize(widthMeasureSpec), MeasureSpec.getSize(heightMeasureSpec))
  }

  // React Native sets the frame with layout() alone; the content is measured here.
  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    if (!isAttachedToWindow) return
    measureContent()
    val child = getChildAt(0) ?: return
    child.layout(0, 0, child.measuredWidth, child.measuredHeight)
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    layoutPosted = false
    requestLayout()
  }

  // React Native ignores layout requests from native children; Compose's own (loaded images) are honoured.
  override fun requestLayout() {
    super.requestLayout()
    if (!layoutPosted) {
      layoutPosted = true
      post(measureAndLayout)
    }
  }

  private class ReactionsEvent(surfaceId: Int, viewId: Int, private val name: String, private val data: WritableMap) :
    Event<ReactionsEvent>(surfaceId, viewId) {
    override fun getEventName(): String = name

    override fun getEventData(): WritableMap = data

    override fun canCoalesce(): Boolean = false
  }

  companion object {
    const val SIZE_EVENT = "topContentSize"
    const val LINK_EVENT = "topLinkPress"
  }
}
