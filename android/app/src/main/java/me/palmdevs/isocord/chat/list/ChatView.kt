package me.palmdevs.isocord.chat.list

import android.content.Context
import android.view.MotionEvent
import android.view.View
import android.view.ViewTreeObserver
import android.widget.FrameLayout
import androidx.compose.runtime.getValue
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
import com.facebook.react.uimanager.util.ReactFindViewUtil
import java.lang.ref.WeakReference
import me.palmdevs.isocord.chat.ChatFonts
import me.palmdevs.isocord.chat.media.buildImageLoader
import me.palmdevs.isocord.chat.rows.ChatRow
import me.palmdevs.isocord.chat.rows.ChatTheme
import me.palmdevs.isocord.chat.rows.parseRows

/** The Android view behind `IsocordChatView`: a Compose message list fed by the `rows` and `theme` props. */
class ChatView(context: Context) : FrameLayout(context) {
  var rows by mutableStateOf<List<ChatRow>>(emptyList())
    private set
  var theme by mutableStateOf(ChatTheme())
  var scrollKey by mutableStateOf("")
  var scrollTarget by mutableStateOf<ScrollTarget?>(null)

  /** The message the jump button leads back to, instead of the present (a search result's preview). */
  var jumpTarget by mutableStateOf<String?>(null)

  /** The message the composer replies to, kept highlighted. */
  var composerTarget by mutableStateOf<String?>(null)

  /** dp the chat input overlaps the bottom of the list by. */
  var bottomInset by mutableStateOf(0f)

  /** dp the typing indicator adds over the list; animated by [ChatList]. */
  var typingInset by mutableStateOf(0f)

  /** `nativeID` of the composer's floating part, whose height [ChatList] reads (see [composerHeight]). */
  var composerNativeId: String? = null
    set(value) {
      field = value
      composerView = null
    }
  private var composerView: WeakReference<View>? = null

  /**
   * The current height in px of the composer's floating part, or null without one. Read while the list is measured:
   * React Native sets it in the same mount that resizes this view, so the two always agree.
   */
  fun composerHeight(): Int? {
    val id = composerNativeId ?: return null
    val cached = composerView?.get()?.takeIf { it.isAttachedToWindow }
    val view = cached ?: ReactFindViewUtil.findView(rootView, id)?.also { composerView = WeakReference(it) }
    return view?.height
  }

  /** The previous update's rows by their JSON line, so unchanged rows are not parsed again (see [parseRows]). */
  private var rowLines: Map<String, ChatRow> = emptyMap()

  /**
   *   Parses every JS update into new objects. Unchanged rows keep their previous instances, since Compose compares
   *   lists by identity. Rows whose line changed but whose content did not are swapped back by key.
   */
  fun updateRows(json: String?) {
    val (next, lines) = parseRows(json, rowLines)
    rowLines = lines
    val previous = rows.associateBy { it.key }
    rows = next.map { row -> previous[row.key]?.takeIf { it == row } ?: row }
  }

  // Declared before `init`, which triggers a layout request by adding the child view.
  // Compose and its AndroidViews ask for a layout in bursts; one pass per frame is enough.
  private var layoutPosted = false

  // React Native lays its views out itself and ignores layout requests from native children,
  // so Compose's own requests (new rows, loaded images) have to be honoured here.
  private val measureAndLayout = Runnable {
    layoutPosted = false
    fitList(force = true)
    // Also lays out this view, so the flag requestLayout() set is cleared (React Native never clears it). While
    // it is set, the list's own layout requests stop at this view, Compose waits for a layout pass instead of
    // invalidating, and a slow fling (no new rows to recompose) only reaches the screen every few frames.
    layout(left, top, right, bottom)
  }

