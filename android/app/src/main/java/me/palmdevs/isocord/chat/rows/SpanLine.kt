package me.palmdevs.isocord.chat.rows

import android.content.Context
import android.graphics.drawable.Animatable
import android.graphics.drawable.Drawable
import android.util.Log
import android.view.View
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Canvas
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.drawscope.CanvasDrawScope
import androidx.compose.ui.graphics.drawscope.inset
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.font.createFontFamilyResolver
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.sp
import coil3.SingletonImageLoader
import coil3.asDrawable
import coil3.request.Disposable
import coil3.request.ImageRequest
import kotlin.math.max
import kotlin.math.roundToInt
import me.palmdevs.isocord.chat.ChatFonts
import me.palmdevs.isocord.chat.media.resourceBitmap

/**
 * [SpanText] drawn onto a plain view, for list rows that rebind on every scroll (the DM list preview).
 * A ComposeView per row recomposes and measures twice per rebind. This lays out [buildSpanText]'s text once,
 * with one [TextMeasurer] and its cache for every line. Placeholders draw as in the chat ([drawSpanPlaceholder]).
 * Main thread only.
 */
internal class SpanLine(private val view: View) {
  /** What the line shows. [color] is the text colour, [maxLines] the clamp. Sizes are sp. */
  data class Input(
    val spans: List<Span>,
    val theme: ChatTheme,
    val color: Color,
    val fontSize: Float,
    val lineHeight: Float,
    val prefix: String?,
    val maxLines: Int,
    val trailingIcon: String?,
  )

  private var input: Input? = null
  private var width = 0
  private var layout: TextLayoutResult? = null
  /** The id of each placeholder of [layout], in order. */
  private var placeholderIds = emptyList<String>()
  private val emoji = HashMap<String, Drawable>()
  private val requests = HashMap<String, Disposable>()
  private val drawScope = CanvasDrawScope()
  private var animating = false

  /** The laid-out height in px: the text, or the trailing icon if taller. */
  var height = 0
    private set

  /** Whether the line limit cut the text. */
  val truncated get() = layout?.hasVisualOverflow == true

  /** Lays out [input] at [width] px when either changed, before a draw. Returns whether it did. */
  fun update(input: Input, width: Int): Boolean {
    if (input == this.input && width == this.width) return false
    this.input = input
    this.width = width
    measure(input, width)
    // Not before the first layout: a new view gets its props at no width, and knows its placeholders only after.
    if (layout != null) loadEmoji(input.fontSize)
    return true
  }

  fun draw(canvas: android.graphics.Canvas) {
    val input = input ?: return
    val layout = layout ?: return
    val density = Density(view.context)
    // ChannelRowPreview's Row centres the text and the icon on each other.
    val top = (height - layout.size.height) / 2f
    val size = Size(view.width.toFloat(), view.height.toFloat())
    drawScope.draw(density, LayoutDirection.Ltr, Canvas(canvas), size) {
      translate(top = top) {
        drawText(layout)
        layout.placeholderRects.forEachIndexed { index, rect ->
          val id = placeholderIds[index]
          if (rect == null || isEmojiPlaceholder(id)) return@forEachIndexed
          inset(rect.left, rect.top, this.size.width - rect.right, this.size.height - rect.bottom) {
            drawSpanPlaceholder(id, input.theme, view.resources, TextUnit.Unspecified)
          }
        }
      }
      val icon = input.trailingIcon?.let(::previewIconRes) ?: return@draw
      val side = PREVIEW_ICON_SIZE.roundToPx()
      drawImage(
        resourceBitmap(view.resources, icon),
        dstOffset = IntOffset(layout.size.width + PREVIEW_ICON_GAP.roundToPx(), (height - side) / 2),
        dstSize = IntSize(side, side),
        colorFilter = ColorFilter.tint(input.color),
      )
    }
    layout.placeholderRects.forEachIndexed { index, rect ->
      val drawable = emoji[placeholderIds[index]] ?: return@forEachIndexed
      if (rect == null) return@forEachIndexed
      drawable.setBounds(rect.left.roundToInt(), (rect.top + top).roundToInt(), rect.right.roundToInt(), (rect.bottom + top).roundToInt())
      drawable.draw(canvas)
    }
  }

  /** Returns whether [drawable] is one of this line's emoji, for [View.verifyDrawable]. */
  fun owns(drawable: Drawable) = emoji.containsValue(drawable)

