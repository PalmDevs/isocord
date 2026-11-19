package me.palmdevs.isocord.chat.list

import android.view.HapticFeedbackConstants
import android.view.View
import androidx.compose.animation.core.Easing
import androidx.compose.animation.core.animate
import androidx.compose.animation.core.tween
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.awaitHorizontalTouchSlopOrCancellation
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.input.pointer.AwaitPointerEventScope
import androidx.compose.ui.input.pointer.PointerId
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChange
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.dp
import kotlin.math.PI
import kotlin.math.atan
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import me.palmdevs.isocord.chat.rows.ChatTheme
import me.palmdevs.isocord.chat.rows.Reply

/** What releasing a swipe asks JS for; [wire] is the `action` of the `topMessageSwipe` event. */
enum class SwipeAction(val wire: String) { Reply("reply"), Edit("edit") }

/** What swiping a message may do, the row's `swipe`: reply, or reply and with a longer pull edit. */
object SwipeMode {
  const val REPLY = "reply"
  const val REPLY_EDIT = "replyEdit"
}

// SwipeHelper (com.discord.chat.presentation.list) distances, leftward. The row follows the finger up to
// SWIPE_STOP_OFFSET_X (80dp, also the haptic and reply trigger) and is held back by an arctangent after it; the
// haptic and the trigger re-arm below REPLY_RESET_X (60dp); a pull to EDIT_OFFSET_X (130dp) turns reply into edit.
private val STOP = 80.dp
private val RESET = 60.dp
private val EDIT = 130.dp

/**
 * Scale of the arctangent that damps the pull past [STOP]. The reference divides by a literal 120 *pixels*, which
 * makes the edit pull unreachable on denser screens; this is the same curve at a density of 2.5.
 */
private val ELASTIC = 48.dp

private val MAX_CIRCLE = 40.dp
private val CIRCLE_MARGIN = 6.dp

/** AccelerateDecelerateInterpolator, which every animation of SwipeHelper and its recover animation uses. */
private val AccelerateDecelerate = Easing { fraction -> (cos((fraction + 1.0) * PI) / 2.0 + 0.5).toFloat() }
private const val RETURN_MS = 300
private const val EDIT_ENTER_MS = 300
private const val EDIT_EXIT_MS = 200

// ic_swipe_reply (32 viewport) and ic_swipe_edit (24 viewport, even-odd) of the reference.
private const val REPLY_VIEWPORT = 32f
private const val EDIT_VIEWPORT = 24f
private val REPLY_PATH = PathParser().parsePathString(
  "M3.185,15.103L13.842,8.152C13.963,8.069 14.108,8.018 14.26,8.004C14.413,7.99 14.568,8.014 14.705,8.073" +
    "C14.843,8.132 14.958,8.224 15.038,8.338C15.118,8.453 15.159,8.584 15.157,8.718V12.379" +
    "C26.772,12.379 28.974,19.388 29.332,23.137C29.341,23.287 29.297,23.436 29.205,23.562" +
    "C29.112,23.689 28.977,23.788 28.818,23.846C28.658,23.903 28.482,23.916 28.314,23.882" +
    "C28.146,23.849 27.994,23.771 27.878,23.659C22.722,18.422 15.157,19.63 15.157,19.63V23.292" +
    "C15.157,23.423 15.116,23.552 15.036,23.664C14.957,23.776 14.843,23.867 14.708,23.926" +
    "C14.573,23.984 14.421,24.009 14.271,23.997C14.12,23.985 13.977,23.937 13.856,23.857L3.185,16.909" +
    "C3.024,16.803 2.894,16.667 2.804,16.51C2.714,16.354 2.667,16.181 2.667,16.006" +
    "C2.667,15.831 2.714,15.658 2.804,15.501C2.894,15.345 3.024,15.208 3.185,15.103Z",
).toPath()
private val EDIT_PATH = PathParser().parsePathString(
  "M19.2929,9.83L19.9409,9.1828C21.353,7.7707 21.353,5.472 19.9409,4.059C18.5287,2.6468 16.2292,2.6468 14.817,4.059" +
    "L14.1699,4.707L19.2929,9.83ZM12.8962,5.9769L5.1847,13.6907L10.3085,18.813L18.0201,11.0993L12.8962,5.9769Z" +
    "M4.1185,20.9705L8.7591,19.8112L4.1869,15.2391L3.0268,19.8796C2.9503,20.1856 3.0403,20.5105 3.2635,20.7338" +
    "C3.4867,20.957 3.8116,21.0461 4.1185,20.9705Z",
).toPath().apply { fillType = PathFillType.EvenOdd }

