package me.palmdevs.isocord.voice.overlay

import android.annotation.SuppressLint
import android.content.Context
import android.content.res.Configuration
import android.util.Log
import android.view.Gravity
import android.view.MotionEvent
import android.view.VelocityTracker
import android.view.ViewConfiguration
import android.view.WindowManager
import android.widget.FrameLayout
import androidx.dynamicanimation.animation.FloatPropertyCompat
import androidx.dynamicanimation.animation.SpringAnimation
import androidx.dynamicanimation.animation.SpringForce
import com.facebook.react.interfaces.fabric.ReactSurface
import kotlin.math.hypot

private const val TAG = "IsocordVoice"

/** OverlayBubbleWrap's springs. */
private const val SPRING_STIFFNESS = 200f
private const val SPRING_DAMPING = 0.75f
/** The bubble's fade as it drops into the trash. fade_out is unreadable in RDX: ours. */
private const val TRASH_FADE_MS = 200L
/** VelocityTracker units: pixels per second. */
private const val VELOCITY_UNITS = 1000

/** Where the bubble rests: its side of the screen and its top edge, in pixels. */
internal data class BubbleRest(val right: Boolean, val y: Int)

/**
 * OverlayVoiceBubble with OverlayBubbleWrap's movement: a window over other apps that holds a React surface (the
 * PIP). A drag past the touch slop takes the touch from React and moves the window. A release springs it to the
 * nearer side, or into the trash. Main thread only.
 */