  /** Forgets the last layout, so the next [update] lays out and reports again. */
  fun reset() {
    input = null
    width = 0
  }

  /** Plays animated emoji while the view is attached. */
  fun setAnimating(animating: Boolean) {
    this.animating = animating
    emoji.values.forEach { animate(it) }
  }

  private fun measure(input: Input, width: Int) {
    if (width <= 0) {
      layout = null
      height = 0
      return
    }
    val context = view.context
    val density = Density(context)
    val fonts = ChatFonts.shared(context)
    // Every text-*/medium and heading-*/normal variant is ggsans-Medium.
    val style = TextStyle(
      color = input.color,
      fontSize = input.fontSize.sp,
      lineHeight = input.lineHeight.sp,
      fontWeight = FontWeight.Medium,
      fontFamily = fonts.sans,
    )
    val body = buildSpanText(input.spans, input.theme, fonts, style.fontSize, null, false, density, onLink = null, onSpoiler = null)
    // ChannelRowPreview: the author label is part of the same text, in the same style.
    val text = if (input.prefix.isNullOrEmpty()) body else buildAnnotatedString { append(input.prefix); append(body) }
    val sizes = spanPlaceholders(input.spans, style.fontSize * INLINE_EMOJI_SCALE)
    // An id without a size stays plain text, as BasicText leaves it.
    val ranges = spanPlaceholderRanges(text).filter { it.item in sizes }
    placeholderIds = ranges.map { it.item }
    // The icon keeps its size. The text takes the rest of the width.
    val hasIcon = input.trailingIcon?.let(::previewIconRes) != null
    val iconWidth = if (hasIcon) with(density) { (PREVIEW_ICON_GAP + PREVIEW_ICON_SIZE).roundToPx() } else 0
    val result = measurer(context).measure(
      text,
      style,
      overflow = TextOverflow.Ellipsis,
      maxLines = input.maxLines,
      placeholders = ranges.map { AnnotatedString.Range(sizes.getValue(it.item), it.start, it.end) },
      constraints = Constraints(maxWidth = (width - iconWidth).coerceAtLeast(0)),
      density = density,
    )
    layout = result
    height = if (hasIcon) max(result.size.height, with(density) { PREVIEW_ICON_SIZE.roundToPx() }) else result.size.height
  }

  /** Loads the emoji images of the current layout, dropping those it no longer shows. Skips loaded and pending ones. */
  private fun loadEmoji(fontSize: Float) {
    val urls = placeholderIds.filter(::isEmojiPlaceholder).toSet()
    (requests.keys - urls).forEach { requests.remove(it)?.dispose() }
    (emoji.keys - urls).forEach { url -> emoji.remove(url)?.let(::release) }
    val context = view.context
    val side = with(Density(context)) { (fontSize.sp * INLINE_EMOJI_SCALE).roundToPx() }
    val loader = SingletonImageLoader.get(context)
    for (url in urls) {
      if (url in emoji || url in requests) continue
      val request = ImageRequest.Builder(context)
        .data(url)
        .size(side)
        .listener(onError = { _, result ->
          requests.remove(url)
          Log.w(TAG, "Couldn't load emoji $url", result.throwable)
        })
        .target(
          onSuccess = { image ->
            requests.remove(url)
            val drawable = image.asDrawable(view.resources)
            drawable.callback = view
            emoji[url] = drawable
            animate(drawable)
            view.invalidate()
          },
        )
        .build()
      loader.enqueue(request).takeUnless { it.isDisposed || url in emoji }?.let { requests[url] = it }
    }
  }

  private fun animate(drawable: Drawable) {
    val animatable = drawable as? Animatable ?: return
    if (animating) animatable.start() else animatable.stop()
  }

  private fun release(drawable: Drawable) {
    (drawable as? Animatable)?.stop()
    drawable.callback = null
  }

  private companion object {
    const val TAG = "IsocordSpanLine"

    /** Enough for the rows on screen and those recycled around them. */
    const val MEASURE_CACHE = 64

    var measurer: TextMeasurer? = null

    /** Returns the measurer every line shares, so its cache serves rows that rebind to text seen before. */
    fun measurer(context: Context): TextMeasurer = measurer ?: TextMeasurer(
      createFontFamilyResolver(context.applicationContext),
      Density(context),
      LayoutDirection.Ltr,
      MEASURE_CACHE,
    ).also { measurer = it }
  }
}
