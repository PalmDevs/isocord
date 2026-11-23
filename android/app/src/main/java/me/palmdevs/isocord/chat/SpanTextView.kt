package me.palmdevs.isocord.chat

import android.content.Context
import android.view.MotionEvent
import android.widget.FrameLayout
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.runtime.Composable
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.events.Event
import com.facebook.react.uimanager.events.NativeGestureUtil
import me.palmdevs.isocord.chat.rows.PreviewIcon
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import coil3.SingletonImageLoader
import me.palmdevs.isocord.chat.list.LocalChatFonts
import me.palmdevs.isocord.chat.list.LocalChatTheme
import me.palmdevs.isocord.chat.media.buildImageLoader
import me.palmdevs.isocord.chat.rows.ChatTheme
import me.palmdevs.isocord.chat.rows.Span
import me.palmdevs.isocord.chat.rows.SpanText
import me.palmdevs.isocord.chat.rows.MessageText
import me.palmdevs.isocord.chat.list.ChatActions
import me.palmdevs.isocord.chat.list.LocalChatActions
import me.palmdevs.isocord.core.DisposeAfterDetach

/**
 * The Android view behind `IsocordSpanTextView`. Inline, spans are one line of text ([SpanText]) and the trailing
 * icon, and every touch passes through. In [markdown] mode they are a message body ([MessageText]: blocks, quotes,
 * code), and touches on a link are taken, the rest left to the JS pressable around it.
 * JS gives it a height, from `onContentHeight` when it has to follow the text.
 */
class SpanTextView(context: Context) : FrameLayout(context) {
  var spans by mutableStateOf<List<Span>>(emptyList())
  var theme by mutableStateOf(ChatTheme())
  /** The text colour; the theme's default text when unset. */
  var color by mutableStateOf<Int?>(null)
  /** sp, from the JS text variant. */
  var fontSize by mutableFloatStateOf(0f)
  var lineHeight by mutableFloatStateOf(0f)
  var prefix by mutableStateOf<String?>(null)
  /** Lines before the text is cut. 0 for no limit, as the codegen default. */
  var lineClamp by mutableIntStateOf(0)
  var trailingIcon by mutableStateOf<String?>(null)
  var markdown by mutableStateOf(false)

  private var reportedHeight = -1
  private var truncated = false
  /** The link under the current touch, recorded by [MessageText]'s holdsLink. */
  private val heldLink = HeldLink()
  /** The current gesture started on a link, so the text has it. */
  private var linkTouch = false
  private val actions = ChatActions(onLinkPress = { url -> emit("topLinkPress") { putString("url", url) } }, onMessageLongPress = {})

  private var layoutPosted = false

  private val measureAndLayout = Runnable {
    layoutPosted = false
    if (!isAttachedToWindow) return@Runnable
    // Lays the child out itself: layout() skips onLayout when this view's frame is unchanged.
    layoutContent()
  }

  private val dbgCreated = System.currentTimeMillis()
  private var dbgLayouts = 0
  private var dbgLaidOut = false