@SuppressLint("ViewConstructor")
internal class OverlayBubble(
  private val context: Context,
  private val surface: ReactSurface,
  private var rest: BubbleRest?,
  private val onRest: (BubbleRest) -> Unit,
  private val onTrashed: () -> Unit,
) {
  private val windows = context.getSystemService(WindowManager::class.java)
  private val params = overlayLayoutParams().apply { gravity = Gravity.TOP or Gravity.START }
  private val view = BubbleView()
  private val trash = OverlayTrash(context)
  private val touchSlop = ViewConfiguration.get(context).scaledTouchSlop
  private val springX = spring(PositionX)
  private val springY = spring(PositionY)
  private var attached = false
  private var started = false
  private var dragging = false
  /** The bubble is pulled onto the trash target (OverlayBubbleWrap.anchorOn). */
  private var anchored = false
  private var trashing = false
  private var velocity: VelocityTracker? = null
  private var downX = 0f
  private var downY = 0f
  private var startX = 0
  private var startY = 0

  /** Adds the window. Returns false when the system refuses it, such as a revoked permission. */
  fun attach(): Boolean {
    surface.view?.let { view.addView(it) }
    view.addOnLayoutChangeListener { _, left, top, right, bottom, oldLeft, oldTop, oldRight, oldBottom ->
      // The contents changed size, such as a longer channel name: stay on the side.
      if (right - left != oldRight - oldLeft || bottom - top != oldBottom - oldTop) placeAtRest()
    }
    try {
      windows.addView(view, params)
      attached = true
      trash.attach()
    } catch (e: WindowManager.BadTokenException) {
      Log.w(TAG, "Overlay window refused", e)
      return false
    } catch (e: SecurityException) {
      Log.w(TAG, "Overlay window not allowed", e)
      return false
    }
    surface.start()
    started = true
    return true
  }

  fun remove() {
    springX.cancel()
    springY.cancel()
    view.animate().cancel()
    velocity?.recycle()
    velocity = null
    trash.detach()
    if (attached) windows.removeView(view)
    attached = false
    if (started) surface.stop()
    started = false
  }

  private fun spring(property: FloatPropertyCompat<OverlayBubble>) =
    SpringAnimation(this, property).apply {
      spring = SpringForce().setStiffness(SPRING_STIFFNESS).setDampingRatio(SPRING_DAMPING)
    }

  private fun moveTo(x: Int, y: Int) {
    params.x = x
    params.y = y
    if (attached) windows.updateViewLayout(view, params)
  }

  /** OverlayBubbleWrap.animateTo: springs from where the window is, starting at the finger's speed. */
  private fun springTo(x: Int, y: Int, velocityX: Float, velocityY: Float) {
    springX.cancel()
    springY.cancel()
    springX.setStartVelocity(velocityX).animateToFinalPosition(x.toFloat())
    springY.setStartVelocity(velocityY).animateToFinalPosition(y.toFloat())
  }

  /** Puts the bubble at its rest at once. The first show rests at the top left, like the reference's (0, 0). */
  private fun placeAtRest() {
    if (dragging || trashing || springX.isRunning || springY.isRunning) return
    if (view.width == 0 || view.height == 0) return
    val area = allowedArea(context, view.width, view.height)
    val target = rest ?: BubbleRest(right = false, y = area.top)
    rest = target
    moveTo(if (target.right) area.right else area.left, target.y.coerceIn(area.top, area.bottom))
  }

  /** floatBubbleToHorizontalEdge: the side the bubble's centre is on, keeping its height within the area. */
  private fun snap(velocityX: Float, velocityY: Float) {
    val area = allowedArea(context, view.width, view.height)
    val right = params.x + view.width / 2 > screenBounds(context).centerX()
    val target = BubbleRest(right, params.y.coerceIn(area.top, area.bottom))
    rest = target
    onRest(target)
    springTo(if (right) area.right else area.left, target.y, velocityX, velocityY)
  }

  /** onTrashVoiceBubble: fades out as it sinks into the target, then leaves for good. */
  private fun dropInTrash() {
    trashing = true
    trash.hide()
    springTo(params.x, params.y + view.height / 2, 0f, 0f)
    view.animate().alpha(0f).setDuration(TRASH_FADE_MS).withEndAction(onTrashed).start()
  }

  private fun track(event: MotionEvent) {
    val tracker = velocity ?: VelocityTracker.obtain().also { velocity = it }
    // The window moves under the finger: track screen positions.
    val screen = MotionEvent.obtain(event).apply { setLocation(event.rawX, event.rawY) }
    tracker.addMovement(screen)
    screen.recycle()
    when (event.actionMasked) {
      MotionEvent.ACTION_DOWN -> {
        springX.cancel()
        springY.cancel()
        downX = event.rawX
        downY = event.rawY
        startX = params.x
        startY = params.y
      }
      MotionEvent.ACTION_MOVE -> {
        if (!dragging && !view.disallowed && !trashing &&
          hypot(event.rawX - downX, event.rawY - downY) > touchSlop
        ) {
          dragging = true
          trash.show()
        }
        if (dragging) drag(event)
      }
      MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
        if (dragging) release(tracker, event.actionMasked == MotionEvent.ACTION_CANCEL)
        tracker.recycle()
        velocity = null
      }
    }
  }

  /** Follows the finger, or holds onto the trash target while the finger is over it. */
  private fun drag(event: MotionEvent) {
    if (trash.track(event.rawX, event.rawY)) {
      if (anchored) return
      anchored = true
      val center = trash.center()
      springTo(center.x - view.width / 2, center.y - view.height / 2, 0f, 0f)
      return
    }
    if (anchored) {
      // anchorOff without animation: back under the finger at once.
      anchored = false
      springX.cancel()
      springY.cancel()
    }
    moveTo(startX + (event.rawX - downX).toInt(), startY + (event.rawY - downY).toInt())
  }

  private fun release(tracker: VelocityTracker, cancelled: Boolean) {
    dragging = false
    if (anchored && !cancelled) {
      anchored = false
      dropInTrash()
      return
    }
    anchored = false
    trash.hide()
    tracker.computeCurrentVelocity(VELOCITY_UNITS)
    snap(tracker.xVelocity, tracker.yVelocity)
  }

  /** The window's position, driven by the springs. */
  private object PositionX : FloatPropertyCompat<OverlayBubble>("x") {
    override fun getValue(bubble: OverlayBubble) = bubble.params.x.toFloat()
    override fun setValue(bubble: OverlayBubble, value: Float) = bubble.moveTo(value.toInt(), bubble.params.y)
  }

  private object PositionY : FloatPropertyCompat<OverlayBubble>("y") {
    override fun getValue(bubble: OverlayBubble) = bubble.params.y.toFloat()
    override fun setValue(bubble: OverlayBubble, value: Float) = bubble.moveTo(bubble.params.x, value.toInt())
  }

  /**
   * The window's root: as large as the React contents want, and the owner of drags. A React child that asks to keep
   * the touch (the push to talk hold) is never dragged.
   */
  private inner class BubbleView : FrameLayout(context) {
    var disallowed = false
      private set

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
      val child = getChildAt(0) ?: return setMeasuredDimension(0, 0)
      val unspecified = MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED)
      // Unbounded, React lays the root out at its contents' size.
      child.measure(unspecified, unspecified)
      setMeasuredDimension(child.measuredWidth, child.measuredHeight)
    }

    override fun requestDisallowInterceptTouchEvent(disallowIntercept: Boolean) {
      disallowed = disallowIntercept
      super.requestDisallowInterceptTouchEvent(disallowIntercept)
    }

    override fun dispatchTouchEvent(event: MotionEvent): Boolean {
      if (event.actionMasked == MotionEvent.ACTION_DOWN) disallowed = false
      track(event)
      val handled = super.dispatchTouchEvent(event)
      // Keeps the gesture even when React passes on the down, so a drag can still start.
      return handled || event.actionMasked == MotionEvent.ACTION_DOWN
    }

    override fun onInterceptTouchEvent(event: MotionEvent) = dragging

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouchEvent(event: MotionEvent) = true

    override fun onConfigurationChanged(newConfig: Configuration?) {
      super.onConfigurationChanged(newConfig)
      // Rotation: the same side and height, clamped to the new area.
      springX.cancel()
      springY.cancel()
      placeAtRest()
    }
  }
}