/** The state of one row's swipe. Only what the gutter draws is Compose state; the rest is the helper's fields. */
private class SwipeState {
  /** How far the row is pulled left, after the damping. */
  var pull by mutableFloatStateOf(0f)
  var editScale by mutableFloatStateOf(0f)
  /** The swipe was released over the threshold: the gutter stays fully coloured while the row returns. */
  var completed by mutableStateOf(false)

  var raw = 0f
  var action = SwipeAction.Reply
  var triggered = false
  var armed = true
  var returning: Job? = null
  var editing: Job? = null
}

/**
 * Swiping a message left reveals a reply circle (SwipeHelper). Past [STOP] it turns brand coloured and buzzes, and
 * releasing replies. With [canEdit], [EDIT] buzzes again, swaps to a pencil, and releasing edits.
 * A null [canEdit] means not swipeable.
 * Rightward drags are left alone, so they still close the chat panel (src/features/chat/ChatPanels.tsx).
 * A leftward drag is claimed by this row, which makes the gesture handler cancel the panels' pan.
 * A claimed gesture gives the list nothing ([holdGesture]).
 */
@Composable
fun SwipeToReply(canEdit: Boolean?, onSwipe: (SwipeAction) -> Unit, content: @Composable () -> Unit) {
  if (canEdit == null) return content()
  val theme = LocalChatTheme.current
  val view = LocalView.current
  val scope = rememberCoroutineScope()
  val density = LocalDensity.current
  val currentOnSwipe by rememberUpdatedState(onSwipe)
  val currentCanEdit by rememberUpdatedState(canEdit)
  val state = remember { SwipeState() }
  val stop = with(density) { STOP.toPx() }
  val reset = with(density) { RESET.toPx() }
  val edit = with(density) { EDIT.toPx() }
  val elastic = with(density) { ELASTIC.toPx() }
  val circleMargin = with(density) { CIRCLE_MARGIN.toPx() }
  val maxCircle = with(density) { MAX_CIRCLE.toPx() }

  val controller = remember(density) {
    SwipeController(state, scope, view, stop, reset, edit, circleMargin, maxCircle, { currentCanEdit }, { currentOnSwipe(it) })
  }

  Box(
    Modifier
      .fillMaxWidth()
      .drawBehind { drawGutter(state, theme, stop, circleMargin, maxCircle) }
      .pointerInput(Unit) {
        awaitEachGesture {
          val down = awaitFirstDown(requireUnconsumed = false)
          var over = 0f
          // Only a leftward slop claims the gesture; a rightward one is left for the panels to close the chat.
          awaitHorizontalTouchSlopOrCancellation(down.id) { change, overSlop ->
            if (overSlop < 0f) {
              over = overSlop
              change.consume()
            }
          } ?: return@awaitEachGesture
          val height = size.height.toFloat()
          state.returning?.cancel()
          state.editing?.cancel()
          state.editScale = 0f
          state.action = SwipeAction.Reply
          state.completed = false
          state.raw = 0f
          fun move(delta: Float) {
            state.raw = max(0f, state.raw - delta)
            state.pull = if (state.raw <= stop) state.raw else stop + atan((state.raw - stop) / elastic) * elastic
            controller.update(height)
          }
          move(over)
          controller.release(height, cancelled = !holdGesture(down.id, ::move))
        }
      },
  ) {
    Box(Modifier.fillMaxWidth().graphicsLayer { translationX = -state.pull }) { content() }
  }
}

/**
 * Follows a claimed gesture to its end, consuming every event. Returns whether the finger lifted.
 * False means cancelled, or another handler took it first.
 * Unlike horizontalDrag and drag, a still finger's events are consumed too. Otherwise the list would scroll by
 * all the vertical drift at once. Lifting the tracked finger with another down follows that one.
 */
private suspend fun AwaitPointerEventScope.holdGesture(pointer: PointerId, onMove: (Float) -> Unit): Boolean {
  var id = pointer
  while (true) {
    val event = awaitPointerEvent()
    val change = event.changes.firstOrNull { it.id == id } ?: return false
    if (change.isConsumed) return false
    if (change.pressed) {
      onMove(change.positionChange().x)
    } else {
      val next = event.changes.firstOrNull { it.pressed }
      if (next == null) {
        change.consume()
        return true
      }
      id = next.id
    }
    event.changes.forEach { it.consume() }
  }
}

private fun lerpFloat(from: Float, to: Float, fraction: Float) = from + (to - from) * fraction

