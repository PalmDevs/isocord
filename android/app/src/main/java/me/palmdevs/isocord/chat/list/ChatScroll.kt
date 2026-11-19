package me.palmdevs.isocord.chat.list

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.MutatorMutex
import androidx.compose.foundation.gestures.animateScrollBy
import androidx.compose.foundation.gestures.scrollBy
import androidx.compose.foundation.lazy.LazyListItemInfo
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import kotlin.math.abs
import kotlinx.coroutines.delay
import com.facebook.react.bridge.ReadableMap
import me.palmdevs.isocord.expressions.FADE_MS

/** What JS asks the list to scroll to (the `scrollTarget` prop). */
class ScrollTarget(
  /** The chat the request is for, so one meant for another chat is ignored. */
  val scrollKey: String,
  /** The row's key (a message id); null scrolls to the newest message. */
  val messageId: String?,
  /** Each request has its own nonce, so asking for the same message twice scrolls twice. */
  val nonce: Int,
  /** Flash the message once it is in place. */
  val flash: Boolean,
)

/** Reads the `scrollTarget` struct of ChatViewNativeComponent.ts. */
fun parseScrollTarget(map: ReadableMap) = ScrollTarget(
  scrollKey = map.getString("scrollKey").orEmpty(),
  messageId = if (map.hasKey("messageId")) map.getString("messageId") else null,
  nonce = map.getInt("nonce"),
  flash = map.getBoolean("flash"),
)

private val Decelerate = CubicBezierEasing(0f, 0f, 0.2f, 1f)

/** A target within this many viewports of what is laid out is reached with one animation. */
private const val SHORT_VIEWPORTS = 2f

/** The first leg of a long scroll runs at constant speed over one viewport; the last one slows down into place. */
private const val LEG_ONE_MS = 140
private const val LEG_TWO_MS = 260

/** A near scroll lasts [NEAR_BASE_MS] plus [NEAR_PER_VIEWPORT_MS] per viewport, then settles in [NEAR_REST_MS]. */
private const val NEAR_BASE_MS = 180
private const val NEAR_PER_VIEWPORT_MS = 120
private const val NEAR_REST_MS = 120

/** The longest [scrollToRow] runs, in ms. JS waits longer than this before it counts a jump as settled. */
val LONGEST_SCROLL_MS = maxOf(
  NEAR_BASE_MS + (NEAR_PER_VIEWPORT_MS * SHORT_VIEWPORTS).toInt() + NEAR_REST_MS,
  LEG_ONE_MS + LEG_TWO_MS,
)

/**
 * The one way the chat list scrolls to a row by code. Positions follow the layout direction: positive goes older.
 * Near targets get one animation. Far ones, like Telegram: animate a viewport, jump to a viewport short of the
 * target, animate the rest.
 * The newest row (`center = false`) ends flush with the bottom. Others are centred, or top-aligned with [margin] px if taller.
 */
suspend fun LazyListState.scrollToRow(index: Int, center: Boolean, margin: Float) {
  val info = layoutInfo
  val viewportStart = info.viewportStartOffset
  val viewportEnd = info.viewportEndOffset
  val viewport = (viewportEnd - viewportStart).toFloat()
  val visible = info.visibleItemsInfo
  if (visible.isEmpty() || viewport <= 0f || index !in 0 until info.totalItemsCount) return
  val goal = if (center) (viewportStart + viewportEnd) / 2f else 0f

  fun distanceTo(item: LazyListItemInfo): Float = when {
    center && item.size > viewport - 2 * margin -> item.offset + item.size - (viewportEnd - margin)
    center -> item.offset + item.size / 2f - goal
    else -> item.offset - goal
  }

  fun laidOut(): LazyListItemInfo? = layoutInfo.visibleItemsInfo.firstOrNull { it.index == index }

  fun millis(distance: Float) = (NEAR_BASE_MS + NEAR_PER_VIEWPORT_MS * (abs(distance) / viewport).coerceAtMost(SHORT_VIEWPORTS)).toInt()

  laidOut()?.let { item ->
    val distance = distanceTo(item)
    animateScrollBy(distance, tween(millis(distance), easing = Decelerate))
    return
  }

  // Not on screen: estimate the distance from the average row height until the target can be measured.
  val first = visible.first()
  val last = visible.last()
  val average = visible.sumOf { it.size } / visible.size.toFloat()
  val direction = if (index > last.index) 1f else -1f
  val estimate = if (direction > 0) {
    val rows = index - last.index
    last.offset + last.size + (rows - if (center) 0.5f else 1f) * average - goal
  } else {
    val rows = first.index - index
    first.offset - (rows - if (center) 0.5f else 0f) * average - goal
  }

  if (abs(estimate) <= SHORT_VIEWPORTS * viewport) {
    animateScrollBy(estimate, tween(millis(estimate), easing = Decelerate))
    // The estimate is off by the rows' size differences; now that the target is laid out, settle exactly.
    laidOut()?.let { item ->
      val rest = distanceTo(item)
      if (abs(rest) > 1f) animateScrollBy(rest, tween(NEAR_REST_MS, easing = Decelerate))
    }
    return
  }

  animateScrollBy(direction * viewport, tween(LEG_ONE_MS, easing = LinearEasing))
  scrollToItem(index)
  val item = laidOut() ?: return
  // Back up a viewport from the target, then the remaining distance is what is left plus what was backed up.
  val backedUp = scrollBy(-direction * viewport)
  animateScrollBy(distanceTo(item) - backedUp, tween(LEG_TWO_MS, easing = Decelerate))
}

/**
 * The flash of a message that was jumped to: [alpha] fades from 1 to 0 while [id] is the message.
 * Also the message the composer replies to or edits, lit while [composerTarget] is its id.
 */
class ChatHighlight {
  var id by mutableStateOf<String?>(null)
    private set
  val alpha = Animatable(0f)

  /** The message the composer replies to or edits (the `composerTargetId` prop). */
  var composerTarget by mutableStateOf<String?>(null)

  /** One flash at a time: a new one cancels the running one and waits for its cleanup before it starts. */
  private val mutex = MutatorMutex()

  suspend fun flash(id: String) = mutex.mutate {
    this.id = id
    try {
      alpha.snapTo(1f)
      delay(HOLD_MS)
      alpha.animateTo(0f, tween(FADE_MS, easing = LinearEasing))
    } finally {
      this.id = null
    }
  }

  private companion object {
    const val HOLD_MS = 800L
    const val FADE_MS = 1200
  }
}

val LocalChatHighlight = staticCompositionLocalOf { ChatHighlight() }
