package me.palmdevs.isocord.input

import android.content.Context
import android.graphics.Typeface
import android.graphics.drawable.Animatable
import android.graphics.drawable.Drawable
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.SystemClock
import android.text.Editable
import android.text.InputFilter
import android.text.InputType
import android.text.Spanned
import android.text.TextUtils
import android.text.TextWatcher
import android.text.style.BackgroundColorSpan
import android.text.style.ForegroundColorSpan
import android.text.style.ReplacementSpan
import android.text.style.RelativeSizeSpan
import android.text.style.StrikethroughSpan
import android.text.style.UnderlineSpan
import android.util.TypedValue
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.inputmethod.BaseInputConnection
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.FrameLayout
import androidx.core.content.ContextCompat
import androidx.core.view.OnReceiveContentListener
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.widget.TextViewCompat
import coil3.SingletonImageLoader
import coil3.asDrawable
import coil3.request.ImageRequest
import coil3.request.target
import coil3.size.Size
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.events.Event
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import me.palmdevs.isocord.chat.media.buildImageLoader
import me.palmdevs.isocord.chat.rows.mentionIcon
import me.palmdevs.isocord.core.TwemojiFonts
import me.palmdevs.isocord.notifications.notify.title

/**
 * The Android view behind `IsocordChatInput` (src/native/ChatInputNativeComponent.ts): an EditText inside a host view.
 * JS owns the meaning of the text and sends style blocks that this view turns into spans.
 * Every text or selection change is reported with an `editId`, so JS can tell if its answer still fits.
 */
private const val TAG = "IsocordChatInput"

/** The input text's line height in dp, text-md/normal: 16 over 20. JS sizes the input from it. */
const val INPUT_LINE_HEIGHT_DP = 20

/** Code text relative to the surrounding text, as in the message list's inline code (MessageText.kt). */
private const val CODE_SCALE = 0.875f

class ChatInputView(context: Context) : FrameLayout(context) {
  private val density = resources.displayMetrics.density
  private val editText = ChatInputEditText(context)

  /** Spans added from style blocks, so they can be removed again without touching anything else. */
  private val managedSpans = ArrayList<Any>()
  private var blocks: List<StyleBlock> = emptyList()

  /** Bumped by every change of the text. A command or style update that carries an older id is stale and ignored. */
  private var editId = 0

  /** True while this view edits the text itself; blocks must not veto that. */
  private var programmatic = false
  private var changePosted = false
  private var lastContentHeight = -1f
  private var maxHeightDp = Float.MAX_VALUE
  private var cursorColor: Int? = null
  private var noExtractUi = false
  private var keyboardType = "default"
  private var spoilerTitle: String? = null
  private var placeholderText: String? = null
  private var appliedHint: String? = null
  private var formatMenu = false
  private val imageCache = HashMap<String, Drawable>()
  private val mentionIcons = HashMap<String, Drawable?>()
  private val pendingImages = HashSet<String>()

  private val fonts by lazy {
    fun font(name: String) = TwemojiFonts.typeface(context.assets, name)
    // A step heavier than text-md/normal, like the message text; mention pills a step heavier again.
    Fonts(
      font("ggsans-Medium"), font("ggsans-Semibold"), font("ggsans-Bold"), font("ggsans-MediumItalic"),
      font("ggsans-BoldItalic"), font("ggmono-Normal"),
    )
  }

  private class Fonts(
    val normal: Typeface,
    val mention: Typeface,
    val bold: Typeface,
    val italic: Typeface,
    val boldItalic: Typeface,
    val mono: Typeface,
  )

