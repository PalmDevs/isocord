package me.palmdevs.isocord.chat

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.os.Build
import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver
import android.widget.ScrollView
import androidx.annotation.RequiresApi
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.PixelUtil.dpToPx
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewGroupManager
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.viewmanagers.IsocordListPlaceholdersViewManagerDelegate
import com.facebook.react.viewmanagers.IsocordListPlaceholdersViewManagerInterface
import com.facebook.react.views.view.ReactViewGroup
import kotlin.math.roundToInt

/**
 * Wraps a list and draws FastestListPlaceholderTypeFeedItem rows behind its scroll view, in the gaps between the
 * mounted rows. Reads the mounted views at draw time, so a fast fling shows placeholders until the rows mount.
 */
class ListPlaceholdersView(context: Context) : ReactViewGroup(context) {
  private val cardPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.TRANSPARENT }
  private val shapePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.TRANSPARENT }
  private var scroller: ScrollView? = null
  private val onScroll = ViewTreeObserver.OnScrollChangedListener { invalidate() }

  // Content spans (px) of the mounted rows, reused between frames.
  private var tops = FloatArray(INITIAL_SPANS)
  private var bottoms = FloatArray(INITIAL_SPANS)
  private var spans = 0

  // dp, from props.
  var rowHeight = 0f
  var sideInset = 0f
  var endInset = 0f
  var rowPaddingStart = 0f
  var labelGap = 0f
  var rowPaddingEnd = 0f
  var avatarSize = 0f
  var avatarRadius = 0f
  var labelHeight = 0f
  var labelRadius = 0f
  var labelWidthMin = 0f
  var labelWidthMax = 0f

  fun setCardColor(color: Int?) {
    cardPaint.color = color ?: Color.TRANSPARENT
  }

  fun setShapeColor(color: Int?) {
    shapePaint.color = color ?: Color.TRANSPARENT
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    viewTreeObserver.addOnScrollChangedListener(onScroll)
  }

  override fun onDetachedFromWindow() {
    viewTreeObserver.removeOnScrollChangedListener(onScroll)
    scroller = null
    super.onDetachedFromWindow()
  }

  /**
   * Redraws when a row mounts, moves or unmounts. Fabric lays views out directly, so no global layout fires, and
   * without this the gaps a recycled cell leaves behind stay blank until the next scroll.
   */
  @RequiresApi(Build.VERSION_CODES.O)
  override fun onDescendantInvalidated(child: View, target: View) {
    super.onDescendantInvalidated(child, target)
    invalidate()
  }

  override fun dispatchDraw(canvas: Canvas) {
    val list = scrollView()
    val content = list?.getChildAt(0) as? ViewGroup
    // A fling advances in the scroll view's own draw, after this one. Advance it now so the rows and
    // placeholders share this frame's offset. Repeating it in the same frame is a no-op.
    list?.computeScroll()
    if (list != null && content != null && rowHeight > 0f) drawPlaceholders(canvas, list, content)
    super.dispatchDraw(canvas)
  }

  private fun drawPlaceholders(canvas: Canvas, list: ScrollView, content: ViewGroup) {
    spans = 0
    collectSpans(content, 0f, list.height)
    sortSpans()
    val pitch = rowHeight.dpToPx()
    val end = content.height - endInset.dpToPx()
    val origin = list.top + content.top - list.scrollY.toFloat()
    val visibleTop = list.scrollY.toFloat()
    val visibleBottom = visibleTop + list.height
    canvas.save()
    canvas.clipRect(list.left, list.top, list.right, list.bottom)
    // Before the first row, rows end where it starts. After a row, they start where it ends.
    var gapStart = 0f
    var upwards = true
    for (i in 0..spans) {
      val gapEnd = if (i < spans) tops[i] else end
      if (gapEnd - gapStart >= pitch / 2f && gapEnd > visibleTop && gapStart < visibleBottom) {
        drawGap(canvas, origin, gapStart, gapEnd, upwards && i < spans, visibleTop, visibleBottom)
      }
      if (i < spans) gapStart = maxOf(gapStart, bottoms[i])
      upwards = false
    }
    canvas.restore()
  }

  /** Tiles rows over one gap (content px), anchored to the mounted row next to it. */
  private fun drawGap(
    canvas: Canvas,
    origin: Float,
    start: Float,
    end: Float,
    upwards: Boolean,
    visibleTop: Float,
    visibleBottom: Float,
  ) {
    val pitch = rowHeight.dpToPx()
    val list = scroller ?: return
    val left = list.left + sideInset.dpToPx()
    val right = list.right - sideInset.dpToPx()
    canvas.save()
    canvas.clipRect(list.left.toFloat(), origin + start, list.right.toFloat(), origin + end)
    var y = if (upwards) end - pitch else start
    while (if (upwards) y + pitch > start else y < end) {
      if (y < visibleBottom && y + pitch > visibleTop) drawRow(canvas, (y / pitch).roundToInt(), left, origin + y, right)
      y += if (upwards) -pitch else pitch
    }
    canvas.restore()
  }

  /** FeedItemDrawable.draw: the card, the avatar at the start and a rounded label bar, vertically centred. */
  private fun drawRow(canvas: Canvas, index: Int, left: Float, top: Float, right: Float) {
    val height = rowHeight.dpToPx()
    if (Color.alpha(cardPaint.color) != 0) canvas.drawRect(left, top, right, top + height, cardPaint)
    val avatar = avatarSize.dpToPx()
    val avatarStart = left + rowPaddingStart.dpToPx()
    val avatarTop = top + (height - avatar) / 2f
    val avatarCorner = avatarRadius.dpToPx()
    canvas.drawRoundRect(avatarStart, avatarTop, avatarStart + avatar, avatarTop + avatar, avatarCorner, avatarCorner, shapePaint)
    // skeletonWidth(index + 1, min, max), as the JS placeholder rows.
    val ratio = labelWidthMin + (labelWidthMax - labelWidthMin) * fraction(index + 1)
    val labelStart = avatarStart + avatar + labelGap.dpToPx()
    val labelEnd = labelStart + (right - rowPaddingEnd.dpToPx() - labelStart) * ratio
    val label = labelHeight.dpToPx()
    val labelTop = top + (height - label) / 2f
    val labelCorner = labelRadius.dpToPx()
    canvas.drawRoundRect(labelStart, labelTop, labelEnd, labelTop + label, labelCorner, labelCorner, shapePaint)
  }

  /**
   * Records the content spans of the visible views under [group]. A container taller than the viewport, such as
   * FlashList's cell container, is looked into instead of counted.
   */
  private fun collectSpans(group: ViewGroup, offset: Float, viewport: Int) {
    for (i in 0 until group.childCount) {
      val child = group.getChildAt(i)
      if (child.visibility != View.VISIBLE || child.alpha == 0f || child.height == 0) continue
      val top = offset + child.top + child.translationY
      if (child is ViewGroup && child.height > viewport) {
        collectSpans(child, top, viewport)
      } else {
        addSpan(top, top + child.height)
      }
    }
  }

  private fun addSpan(top: Float, bottom: Float) {
    if (spans == tops.size) {
      tops = tops.copyOf(spans * 2)
      bottoms = bottoms.copyOf(spans * 2)
    }
    tops[spans] = top
    bottoms[spans] = bottom
    spans++
  }

  /** Insertion sort by top: a few dozen spans, mostly in order already. */
  private fun sortSpans() {
    for (i in 1 until spans) {
      val top = tops[i]
      val bottom = bottoms[i]
      var j = i - 1
      while (j >= 0 && tops[j] > top) {
        tops[j + 1] = tops[j]
        bottoms[j + 1] = bottoms[j]
        j--
      }
      tops[j + 1] = top
      bottoms[j + 1] = bottom
    }
  }

  /** Returns the list's scroll view: the first one among the children. */
  private fun scrollView(): ScrollView? {
    scroller?.takeIf { it.isAttachedToWindow }?.let { return it }
    scroller = findScrollView(this)
    return scroller
  }

  private fun findScrollView(view: View): ScrollView? {
    if (view is ScrollView) return view
    if (view !is ViewGroup) return null
    for (i in 0 until view.childCount) findScrollView(view.getChildAt(i))?.let { return it }
    return null
  }

  private companion object {
    const val INITIAL_SPANS = 64
  }
}