/** The area the row uncovers on its right: a band with the reply circle centred in it (SwipeHelper.drawContextArea). */
private fun DrawScope.drawGutter(state: SwipeState, theme: ChatTheme, stop: Float, margin: Float, maxCircle: Float) {
  val pull = state.pull
  if (pull < 1f) return
  val progress = (pull / stop).coerceIn(0f, 1f)
  val shown = if (state.completed) 1f else progress
  // Colours hold their start value until 80% of the way, then reach the end value at the threshold.
  val mix = ((shown - 0.8f) / 0.2f).coerceIn(0f, 1f)
  val alpha = (64 + (192 * progress).toInt()).coerceIn(0, 255) / 255f
  val container = max(0f, min(size.height - margin, maxCircle))
  val radius = container / 2
  val center = Offset(size.width - pull / 2, size.height / 2)
  val iconColor = lerp(theme.swipeIcon, Color.White, mix)
  val iconSize = container * 0.6f
  // The arrow turns into place as the swipe nears the threshold.
  val degrees = (1f - progress) * 90f

  clipRect(left = size.width - pull, right = size.width) {
    drawRect(theme.swipeBackground)
    drawCircle(lerp(theme.swipeCircle, theme.swipeCircleActive, mix).copy(alpha = alpha), radius, center)
    val editScale = state.editScale
    if (editScale > 0f) {
      withTransform({ scale(editScale, editScale, center) }) {
        drawCircle(lerp(theme.swipeCircle, theme.swipeEditCircle, mix).copy(alpha = 1f), radius, center)
      }
    }
    val replyScale = (1f - editScale).coerceIn(0f, 1f)
    withTransform({
      translate(center.x - 1f, center.y - 1f)
      rotate(degrees, Offset.Zero)
      scale(replyScale, replyScale, Offset.Zero)
      translate(-iconSize / 2, -iconSize / 2)
      scale(iconSize / REPLY_VIEWPORT, iconSize / REPLY_VIEWPORT, Offset.Zero)
    }) { drawPath(REPLY_PATH, iconColor.copy(alpha = alpha)) }
    if (editScale > 0f) {
      withTransform({
        translate(center.x - 1f, center.y - 1f)
        rotate(degrees, Offset.Zero)
        scale(editScale, editScale, Offset.Zero)
        translate(-iconSize / 2, -iconSize / 2)
        scale(iconSize / EDIT_VIEWPORT, iconSize / EDIT_VIEWPORT, Offset.Zero)
      }) { drawPath(EDIT_PATH, iconColor) }
    }
  }
}

/** SwipeHelper's logic for one row: the haptics, the reply and edit triggers, and the return animation. */
private class SwipeController(
  private val state: SwipeState,
  private val scope: CoroutineScope,
  private val view: View,
  private val stop: Float,
  private val reset: Float,
  private val edit: Float,
  private val circleMargin: Float,
  private val maxCircle: Float,
  private val canEdit: () -> Boolean,
  private val onSwipe: (SwipeAction) -> Unit,
) {
  /** SwipeHelper's per-frame checks: the haptic, the reply trigger and the switch between reply and edit. */
  fun update(height: Float) {
    val pull = state.pull
    if (state.armed) {
      if (pull >= stop) {
        view.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
        state.armed = false
      }
    } else if (pull <= reset) {
      state.armed = true
    }
    if (state.triggered && pull < reset) state.triggered = false
    if (!state.triggered && pull >= stop) state.triggered = true

    if (state.completed) return
    val running = state.editing?.isActive == true
    if (state.action == SwipeAction.Edit) {
      if (pull < reset && !running) {
        val from = state.editScale
        state.editing = scope.launch {
          animate(0f, 1f, animationSpec = tween(EDIT_EXIT_MS, easing = AccelerateDecelerate)) { fraction, _ ->
            state.editScale = from * (1f - fraction)
          }
          state.action = SwipeAction.Reply
        }
      }
    } else if (canEdit() && pull >= edit && !running) {
      // The edit circle grows past its size and settles (300ms, three keyframes: where it was, the growth, 1).
      val base = max(0f, min(height - circleMargin, maxCircle))
      val growth = if (base * 1.3f <= height || base == 0f) 1.3f else height / base
      val from = state.editScale
      state.action = SwipeAction.Edit
      view.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
      state.editing = scope.launch {
        animate(0f, 1f, animationSpec = tween(EDIT_ENTER_MS, easing = AccelerateDecelerate)) { fraction, _ ->
          state.editScale = if (fraction < 0.5f) {
            lerpFloat(from, growth, fraction * 2f)
          } else {
            lerpFloat(growth, 1f, (fraction - 0.5f) * 2f)
          }
        }
      }
    }
  }

  fun release(height: Float, cancelled: Boolean) {
    if (cancelled) state.triggered = false
    if (state.triggered) {
      state.completed = true
      onSwipe(state.action)
      // JS buzzes a light impact when it starts a reply; nothing for an edit.
      if (state.action == SwipeAction.Reply) view.performHapticFeedback(HapticFeedbackConstants.CONTEXT_CLICK)
    }
    val from = state.pull
    state.returning = scope.launch {
      animate(from, 0f, animationSpec = tween(RETURN_MS, easing = AccelerateDecelerate)) { value, _ ->
        state.pull = value
        update(height)
      }
    }
  }
}