  init {
    SingletonImageLoader.setSafe(::buildImageLoader)
    editText.apply {
      background = null
      gravity = Gravity.TOP or Gravity.START
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
      TextViewCompat.setLineHeight(this, (INPUT_LINE_HEIGHT_DP * density).roundToInt())
      typeface = fonts.normal
      isVerticalScrollBarEnabled = true
      applyKeyboardType()
      setPadding(0, (5 * density).roundToInt(), 0, (5 * density).roundToInt())
      filters = arrayOf(EditDisabledFilter())

      addTextChangedListener(object : TextWatcher {
        override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {
          if (!programmatic && s is Spanned) findCutNodes(s, start, count, after)
        }

        override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}

        override fun afterTextChanged(s: Editable) {
          deleteCutNodes(s)
          editId++
          scheduleChangeEvent()
        }
      })
      selectionListener = { _, _ -> scheduleChangeEvent() }
      customSelectionActionModeCallback = SpoilerMenu(this, { spoilerTitle.takeIf { formatMenu } }, ::replaceRange)
      backspaceNode = ::deleteNodeBefore
      setOnFocusChangeListener { _, focused ->
        if (focused) {
          emit("topBeginFocus") {
            putInt("start", selectionStart.coerceAtLeast(0))
            putInt("end", selectionEnd.coerceAtLeast(0))
          }
        } else {
          emit("topEndBlur")
        }
      }
      // A hardware keyboard's Enter sends; Shift+Enter is a new line.
      setOnKeyListener { _, keyCode, event ->
        if (keyCode == KeyEvent.KEYCODE_ENTER && !event.isShiftPressed && event.flags and KeyEvent.FLAG_SOFT_KEYBOARD == 0) {
          if (event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) emit("topRequestSend")
          true
        } else {
          false
        }
      }
      // Images from keyboards (GIFs, stickers) and the clipboard; text goes on to the default paste.
      ViewCompat.setOnReceiveContentListener(this, arrayOf("image/*"), OnReceiveContentListener { _, payload ->
        val parts = payload.partition { item ->
          val uri = item.uri
          uri != null && context.contentResolver.getType(uri)?.startsWith("image/") == true
        }
        parts.first?.let { reportPastedImages(this@ChatInputView, it, ::emitPastedImage) }
        parts.second
      })
      viewTreeObserver.addOnPreDrawListener {
        layoutIfHeightKept()
        reportContentSize()
        true
      }
    }
    addView(editText, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
  }

  // Props

  fun setTextColorValue(color: Int) {
    editText.setTextColor(color)
    cursorColor = color
    applyCursor()
  }

  fun setEditableValue(editable: Boolean) {
    editText.isEnabled = editable
    if (!editable) editText.clearFocus()
  }

  fun setShouldShowCursor(show: Boolean) {
    editText.isCursorVisible = show
  }

  fun setPlaceholder(text: String?) {
    placeholderText = text
    applyPlaceholder(width)
  }

  /**
   * An EditText wraps its hint like text; the placeholder is one line that ends in an ellipsis when it is too long
   * for the field. Text the user types is not affected: only the hint is shortened.
   */
  private fun applyPlaceholder(viewWidth: Int) {
    val text = placeholderText?.replace('\n', ' ')
    val available = viewWidth - editText.totalPaddingLeft - editText.totalPaddingRight
    val hint = if (text == null || available <= 0) text else TextUtils.ellipsize(text, editText.paint, available.toFloat(), TextUtils.TruncateAt.END).toString()
    if (hint != appliedHint) {
      appliedHint = hint
      editText.hint = hint
    }
  }

  fun setPlaceholderColor(color: Int) {
    editText.setHintTextColor(color)
  }

  fun setSelectionColor(color: Int) {
    editText.highlightColor = color
  }

  fun setMarkAsSpoilerTitle(title: String?) {
    spoilerTitle = title
  }

  fun setShowFormatMenu(show: Boolean) {
    formatMenu = show
  }

  fun setNoExtractUI(value: Boolean) {
    noExtractUi = value
    editText.applyKeyboardType()
  }

  fun setKeyboardTypeValue(value: String) {
    keyboardType = value
    editText.applyKeyboardType()
  }

  fun setMaxHeightDp(value: Float) {
    maxHeightDp = if (value > 0f) value else Float.MAX_VALUE
    lastContentHeight = -1f
    editText.invalidate()
  }

  fun setVerticalInsetDp(value: Float) {
    val px = (value * density).roundToInt()
    editText.setPadding(0, px, 0, px)
    lastContentHeight = -1f
  }

  // Commands

  fun focusInput() {
    editText.requestFocus()
    showKeyboard()
  }

  /** Only its own keyboard: hiding the window's IME closes another field's (the channel details' search). */
  fun blurInput() {
    if (!editText.hasFocus()) return
    editText.clearFocus()
    hideKeyboard()
  }

  /** The system keyboard goes away but the field keeps focus and its cursor; JS draws its own panel in that space. */
  fun openCustomKeyboard() {
    if (!editText.hasFocus()) editText.requestFocus()
    hideKeyboard()
  }

  fun openSystemKeyboard() {
    editText.requestFocus()
    showKeyboard()
  }