/** Exposes [ListPlaceholdersView] to React (src/native/ListPlaceholdersViewNativeComponent.ts). */
@ReactModule(name = ListPlaceholdersViewManager.NAME)
class ListPlaceholdersViewManager :
  ViewGroupManager<ListPlaceholdersView>(),
  IsocordListPlaceholdersViewManagerInterface<ListPlaceholdersView> {
  private val delegate =
    IsocordListPlaceholdersViewManagerDelegate<ListPlaceholdersView, ListPlaceholdersViewManager>(this)

  override fun getDelegate(): ViewManagerDelegate<ListPlaceholdersView> = delegate

  override fun getName(): String = NAME

  override fun createViewInstance(context: ThemedReactContext) = ListPlaceholdersView(context)

  override fun setCardColor(view: ListPlaceholdersView, value: Int?) = view.setCardColor(value)

  override fun setShapeColor(view: ListPlaceholdersView, value: Int?) = view.setShapeColor(value)

  override fun setRowHeight(view: ListPlaceholdersView, value: Float) {
    view.rowHeight = value
  }

  override fun setSideInset(view: ListPlaceholdersView, value: Float) {
    view.sideInset = value
  }

  override fun setEndInset(view: ListPlaceholdersView, value: Float) {
    view.endInset = value
  }

  override fun setRowPaddingStart(view: ListPlaceholdersView, value: Float) {
    view.rowPaddingStart = value
  }

  override fun setLabelGap(view: ListPlaceholdersView, value: Float) {
    view.labelGap = value
  }

  override fun setRowPaddingEnd(view: ListPlaceholdersView, value: Float) {
    view.rowPaddingEnd = value
  }

  override fun setAvatarSize(view: ListPlaceholdersView, value: Float) {
    view.avatarSize = value
  }

  override fun setAvatarRadius(view: ListPlaceholdersView, value: Float) {
    view.avatarRadius = value
  }

  override fun setLabelHeight(view: ListPlaceholdersView, value: Float) {
    view.labelHeight = value
  }

  override fun setLabelRadius(view: ListPlaceholdersView, value: Float) {
    view.labelRadius = value
  }

  override fun setLabelWidthMin(view: ListPlaceholdersView, value: Float) {
    view.labelWidthMin = value
  }

  override fun setLabelWidthMax(view: ListPlaceholdersView, value: Float) {
    view.labelWidthMax = value
  }

  override fun onAfterUpdateTransaction(view: ListPlaceholdersView) {
    super.onAfterUpdateTransaction(view)
    view.invalidate()
  }

  companion object {
    const val NAME = "IsocordListPlaceholdersView"
  }
}
