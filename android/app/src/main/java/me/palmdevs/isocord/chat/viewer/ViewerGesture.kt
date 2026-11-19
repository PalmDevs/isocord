package me.palmdevs.isocord.chat.viewer

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.AnimationVector1D
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.awaitVerticalTouchSlopOrCancellation
import androidx.compose.foundation.gestures.verticalDrag
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChange
import androidx.compose.ui.input.pointer.util.VelocityTracker
import androidx.compose.ui.unit.dp
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

// MediaModal's default swipeVelocityThreshold (dp/s): faster releases close, slower ones spring back.
private const val SWIPE_VELOCITY_THRESHOLD = 1000f

// useMediaViewerPanGesture SPRING_CONFIG: damping 15, mass 1, stiffness 250 (damping ratio 15 / (2 * sqrt(250))).
private val DISMISS_SPRING = spring<Float>(dampingRatio = 0.474f, stiffness = 250f, visibilityThreshold = 0.5f)

/** useMediaViewerPanGesture's state: translatePos, isInteracting and isClosing. */
internal class ViewerPan {
  var translation by mutableFloatStateOf(0f)
  var interacting by mutableStateOf(false)
  var closing by mutableStateOf(false)
  var settle: Job? = null

  /**
   * Slides the media out in the direction of the swipe and reports the close as soon as it is out of sight: the
   * spring stops at the edge instead of swinging back into view.
   */
  fun dismiss(scope: CoroutineScope, velocity: Float, closePosition: Float, onClosing: () -> Unit, onClosed: () -> Unit) {
    if (closing) return
    closing = true
    onClosing()
    settle?.cancel()
    val target = if (velocity < 0) -closePosition else closePosition
    scope.launch {
      val animation = Animatable(translation)
      animation.updateBounds(-closePosition, closePosition)
      animation.animateTo(target, DISMISS_SPRING, velocity) { translation = value }
      onClosed()
    }
  }
}

/** One finger, vertical only, off while [enabled] is false; the release velocity decides between close and settle. */
internal fun Modifier.viewerPan(pan: ViewerPan, scope: CoroutineScope, enabled: () -> Boolean, dismiss: (Float) -> Unit): Modifier =
  pointerInput(Unit) {
    awaitEachGesture {
      val down = awaitFirstDown(requireUnconsumed = false)
      if (!enabled() || pan.closing) return@awaitEachGesture
      val tracker = VelocityTracker()
      tracker.addPosition(down.uptimeMillis, down.position)
      val start = awaitVerticalTouchSlopOrCancellation(down.id) { change, _ -> change.consume() }
        ?: return@awaitEachGesture
      pan.settle?.cancel()
      pan.interacting = true
      tracker.addPosition(start.uptimeMillis, start.position)
      val ended = verticalDrag(start.id) { change ->
        pan.translation += change.positionChange().y
        tracker.addPosition(change.uptimeMillis, change.position)
        change.consume()
      }
      pan.interacting = false
      val velocity = if (ended) tracker.calculateVelocity().y else 0f
      if (abs(velocity) > SWIPE_VELOCITY_THRESHOLD * density) {
        dismiss(velocity)
      } else if (pan.translation != 0f) {
        // Back to the centre without swinging past it (the reference's spring clamps its overshoot).
        pan.settle = scope.launch {
          val back = Animatable(pan.translation)
          back.updateBounds(min(0f, pan.translation), max(0f, pan.translation))
          back.animateTo(0f, DISMISS_SPRING, velocity) { pan.translation = value }
        }
      }
    }
  }.graphicsLayer { translationY = pan.translation }

/** The overlay's fade: snapped off while closing, linear otherwise (MediaViewer). */
@Composable
internal fun rememberOverlay(visible: Boolean, closing: Boolean): Animatable<Float, AnimationVector1D> {
  val overlay = remember { Animatable(1f) }
  LaunchedEffect(visible, closing) {
    when {
      closing -> overlay.snapTo(0f)
      visible -> overlay.animateTo(1f, tween(ViewerMotion.OVERLAY_IN_MS, easing = LinearEasing))
      else -> overlay.animateTo(0f, tween(ViewerMotion.OVERLAY_OUT_MS, easing = LinearEasing))
    }
  }
  return overlay
}
