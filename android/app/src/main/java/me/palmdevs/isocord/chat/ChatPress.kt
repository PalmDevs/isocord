package me.palmdevs.isocord.chat

import android.os.SystemClock
import android.util.Log
import android.view.ViewConfiguration
import androidx.compose.foundation.Indication
import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.indication
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.PressInteraction
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.pointer.AwaitPointerEventScope
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerId
import androidx.compose.ui.input.pointer.PointerInputChange
import androidx.compose.ui.input.pointer.changedToDownIgnoreConsumed
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.onPlaced

private const val TAG = "IsocordPress"

/** How often the target's place on the screen is checked while no touch events arrive. */
private const val POLL_MS = 16L

/**
 * Tap and long press for every chat target. Unlike combinedClickable, a long press fires only while the finger
 * stays within touch slop and nothing else claims the gesture.
 * The Final pass shows a drag, scroll or swipe that consumed the pointer. A cancelled touch cancels the press.
 * Movement is measured on screen, since a panel swipe drags the whole chat under the finger.
 * The target's own screen position is also watched between events.
 */
@Composable
fun Modifier.chatPress(
  onClick: (() -> Unit)? = null,
  onLongClick: (() -> Unit)? = null,
  interactionSource: MutableInteractionSource? = null,
  indication: Indication? = LocalIndication.current,
): Modifier {
  val source = interactionSource ?: remember { MutableInteractionSource() }
  val click by rememberUpdatedState(onClick)
  val longClick by rememberUpdatedState(onLongClick)
  val placed = remember { Placed() }
  val held = LocalHeldLink.current
  return indication(source, indication).onPlaced { placed.coordinates = it }.pointerInput(source, held) {
    awaitEachGesture {
      // Unconsumed only, and consumed here: a nested target (a reaction chip) keeps the outer ones quiet.
      // A text link consumes its down for the tap. The innermost held target still takes it (onLongPressLink).
      val down = awaitFirstDown(requireUnconsumed = false)
      if (down.isConsumed && !(longClick != null && held.claim())) return@awaitEachGesture
      // A touch a nested part took (a held link) is not the target's own press: no ripple.
      val touchConsumed = down.isConsumed
      down.consume()
      // The press (and its ripple) waits for the tap timeout, as a View's pressed state does in a scrolling
      // parent (View.CheckForTap): a swipe or scroll that claims the touch before then shows no ripple at all.
      var press: PressInteraction.Press? = null
      fun pressIn() {
        if (press == null && !touchConsumed) press = PressInteraction.Press(down.position).also { source.tryEmit(it) }
      }
      var released = false
      try {
        val timeout = if (longClick != null) viewConfiguration.longPressTimeoutMillis else null
        when (val outcome = track(down, viewConfiguration.touchSlop, placed, timeout, ::pressIn)) {
          is Outcome.Up -> {
            outcome.change.consume()
            // A tap quicker than the timeout still ripples.
            pressIn()
            released = true
            click?.invoke()
          }
          Outcome.Held -> {
            released = true
            longClick?.invoke()
            // Swallow the rest of this touch so nothing else reads the release as a tap. The Initial pass reaches
            // this target before its children, so a held link sees the release consumed and does not open.
            while (true) {
              val event = awaitPointerEvent(PointerEventPass.Initial)
              event.changes.forEach { it.consume() }
              if (event.changes.none { it.pressed }) break
            }
          }
          is Outcome.Lost -> Unit
        }
      } finally {
        press?.let { source.tryEmit(if (released) PressInteraction.Release(it) else PressInteraction.Cancel(it)) }
      }
    }
  }
}

private sealed interface Outcome {
  class Up(val change: PointerInputChange) : Outcome
  data object Held : Outcome
  class Lost(val reason: String) : Outcome
}

/**
 * Follows [down] until released ([Outcome.Up]), held still for [timeout] ms ([Outcome.Held], never when null),
 * or lost: moved past [slop] on screen, consumed, cancelled, or carried away with its target.
 * [onPress] runs once the touch outlasts the tap timeout.
 */
private suspend fun AwaitPointerEventScope.track(
  down: PointerInputChange,
  slop: Float,
  placed: Placed,
  timeout: Long?,
  onPress: () -> Unit,
): Outcome {
  val start = placed.toScreen(down.position)
  val origin = placed.toScreen(Offset.Zero)
  val now = SystemClock.uptimeMillis()
  val deadline = timeout?.let { now + it }
  var pressAt: Long? = now + ViewConfiguration.getTapTimeout()
  var events = 0
  fun lost(reason: String) = Outcome.Lost(reason).also { Log.d(TAG, "lost: $reason after $events events") }
  while (true) {
    val time = SystemClock.uptimeMillis()
    if (pressAt != null && time >= pressAt) {
      pressAt = null
      onPress()
    }
    if (deadline != null && time >= deadline) {
      Log.d(TAG, "held after $events events")
      return Outcome.Held
    }
    var wait = POLL_MS
    if (deadline != null) wait = minOf(wait, deadline - time)
    if (pressAt != null) wait = minOf(wait, pressAt - time)
    val event = withTimeoutOrNull(wait) { awaitPointerEvent(PointerEventPass.Final) }
    if ((placed.toScreen(Offset.Zero) - origin).getDistance() > slop) return lost("target moved")
    if (event == null) continue
    events++
    val change = event.changes.firstOrNull { it.id == down.id } ?: return lost("pointer gone")
    // The first event seen here is the down itself reaching the Final pass, consumed by chatPress: not a loss.
    if (change.changedToDownIgnoreConsumed()) continue
    if (change.isConsumed) return lost(if (change.pressed) "consumed" else "cancelled")
    if (!change.pressed) return Outcome.Up(change)
    if ((placed.toScreen(change.position) - start).getDistance() > slop) return lost("finger moved")
  }
}

/** Where the target sits, read at each event: its place on the screen changes while a panel moves it. */
private class Placed {
  var coordinates: LayoutCoordinates? = null

  fun toScreen(position: Offset): Offset =
    coordinates?.takeIf { it.isAttached }?.localToScreen(position) ?: position
}

/**
 * The link under the finger of the touch going on, set by text while it is pressed. A long press on a message
 * reports it in place of the message (onLongPressLink), since text links have no long press of their own.
 */
class HeldLink {
  var url: String? = null

  /** Whether a press target took this touch's link. */
  var claimed = false

  /** Returns whether a link is held and no other target took it yet, and takes it. */
  fun claim(): Boolean = (url != null && !claimed).also { if (it) claimed = true }

  /** Returns the held link and forgets it. */
  fun take(): String? = url.also { url = null }
}

val LocalHeldLink = staticCompositionLocalOf { HeldLink() }

/**
 * Records in [LocalHeldLink] what [linkAt] finds under each touch, until the finger lifts. Watches the Initial pass
 * without consuming, so the text's own links and the message's press still get the touch.
 */
@Composable
fun Modifier.holdsLink(linkAt: (Offset) -> String?): Modifier {
  val held = LocalHeldLink.current
  val find by rememberUpdatedState(linkAt)
  return pointerInput(held) {
    awaitEachGesture {
      val down = awaitFirstDown(requireUnconsumed = false, pass = PointerEventPass.Initial)
      held.url = find(down.position)
      held.claimed = false
      try {
        waitForUpOrCancellation(PointerEventPass.Initial)
      } finally {
        held.url = null
      }
    }
  }
}