  fun backspace() {
    editText.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_DEL))
    editText.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_DEL))
  }

  fun setText(text: String) {
    edit {
      editText.setText(text)
      editText.setSelection(editText.text?.length ?: 0)
    }
    // setText drops every span, ours included.
    managedSpans.clear()
    blocks = emptyList()
  }

  fun setSelectedRange(location: Int, length: Int) {
    val size = editText.text?.length ?: 0
    val start = location.coerceIn(0, size)
    editText.setSelection(start, (start + max(length, 0)).coerceIn(start, size))
  }

  fun replaceRange(location: Int, length: Int, text: String, blocksJson: String?, keepCursor: Boolean, expectedEditId: Int) {
    if (expectedEditId >= 0 && expectedEditId != editId) return
    val editable = editText.text ?: return
    val start = location.coerceIn(0, editable.length)
    val end = (start + max(length, 0)).coerceIn(start, editable.length)
    val selectionStart = editText.selectionStart
    val selectionEnd = editText.selectionEnd
    edit {
      editable.replace(start, end, text)
      val delta = text.length - (end - start)
      if (keepCursor && selectionStart >= 0) {
        // A position inside the replaced range moves to the end of the new text, one after it shifts with it.
        fun shifted(position: Int) = when {
          position <= start -> position
          position >= end -> position + delta
          else -> start + text.length
        }
        editText.setSelection(shifted(selectionStart), shifted(selectionEnd))
      } else {
        editText.setSelection(start + text.length)
      }
    }
    // The text changed, so the blocks JS sent for it describe the text as it is now.
    applyBlocks(parseStyleBlocks(blocksJson))
  }

  fun flushText(requestId: String) {
    val text = editText.text?.toString().orEmpty()
    emit("topTextFlushed") {
      putString("text", text)
      putString("requestId", requestId)
    }
  }

  fun updateTextBlocks(blocksJson: String?, expectedEditId: Int) {
    if (expectedEditId >= 0 && expectedEditId != editId) return
    applyBlocks(parseStyleBlocks(blocksJson))
  }

  // Internals

  private inline fun edit(change: () -> Unit) {
    programmatic = true
    try {
      change()
    } finally {
      programmatic = false
    }
  }

  private fun ChatInputEditText.applyKeyboardType() {
    inputType = when (keyboardType) {
      "email-address" -> InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
      "url" -> InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
      "numeric", "number-pad" -> InputType.TYPE_CLASS_NUMBER
      else -> InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE or
        InputType.TYPE_TEXT_FLAG_CAP_SENTENCES or InputType.TYPE_TEXT_FLAG_AUTO_CORRECT
    }
    // No action button: Enter is a new line (hardware Enter sends).
    imeOptions = EditorInfo.IME_FLAG_NO_ENTER_ACTION or if (noExtractUi) EditorInfo.IME_FLAG_NO_EXTRACT_UI else 0
  }

  /** One drawable, recoloured in place: the editor keeps the first cursor drawable it loads (Editor.loadCursorDrawable). */
  private val cursorDrawable by lazy {
    GradientDrawable().apply { setSize((2 * density).roundToInt(), editText.lineHeight) }
  }

  private fun applyCursor() {
    val color = cursorColor ?: return
    if (Build.VERSION.SDK_INT >= 29) {
      cursorDrawable.setColor(color)
      if (editText.textCursorDrawable !== cursorDrawable) editText.textCursorDrawable = cursorDrawable
      editText.invalidate()
    }
  }

  private fun showKeyboard() {
    editText.post {
      val window = (context as? ReactContext)?.currentActivity?.window
      val controller = window?.let { WindowCompat.getInsetsController(it, editText) }
      if (controller != null) controller.show(WindowInsetsCompat.Type.ime())
      else (context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager).showSoftInput(editText, 0)
    }
  }

  private fun hideKeyboard() {
    (context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager)
      .hideSoftInputFromWindow(editText.windowToken, 0)
  }

  /** Text and selection changes are reported once per frame, after everything that changed in it has settled. */
  private fun scheduleChangeEvent() {
    if (changePosted) return
    changePosted = true
    post {
      changePosted = false
      emit("topSelectionOrTextChange") {
        putInt("start", editText.selectionStart.coerceAtLeast(0))
        putInt("end", editText.selectionEnd.coerceAtLeast(0))
        putString("text", editText.text?.toString().orEmpty())
        putInt("editId", editId)
      }
    }
  }

  private fun reportContentSize() {
    val layout = editText.layout ?: return
    // Plain padding: totalPaddingBottom also counts the empty space under the text, so the reported size could
    // never drop below the view's current height.
    val heightDp = min((layout.height + editText.paddingTop + editText.paddingBottom) / density, maxHeightDp)
    if (kotlin.math.abs(heightDp - lastContentHeight) < 0.5f) return
    lastContentHeight = heightDp
    emit("topChangeContentSize") { putDouble("height", heightDp.toDouble()) }
  }

  /**
   *   A mention pill or custom emoji is one piece: a deletion that cuts into one takes all of it.
   *   Key events already do (TextUtils.getOffsetBefore steps over a ReplacementSpan).
   *   Soft keyboards delete with deleteSurroundingText or by shortening composing text, removing one character.
   *   Ranges are where the rest of each node will be after the edit, as [start, end) pairs.
   */
  private val cutNodes = ArrayList<IntArray>()

  private fun findCutNodes(text: Spanned, start: Int, count: Int, after: Int) {
    val end = start + count
    // Only edits that shorten the text: typing and replacing a word with a longer one keep the node as it is.
    if (count == 0 || after >= count) return
    val delta = after - count
    for (span in text.getSpans(start, end, ReplacementSpan::class.java)) {
      if (span !is PillSpan && span !is InlineImageSpan) continue
      val nodeStart = text.getSpanStart(span)
      val nodeEnd = text.getSpanEnd(span)
      if (nodeStart >= end || nodeEnd <= start || (nodeStart >= start && nodeEnd <= end)) continue
      // The text the edit puts in place of the node's end (a keyboard retyping the shortened word) goes with it.
      val from = if (nodeStart < start) nodeStart else start + after
      val to = if (nodeEnd > end) nodeEnd + delta else start + after
      if (to > from) cutNodes.add(intArrayOf(from, to))
    }
  }

  private fun deleteCutNodes(text: Editable) {
    if (cutNodes.isEmpty()) return
    val ranges = cutNodes.sortedByDescending { it[0] }
    cutNodes.clear()
    edit {
      for (range in ranges) text.delete(range[0].coerceIn(0, text.length), range[1].coerceIn(0, text.length))
      // The keyboard's composing word may have covered the node; it starts over from the new text.
      BaseInputConnection.removeComposingSpans(text)
    }
  }

  /** Backspace right after a node that asks for it deletes the whole node. */
  private fun deleteNodeBefore(cursor: Int): Boolean {
    if (editText.selectionStart != editText.selectionEnd) return false
    val node = blocks.firstOrNull { it.deleteNodeOnBackspace && it.end == cursor } ?: return false
    edit { editText.text?.delete(node.location, node.end) }
    return true
  }

  /** Rejects user edits inside a node that is not editable (command options); this view's own edits pass. */
  private inner class EditDisabledFilter : InputFilter {
    override fun filter(source: CharSequence, start: Int, end: Int, dest: Spanned, dstart: Int, dend: Int): CharSequence? {
      if (programmatic) return null
      val blocked = blocks.any { it.editDisabled && dstart < it.end && dend > it.location && !(dstart == dend && (dstart <= it.location || dstart >= it.end)) }
      return if (blocked) dest.subSequence(dstart, dend) else null
    }
  }

  private fun applyBlocks(next: List<StyleBlock>) {
    val text = editText.text ?: return
    editText.beginBatchEdit()
    try {
      managedSpans.forEach(text::removeSpan)
      managedSpans.clear()
      blocks = next.filter { it.location >= 0 && it.end <= text.length }
      for (block in blocks) {
        fun add(span: Any) {
          text.setSpan(span, block.location, block.end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
          managedSpans.add(span)
        }
        if (block.imageUrl != null) {
          add(InlineImageSpan(block.imageUrl, (editText.textSize * 1.25f).roundToInt(), imageCache[block.imageUrl]))
          loadImage(block.imageUrl)
          continue
        }
        val background = block.backgroundColor
        val pill = background != null && block.cornerRadius > 0f
        if (pill) {
          add(PillSpan(block.runs, block.color, background, block.cornerRadius * density, 2 * density, ::mentionIconDrawable))
        } else {
          block.color?.let { add(ForegroundColorSpan(it)) }
          background?.let { add(BackgroundColorSpan(it)) }
        }
        if (block.monospace) add(RelativeSizeSpan(CODE_SCALE))
        when {
          block.monospace -> add(FontSpan(fonts.mono))
          pill -> add(FontSpan(fonts.mention))
          block.bold && block.italic -> add(FontSpan(fonts.boldItalic))
          block.bold -> add(FontSpan(fonts.bold))
          block.italic -> add(FontSpan(fonts.italic))
        }
        if (block.strikethrough) add(StrikethroughSpan())
        if (block.underline) add(UnderlineSpan())
      }
    } finally {
      editText.endBatchEdit()
    }
  }

  /** Returns a pill's icon, the message list's drawable (MessageText.kt `mentionIcon`), tinted by the pill. */
  private fun mentionIconDrawable(name: String): Drawable? = mentionIcons.getOrPut(name) {
    mentionIcon(name)?.let { ContextCompat.getDrawable(context, it)?.mutate() }
  }

  private fun loadImage(url: String) {
    if (imageCache.containsKey(url) || !pendingImages.add(url)) return
    val request = ImageRequest.Builder(context)
      .data(url)
      .size(Size((editText.textSize * 2).roundToInt(), (editText.textSize * 2).roundToInt()))
      .target(
        onError = { pendingImages.remove(url) },
        onSuccess = { image ->
          pendingImages.remove(url)
          val drawable = image.asDrawable(resources)
          imageCache[url] = drawable
          managedSpans.forEach { if (it is InlineImageSpan && it.url == url) it.drawable = drawable }
          redrawImageSpans(drawable)
          if (drawable is Animatable) {
            drawable.callback = animationCallback
            if (isAttachedToWindow) drawable.start()
          }
        },
      )
      .build()
    SingletonImageLoader.get(context).enqueue(request)
  }

  /**
   * Redraws the emoji spans that show [drawable].
   * invalidate() alone redraws the text's cached display lists as they were; setting a span again marks its range dirty.
   */
  private fun redrawImageSpans(drawable: Drawable) {
    val text = editText.text ?: return
    for (span in managedSpans) {
      if (span !is InlineImageSpan || span.drawable !== drawable) continue
      val start = text.getSpanStart(span)
      if (start >= 0) text.setSpan(span, start, text.getSpanEnd(span), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
    }
  }

  /** Animated emoji: each new frame redraws its spans. Kept here because a drawable holds its callback weakly. */
  private val animationCallback = object : Drawable.Callback {
    override fun invalidateDrawable(who: Drawable) = redrawImageSpans(who)

    override fun scheduleDrawable(who: Drawable, what: Runnable, `when`: Long) {
      editText.postDelayed(what, `when` - SystemClock.uptimeMillis())
    }

    override fun unscheduleDrawable(who: Drawable, what: Runnable) {
      editText.removeCallbacks(what)
    }
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    imageCache.values.forEach { (it as? Animatable)?.start() }
  }

  override fun onDetachedFromWindow() {
    imageCache.values.forEach { (it as? Animatable)?.stop() }
    super.onDetachedFromWindow()
  }

  // Host plumbing: React Native lays this view out without measuring it, and ignores layout requests from children.

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    val width = right - left
    val height = bottom - top
    val resized = width != editText.width || height != editText.height
    applyPlaceholder(width)
    layoutEditText(width, height)
    // The field grows and shrinks over several frames (ChatInput animates its height). The scroll is only fitted to
    // the cursor when the cursor moves, so without this a line scrolled away at a smaller height stays hidden.
    if (resized) editText.bringPointIntoView(editText.selectionEnd.coerceAtLeast(0))
  }

  private fun emitPastedImage(url: String, width: Int, height: Int, type: String) {
    emit("topPasteImage") {
      putString("url", url)
      putInt("width", width)
      putInt("height", height)
      putString("type", type)
    }
  }

  private fun layoutEditText(width: Int, height: Int) {
    editText.measure(
      View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
      View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY),
    )
    editText.layout(0, 0, width, height)
  }

  /**
   *   A line added or removed makes the EditText ask for a layout, and it defers scrolling to the cursor until then (TextView.bringPointIntoView).
   *   React Native lays this view out only on height changes, so at max height a new line would stay below the edge.
   *   A height about to change is left to React Native, since laying out at the old height would scroll for a frame.
   */
  private fun layoutIfHeightKept() {
    if (!editText.isLayoutRequested || width == 0) return
    val layout = editText.layout ?: return
    val contentHeight = min((layout.height + editText.paddingTop + editText.paddingBottom).toFloat(), maxHeightDp * density)
    if (contentHeight - height < 1f) layoutEditText(width, height)
  }

  private fun emit(name: String, fill: WritableMap.() -> Unit = {}) {
    val reactContext = context as? ReactContext ?: return
    val data = Arguments.createMap().apply(fill)
    UIManagerHelper.getEventDispatcher(reactContext)
      ?.dispatchEvent(InputEvent(UIManagerHelper.getSurfaceId(this), id, name, data))
  }

  private class InputEvent(surfaceId: Int, viewId: Int, private val name: String, private val data: WritableMap) :
    Event<InputEvent>(surfaceId, viewId) {
    override fun getEventName(): String = name

    override fun getEventData(): WritableMap = data

    // Every one of these reports a state JS must see in order.
    override fun canCoalesce(): Boolean = false
  }
}
