package me.palmdevs.isocord.voice.overlay

import android.content.Context
import android.graphics.PixelFormat
import android.graphics.Rect
import android.os.Build
import android.util.TypedValue
import android.view.WindowInsets
import android.view.WindowManager

/**
 * MorphablePanelConstants.PIP_WINDOW_OFFSET: the PIP's least distance from the screen's edges, dp. The in-app PIP
 * reads it too. The bubble keeps it from the system bars as well.
 */
const val PIP_WINDOW_OFFSET_DP = 16f

/**
 * Returns the params of an overlay window (WindowUtils.createWindowLayoutParams): wrapped size, over other apps,
 * never focused, touches outside it pass through, free to sit under the system bars.
 */
@Suppress("DEPRECATION")
internal fun overlayLayoutParams(): WindowManager.LayoutParams {
  val type =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
    else WindowManager.LayoutParams.TYPE_PRIORITY_PHONE
  return WindowManager.LayoutParams(
    WindowManager.LayoutParams.WRAP_CONTENT,
    WindowManager.LayoutParams.WRAP_CONTENT,
    type,
    WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED or
      WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
      WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
    PixelFormat.TRANSLUCENT,
  ).apply {
    // Screen coordinates: the windows keep clear of the bars and cutout themselves (allowedArea).
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      fitInsetsTypes = 0
      layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
    }
  }
}

/** Returns `dp` in pixels. */
internal fun Context.dp(dp: Float): Float =
  TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, dp, resources.displayMetrics)

/** Returns the screen's size, in pixels. */
@Suppress("DEPRECATION")
internal fun screenBounds(context: Context): Rect {
  val windows = context.getSystemService(WindowManager::class.java)
  if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) return windows.maximumWindowMetrics.bounds
  val metrics = android.util.DisplayMetrics()
  windows.defaultDisplay.getRealMetrics(metrics)
  return Rect(0, 0, metrics.widthPixels, metrics.heightPixels)
}

/** Returns the system bars' and cutout's insets. Before Android 11 there is no API outside an activity: none. */
internal fun systemInsets(context: Context): Rect {
  if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return Rect()
  val insets = context.getSystemService(WindowManager::class.java).maximumWindowMetrics.windowInsets
    .getInsetsIgnoringVisibility(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
  return Rect(insets.left, insets.top, insets.right, insets.bottom)
}

/**
 * Returns where a window's top-left corner may go so all of it stays in the safe area
 * (OverlayBubbleWrap.getAllowedAreaBounds). `right` and `bottom` are already less the window's size.
 */
internal fun allowedArea(context: Context, width: Int, height: Int): Rect {
  val screen = screenBounds(context)
  val insets = systemInsets(context)
  val offset = context.dp(PIP_WINDOW_OFFSET_DP).toInt()
  val area = Rect(
    screen.left + insets.left + offset,
    screen.top + insets.top + offset,
    screen.right - insets.right - offset - width,
    screen.bottom - insets.bottom - offset - height,
  )
  // A window wider than the area keeps its left edge.
  if (area.right < area.left) area.right = area.left
  if (area.bottom < area.top) area.bottom = area.top
  return area
}