  init {
    android.util.Log.d("DEBUG-st7k", "init start ${System.currentTimeMillis()}")
    SingletonImageLoader.setSafe(::buildImageLoader)
    val fonts = ChatFonts(context.assets)
    addView(
      ComposeView(context).apply {
        setViewCompositionStrategy(DisposeAfterDetach)
        setContent {
          // The cached measure of this view and its inner AndroidComposeView misses Compose's own size changes.
          Box(Modifier.onSizeChanged { remeasure() }) { Content(fonts) }
        }
      },
      LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT),
    )
    android.util.Log.d("DEBUG-st7k", "init end ${System.currentTimeMillis()} (+${System.currentTimeMillis() - dbgCreated} ms)")
  }

  @Composable
  private fun Content(fonts: ChatFonts) {
    val style = TextStyle(
      color = color?.let(::Color) ?: theme.textDefault,
      fontSize = fontSize.sp,
      lineHeight = lineHeight.sp,
      // Every text-*/medium and heading-*/normal variant is ggsans-Medium.
      fontWeight = FontWeight.Medium,
      fontFamily = fonts.sans,
    )
    // ChannelRowPreview: the author label is part of the same text, in the same style.
    val prefixText = remember(prefix) { prefix?.takeIf { it.isNotEmpty() }?.let(::AnnotatedString) }
    val maxLines = if (lineClamp > 0) lineClamp else Int.MAX_VALUE
    if (markdown) {
      // MessageText draws in the theme's default text colour.
      val textTheme = remember(theme, color) { color?.let { theme.copy(textDefault = Color(it)) } ?: theme }
      CompositionLocalProvider(
        LocalChatTheme provides textTheme,
        LocalChatFonts provides fonts,
        LocalChatActions provides actions,
        LocalHeldLink provides heldLink,
      ) {
        val dbgDensity = androidx.compose.ui.platform.LocalDensity.current
        androidx.compose.runtime.SideEffect {
          with(dbgDensity) {
            android.util.Log.d(
              "DEBUG-st7k",
              "clamp density=$density fontScale=$fontScale line=${lineHeight.sp.toPx()}px x3=${(lineHeight.sp * 3).toPx()}px clamp=${(lineHeight.sp * 3).toDp().toPx()}px maxLines=$maxLines",
            )
          }
        }
        MessageText(spans, fontSize = fontSize.sp, lineHeight = lineHeight.sp, maxLines = maxLines)
      }
      return
    }
    CompositionLocalProvider(LocalChatTheme provides theme, LocalChatFonts provides fonts) {
      Row(verticalAlignment = Alignment.CenterVertically) {
        SpanText(
          spans, style, maxLines, prefixText,
          modifier = Modifier.weight(1f, fill = false),
          onTextLayout = {
            if (!dbgLaidOut) android.util.Log.d("DEBUG-st7k", "first text layout ${System.currentTimeMillis()} (+${System.currentTimeMillis() - dbgCreated} ms)")
            dbgLaidOut = true
            truncated = it.hasVisualOverflow
          },
        )
        trailingIcon?.let { PreviewIcon(it, style.color) }
      }
    }
  }

  /** Flags the ComposeView and its inner view for a fresh measure, then measures and lays out. */
  private fun remeasure() {
    var view: android.view.View? = getChildAt(0)
    while (view != null) {
      view.forceLayout()
      view = (view as? android.view.ViewGroup)?.getChildAt(0)
    }
    if (!layoutPosted) {
      layoutPosted = true
      post(measureAndLayout)
    }
  }

  private fun measureContent() {
    dbgLayouts++
    if (dbgLayouts % 10 == 0) android.util.Log.d("DEBUG-st7k", "measureContent #$dbgLayouts ${System.currentTimeMillis()}")
    val child = getChildAt(0) ?: return
    val width = right - left
    if (width <= 0) return
    child.measure(
      MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
      MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED),
    )
    reportHeight(child.measuredHeight)
  }

  /** Reports the content height (dp) and whether the clamp cut the text, when either changed. */
  private fun reportHeight(height: Int) {
    val key = height * 2 + if (truncated) 1 else 0
    if (key == reportedHeight) return
    reportedHeight = key
    android.util.Log.d("DEBUG-st7k", "emit height $height truncated=$truncated ${System.currentTimeMillis()}")
    val density = resources.displayMetrics.density
    emit("topContentHeight") {
      putDouble("height", (height / density).toDouble())
      putBoolean("truncated", truncated)
    }
  }

  private fun emit(name: String, fill: WritableMap.() -> Unit = {}) {
    val reactContext = context as? ReactContext ?: return
    val data = Arguments.createMap().apply(fill)
    UIManagerHelper.getEventDispatcher(reactContext)
      ?.dispatchEvent(SpanTextEvent(UIManagerHelper.getSurfaceId(this), id, name, data))
  }

  // A ComposeView throws when it is measured without a window; React Native measures before attaching.
  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    setMeasuredDimension(MeasureSpec.getSize(widthMeasureSpec), MeasureSpec.getSize(heightMeasureSpec))
  }

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    if (!isAttachedToWindow) return
    layoutContent()
  }

  private fun layoutContent() {
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

  override fun dispatchTouchEvent(event: MotionEvent): Boolean {
    if (!markdown) return false
    if (event.actionMasked != MotionEvent.ACTION_DOWN) return linkTouch && super.dispatchTouchEvent(event)
    // Compose records the link under the finger while it handles the down.
    super.dispatchTouchEvent(event)
    linkTouch = heldLink.url != null
    if (linkTouch) {
      // The link's tap is the text's: the JS pressable around it gets a cancel instead of a press.
      NativeGestureUtil.notifyNativeGestureStarted(this, event)
      return true
    }
    val cancel = MotionEvent.obtain(event).apply { action = MotionEvent.ACTION_CANCEL }
    super.dispatchTouchEvent(cancel)
    cancel.recycle()
    return false
  }

  private class SpanTextEvent(surfaceId: Int, viewId: Int, private val name: String, private val data: WritableMap) :
    Event<SpanTextEvent>(surfaceId, viewId) {
    override fun getEventName(): String = name

    override fun getEventData(): WritableMap = data

    override fun canCoalesce(): Boolean = false
  }
}
