package me.palmdevs.isocord.voice.overlay

import android.content.Context
import android.graphics.Color
import android.graphics.Point
import android.graphics.Rect
import android.graphics.drawable.GradientDrawable
import android.util.Log
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.View
import android.view.WindowManager
import android.view.animation.AnimationUtils
import android.view.animation.OvershootInterpolator
import android.widget.FrameLayout
import android.widget.ImageView
import me.palmdevs.isocord.R

private const val TAG = "IsocordVoice"

/** trash_bg: a radial shade from 30% black at the bottom to clear. */
private const val SHADE_COLOR = 0x4d000000
/** trash_bg's centre and radius, as shares of the area. */
private const val SHADE_CENTER_Y = 0.95f
private const val SHADE_RADIUS = 0.95f
/** Area under the trash that the shade covers, dp. trash_wrap_min_dimen is unreadable in RDX: ours. */
private const val AREA_HEIGHT_DP = 160f
/** The target's size, dp. bubble_size_default is unreadable in RDX: ours. */
private const val TARGET_SIZE_DP = 56f
/** trash_wrap_target_container's bottom margin, above the navigation bar. */
private const val TARGET_MARGIN_BOTTOM_DP = 48f
/** trash_wrap_icon's size. */
private const val ICON_SIZE_DP = 24f

/** ic_trash_outline: fill and stroke at rest and with a bubble over it. */
private const val TARGET_FILL = 0x991d1d1d.toInt()
private const val TARGET_FILL_ACTIVE = 0x4d1d1d1d
private const val TARGET_STROKE_DP = 2f
private const val TARGET_STROKE_ACTIVE_DP = 4f

/** handleViewDraggedIntoTrashZone's grow and its length. */
private const val TARGET_ACTIVE_SCALE = 1.5f
private const val TARGET_SCALE_MS = 200L
/** fade_in, fade_out and the slides: unreadable in RDX, ours. */
private const val SHOW_MS = 200L

/**
 * OverlayTrashWrap: a window along the screen's bottom with the drop target. It never takes touches. The bubble
 * reports the finger to [track], which says whether the finger is over the target.
 */
internal class OverlayTrash(private val context: Context) {
  private val windows = context.getSystemService(WindowManager::class.java)
  private val targetSize = context.dp(TARGET_SIZE_DP).toInt()
  private val target = GradientDrawable().apply {
    shape = GradientDrawable.OVAL
    setColor(TARGET_FILL)
    setStroke(context.dp(TARGET_STROKE_DP).toInt(), Color.WHITE)
  }
  private val targetView = ImageView(context).apply {
    background = target
    setImageResource(R.drawable.overlay_trash_close)
    setColorFilter(Color.WHITE)
    scaleType = ImageView.ScaleType.CENTER_INSIDE
    val padding = ((targetSize - context.dp(ICON_SIZE_DP)) / 2).toInt()
    setPadding(padding, padding, padding, padding)
    importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
  }
  private val root = FrameLayout(context).apply {
    visibility = View.INVISIBLE
    addView(
      targetView,
      FrameLayout.LayoutParams(targetSize, targetSize, Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL),
    )
  }
  private var attached = false
  private var over = false

  /** Adds the window, hidden. */
  fun attach() {
    if (attached) return
    val insets = systemInsets(context)
    val height = context.dp(AREA_HEIGHT_DP).toInt() + insets.bottom
    root.background = GradientDrawable().apply {
      gradientType = GradientDrawable.RADIAL_GRADIENT
      colors = intArrayOf(SHADE_COLOR, Color.TRANSPARENT)
      setGradientCenter(0.5f, SHADE_CENTER_Y)
      gradientRadius = screenBounds(context).width() * SHADE_RADIUS
    }
    (targetView.layoutParams as FrameLayout.LayoutParams).bottomMargin =
      context.dp(TARGET_MARGIN_BOTTOM_DP).toInt() + insets.bottom
    val params = overlayLayoutParams().apply {
      width = WindowManager.LayoutParams.MATCH_PARENT
      this.height = height
      gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
      flags = flags or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
    }
    windows.addView(root, params)
    attached = true
  }

  fun detach() {
    if (!attached) return
    root.animate().cancel()
    try {
      windows.removeView(root)
    } catch (e: IllegalArgumentException) {
      Log.w(TAG, "Overlay trash was not attached", e)
    }
    attached = false
  }

  /** showAnimator: fades in while the target rises from below. */
  fun show() {
    root.visibility = View.VISIBLE
    root.alpha = 0f
    root.animate().alpha(1f).setDuration(SHOW_MS).withEndAction(null).start()
    targetView.translationY = targetSize.toFloat()
    targetView.animate().translationY(0f).setDuration(SHOW_MS).start()
  }

  /** hideAnimator: fades out while the target sinks, then hides. */
  fun hide() {
    setOver(false)
    root.animate().alpha(0f).setDuration(SHOW_MS).withEndAction { root.visibility = View.INVISIBLE }.start()
    targetView.animate().translationY(targetSize.toFloat()).setDuration(SHOW_MS).start()
  }

  /** The target's centre on screen: where a bubble over it is pulled to. */
  fun center(): Point {
    val screen = screenBounds(context)
    val bottom = screen.bottom - systemInsets(context).bottom - context.dp(TARGET_MARGIN_BOTTOM_DP)
    return Point(screen.centerX(), (bottom - targetSize / 2f).toInt())
  }

  /**
   * Takes the finger's screen position during a drag and returns whether it is over the target
   * (processMotionEvent). The zone is the target padded by its size on the sides and top.
   */
  fun track(x: Float, y: Float): Boolean {
    val c = center()
    val half = targetSize / 2
    val zone = Rect(c.x - half - targetSize, c.y - half - targetSize, c.x + half + targetSize, screenBounds(context).bottom)
    val inside = zone.contains(x.toInt(), y.toInt())
    setOver(inside)
    return inside
  }

  /** handleViewDraggedIntoTrashZone and OutOfTrashZone: the target grows and thickens, with a tick each way. */
  private fun setOver(value: Boolean) {
    if (value == over) return
    over = value
    root.performHapticFeedback(HapticFeedbackConstants.CONTEXT_CLICK)
    target.setColor(if (value) TARGET_FILL_ACTIVE else TARGET_FILL)
    target.setStroke(context.dp(if (value) TARGET_STROKE_ACTIVE_DP else TARGET_STROKE_DP).toInt(), Color.WHITE)
    val scale = if (value) TARGET_ACTIVE_SCALE else 1f
    targetView.animate().scaleX(scale).scaleY(scale).setDuration(TARGET_SCALE_MS)
      .setInterpolator(
        if (value) OvershootInterpolator()
        else AnimationUtils.loadInterpolator(context, android.R.interpolator.fast_out_slow_in),
      ).start()
  }
}
