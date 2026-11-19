package me.palmdevs.isocord.chat

import android.content.Context
import android.view.MotionEvent
import android.widget.FrameLayout
import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil3.SingletonImageLoader
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.events.Event
import kotlin.math.roundToInt
import me.palmdevs.isocord.chat.list.LocalChatFonts
import me.palmdevs.isocord.chat.list.LocalChatTheme
import me.palmdevs.isocord.chat.media.LocalChatScrolling
import me.palmdevs.isocord.chat.media.LocalGifvPool
import me.palmdevs.isocord.chat.media.buildImageLoader
import me.palmdevs.isocord.chat.media.rememberGifvPool
import me.palmdevs.isocord.chat.rows.ChatRow
import me.palmdevs.isocord.chat.rows.ChatTheme
import me.palmdevs.isocord.chat.search.MessageBody

/** How far up from a cut preview's bottom edge it fades out (the reference's useTruncatedGradientColors). */
private val FADE = 24.dp

/**
 * Cuts content taller than [maxHeight] (no limit at 0) and fades out its last [FADE]. The content keeps its own
 * height; whatever passes the limit is cut off. The offscreen layer the fade needs is only made while it is cut.
 */
@Composable
fun Modifier.fadeCut(maxHeight: Dp): Modifier {
  var cut by remember { mutableStateOf(false) }
  return this
    .graphicsLayer { compositingStrategy = if (cut) CompositingStrategy.Offscreen else CompositingStrategy.Auto }
    .drawWithContent {
      drawContent()
      if (cut) {
        val fade = FADE.toPx()
        drawRect(
          Brush.verticalGradient(listOf(Color.Transparent, Color.Black), startY = size.height - fade, endY = size.height),
          blendMode = BlendMode.DstOut,
        )
      }
    }
    .clipToBounds()
    .layout { measurable, constraints ->
      val limit = if (maxHeight > 0.dp) maxHeight.roundToPx() else Constraints.Infinity
      val placeable = measurable.measure(constraints.copy(minHeight = 0, maxHeight = Constraints.Infinity))
      cut = placeable.height > limit
      layout(placeable.width, minOf(placeable.height, limit)) { placeable.place(0, 0) }
    }
}

/**
 * The Android view behind `IsocordMessagePreviewView`: one message's body, drawn by the chat's composables.
 * Its height follows its content up to `maxHeight`, then fades out. It reports the height with `onContentHeight`.
 * Passes every touch through: the notification card around it takes the tap (NativeChannelRowPreview).
 */
class MessagePreviewView(context: Context) : FrameLayout(context) {
  var row by mutableStateOf<ChatRow.Message?>(null)
  var theme by mutableStateOf(ChatTheme())
  var lineClamp by mutableIntStateOf(2)
  var maxHeight by mutableFloatStateOf(0f)

  private var reportedHeight = -1
  private var layoutPosted = false

  private val measureAndLayout = Runnable {
    layoutPosted = false
    if (!isAttachedToWindow) return@Runnable
    measureContent()
    layout(left, top, right, bottom)
  }

  init {
    SingletonImageLoader.setSafe(::buildImageLoader)
    val fonts = ChatFonts(context.assets)
    addView(
      ComposeView(context).apply {
        setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnDetachedFromWindow)
        setContent {
          val message = row ?: return@setContent
          val gifvPool = rememberGifvPool()
          val scrolling = remember { mutableStateOf(false) }
          CompositionLocalProvider(
            LocalChatTheme provides theme,
            LocalChatFonts provides fonts,
            LocalGifvPool provides gifvPool,
            LocalChatScrolling provides scrolling,
            LocalIndication provides remember(theme.ripple) { ChatRipple(theme.ripple) },
          ) {
            Column(Modifier.fadeCut(maxHeight.dp)) {
              MessageBody(message, if (lineClamp > 0) lineClamp else Int.MAX_VALUE)
            }
          }
        }
      },
      LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT),
    )
  }

  /** Measures the content at the view's width and reports its height (dp) when it changed. */
  private fun measureContent() {
    val child = getChildAt(0) ?: return
    val width = right - left
    if (width <= 0) return
    child.measure(
      MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
      MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED),
    )
    val height = child.measuredHeight
    if (height == reportedHeight) return
    reportedHeight = height
    val density = resources.displayMetrics.density
    emit("topContentHeight") { putDouble("height", (height / density).toDouble()) }
  }

  private fun emit(name: String, fill: WritableMap.() -> Unit = {}) {
    val reactContext = context as? ReactContext ?: return
    val data = Arguments.createMap().apply(fill)
    UIManagerHelper.getEventDispatcherForReactTag(reactContext, id)
      ?.dispatchEvent(PreviewEvent(UIManagerHelper.getSurfaceId(this), id, name, data))
  }

  // A ComposeView throws when it is measured without a window; React Native measures before attaching.
  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    setMeasuredDimension(MeasureSpec.getSize(widthMeasureSpec), MeasureSpec.getSize(heightMeasureSpec))
  }

  // React Native sets the frame with layout() alone; the content is measured against the new width here.
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

  override fun dispatchTouchEvent(event: MotionEvent): Boolean = false

  private class PreviewEvent(surfaceId: Int, viewId: Int, private val name: String, private val data: WritableMap) :
    Event<PreviewEvent>(surfaceId, viewId) {
    override fun getEventName(): String = name

    override fun getEventData(): WritableMap = data

    override fun canCoalesce(): Boolean = false
  }
}