  init {
    // Custom emoji and reactions can be animated.
    SingletonImageLoader.setSafe(::buildImageLoader)
    val fonts = ChatFonts(context.assets)
    addView(
      ComposeView(context).apply {
        setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnDetachedFromWindow)
        setContent {
          ChatList(
            scrollKey = scrollKey,
            scrollTarget = scrollTarget,
            jumpTarget = jumpTarget,
            composerTarget = composerTarget,
            rows = rows,
            theme = theme,
            fonts = fonts,
            bottomInset = bottomInset.dp,
            typingInset = typingInset.dp,
            composerHeight = ::composerHeight,
            onLoadOlder = { emit("topLoadOlder") },
            onLoadNewer = { emit("topLoadNewer") },
            onJumpToPresent = { emit("topJumpToPresent") },
            onLinkPress = { url -> emit("topLinkPress") { putString("url", url) } },
            onMessageLongPress = { id, media ->
              emit("topMessageLongPress") {
                putString("messageId", id)
                putString("media", media)
              }
            },
            onMessageSwipe = { id, action ->
              emit("topMessageSwipe") {
                putString("messageId", id)
                putString("action", action)
              }
            },
            onRowsDrawn = { key -> emit("topRowsDrawn") { putString("scrollKey", key) } },
            onAtBottomChange = { key, atBottom ->
              emit("topAtBottomChange") {
                putString("scrollKey", key)
                putBoolean("atBottom", atBottom)
              }
            },
          )
        }
      },
      LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT),
    )
  }

  private fun emit(name: String, fill: WritableMap.() -> Unit = {}) {
    val reactContext = context as? ReactContext ?: return
    val data = Arguments.createMap().apply(fill)
    UIManagerHelper.getEventDispatcherForReactTag(reactContext, id)
      ?.dispatchEvent(ChatEvent(UIManagerHelper.getSurfaceId(this), id, name, data))
  }

  // React Native measures views before attaching them, and a ComposeView throws when it is measured without a
  // window ("Cannot locate windowRecomposer"). The list itself is sized just before drawing (fitList).
  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    setMeasuredDimension(MeasureSpec.getSize(widthMeasureSpec), MeasureSpec.getSize(heightMeasureSpec))
  }

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    val child = getChildAt(0) ?: return
    child.layout(0, 0, child.measuredWidth, child.measuredHeight)
  }

  /**
   *   Sizes the Compose list to this view, not while React Native mounts a layout.
   *   It sets this view's frame before the composer's, and the list reads the composer's height (see ChatList's
   *   keepStillUnderComposer). Also catches layout()-only resizes (split screen, rotation, folding).
   */
  private fun fitList(force: Boolean) {
    val child = getChildAt(0) ?: return
    if (!isAttachedToWindow || width == 0 || height == 0) return
    if (!force && child.measuredWidth == width && child.measuredHeight == height) return
    child.measure(
      MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
      MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY),
    )
    child.layout(0, 0, width, height)
  }

  private val fitBeforeDraw = ViewTreeObserver.OnPreDrawListener {
    fitList(force = false)
    true
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    viewTreeObserver.addOnPreDrawListener(fitBeforeDraw)
    layoutPosted = false
    requestLayout()
  }

  override fun onDetachedFromWindow() {
    viewTreeObserver.removeOnPreDrawListener(fitBeforeDraw)
    super.onDetachedFromWindow()
  }

  /**
   * Passes on the cancel Gesture Handler sends when a gesture takes over the touch (a panel pan, a system gesture).
   * It calls onTouchEvent (cancelTouchesInInterceptedViews), but Compose only reads dispatchTouchEvent.
   * Without it a held message keeps its ripple and still fires its long press.
   */
  override fun onTouchEvent(event: MotionEvent): Boolean {
    if (event.actionMasked == MotionEvent.ACTION_CANCEL) getChildAt(0)?.dispatchTouchEvent(event)
    return super.onTouchEvent(event)
  }

  override fun requestLayout() {
    super.requestLayout()
    if (!layoutPosted) {
      layoutPosted = true
      post(measureAndLayout)
    }
  }

  private class ChatEvent(surfaceId: Int, viewId: Int, private val name: String, private val data: WritableMap) :
    Event<ChatEvent>(surfaceId, viewId) {
    override fun getEventName(): String = name

    override fun getEventData(): WritableMap = data

    // Every event is a distinct user action; never merge two of them.
    override fun canCoalesce(): Boolean = false
  }
}
