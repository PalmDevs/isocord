package me.palmdevs.isocord.expressions

import android.app.Activity
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.os.Build
import android.util.Log
import android.view.MotionEvent
import android.view.ViewGroup
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.layout
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInWindow
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import androidx.compose.ui.util.lerp
import androidx.core.graphics.createBitmap
import coil3.compose.AsyncImage
import java.util.concurrent.atomic.AtomicInteger
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withTimeoutOrNull
import me.palmdevs.isocord.chat.rows.SENDING_ALPHA_MAX
import me.palmdevs.isocord.core.DisposeAfterDetach

// Our own, not in the reference (its picker has no shared-element motion): the tapped tile flies into the pending row.

/** Duration of the shared-element flight from picker tile to chat row. */
private const val FLIGHT_MS = 350

/** Gentle ease-out without FastOutSlowIn's sharp mid-curve snap. */
private val FLIGHT_EASING = CubicBezierEasing(0.22f, 0.68f, 0.36f, 1f)

private const val TAG = "IsocordExpressionFlight"

/** Max wait for the pending row to lay out in ChatView before fading out. */
private const val TARGET_WAIT_MS = 450L

/** Short fade-out if the destination row never appears on screen. */
private const val ABORT_FADE_MS = 120

/** Largest pixel dimension for a snapshot bitmap taken from a picker drawable. */
private const val MAX_SNAPSHOT_PX = 512

/** Provides the stable message key (`changes.lazyKey(row.key)`) for rows in ChatList. */
val LocalChatFlightKey = staticCompositionLocalOf<String?> { null }

/** Provides the active flight targeting the current sticker or inline GIF in ChatList. */
val LocalChatFlightTarget = compositionLocalOf<ActiveFlight?> { null }

/** Staged origin captured on tap before JS creates the pending message and binds its nonce. */
internal class StagedFlight(
  val origin: Rect,
  val originCornerDp: Float,
  val targetCornerDp: Float,
  val crop: Boolean,
  val bitmap: ImageBitmap?,
  val url: String,
)

/** Live flight from [origin] in window pixels to the target composable's tracked window rect. */
class ActiveFlight internal constructor(
  val nonce: String,
  val origin: Rect,
  val originCornerDp: Float,
  val targetCornerDp: Float,
  val crop: Boolean,
  val bitmap: ImageBitmap?,
  val url: String,
) {
  var target by mutableStateOf<Rect?>(null)
    private set
  var targetSending by mutableStateOf(true)
  private var targetCoords: LayoutCoordinates? = null

  fun updateTarget(coords: LayoutCoordinates) {
    if (!coords.isAttached) return
    targetCoords = coords
    val pos = coords.positionInWindow()
    val size = coords.size
    if (size.width <= 0 || size.height <= 0) return
    target = Rect(pos.x, pos.y, pos.x + size.width, pos.y + size.height)
  }

  /** Re-reads the target's current window bounds during draw in case an ancestor scrolled or resized. */
  internal fun currentTarget(): Rect? {
    val coords = targetCoords?.takeIf { it.isAttached } ?: return target
    val pos = coords.positionInWindow()
    val size = coords.size
    return if (size.width > 0 && size.height > 0) {
      Rect(pos.x, pos.y, pos.x + size.width, pos.y + size.height)
    } else {
      target
    }
  }
}

/** Coordinates picker-to-chat flights across separate ComposeView roots. */
object ExpressionFlightRegistry {
  private val nextId = AtomicInteger(1)
  private var stagedKey: String? = null
  private var stagedValue: StagedFlight? = null
  internal val activeFlights = mutableStateMapOf<String, ActiveFlight>()

  /** Captures a tapped picker item's window rect and visual, returning its `flightId`. */
  internal fun stage(
    origin: Rect,
    originCornerDp: Float,
    targetCornerDp: Float,
    crop: Boolean,
    bitmap: ImageBitmap?,
    url: String,
  ): String {
    val id = "f${nextId.getAndIncrement()}"
    stagedKey = id
    stagedValue = StagedFlight(origin, originCornerDp, targetCornerDp, crop, bitmap, url)
    return id
  }

  /** Promotes a staged tap to an active flight keyed by `nonce` and ensures the overlay is attached. */
  fun bind(flightId: String, nonce: String, activity: Activity?) {
    if (flightId.isEmpty() || nonce.isEmpty()) return
    val staged = if (stagedKey == flightId) stagedValue else null
    stagedKey = null
    stagedValue = null
    if (staged == null) return
    activeFlights[nonce] = ActiveFlight(
      nonce = nonce,
      origin = staged.origin,
      originCornerDp = staged.originCornerDp,
      targetCornerDp = staged.targetCornerDp,
      crop = staged.crop,
      bitmap = staged.bitmap,
      url = staged.url,
    )
    if (activity != null) ensureOverlay(activity)
  }

  internal fun activeFor(nonce: String?): ActiveFlight? {
    if (nonce == null || activeFlights.isEmpty()) return null
    return activeFlights[nonce]
  }

  internal fun finish(nonce: String) {
    activeFlights.remove(nonce)
  }
}

/**
 * Returns the flight bound to [nonce]. The derived state recomposes only the row whose flight starts or ends,
 * not every row that reads the registry's map.
 */
@Composable
fun rememberActiveFlight(nonce: String?): ActiveFlight? {
  val flight by remember(nonce) { derivedStateOf { ExpressionFlightRegistry.activeFor(nonce) } }
  return flight
}

/** Modifier applied to the destination sticker or GIF in ChatView while its flight runs. */
fun Modifier.flightTarget(flight: ActiveFlight?): Modifier =
  if (flight == null) {
    this
  } else {
    this
      .onGloballyPositioned { flight.updateTarget(it) }
      .graphicsLayer { alpha = 0f }
  }

/** Snapshots the current frame of [drawable] so disposing the picker grid mid-flight cannot blank it. */
internal fun snapshotDrawable(drawable: Drawable?, maxPx: Int = MAX_SNAPSHOT_PX): ImageBitmap? {
  if (drawable == null) return null
  if (drawable is BitmapDrawable) {
    val src = drawable.bitmap ?: return null
    val soft = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && src.config == Bitmap.Config.HARDWARE) {
      src.copy(Bitmap.Config.ARGB_8888, false) ?: return null
    } else {
      src
    }
    return soft.asImageBitmap()
  }
  val rawW = drawable.intrinsicWidth.takeIf { it > 0 } ?: maxPx
  val rawH = drawable.intrinsicHeight.takeIf { it > 0 } ?: maxPx
  val scale = min(1f, maxPx.toFloat() / max(rawW, rawH))
  val w = max(1, (rawW * scale).roundToInt())
  val h = max(1, (rawH * scale).roundToInt())
  val bitmap = createBitmap(w, h, Bitmap.Config.ARGB_8888)
  val canvas = Canvas(bitmap)
  val saved = drawable.copyBounds()
  return try {
    drawable.setBounds(0, 0, w, h)
    drawable.draw(canvas)
    bitmap.asImageBitmap()
  } catch (error: IllegalStateException) {
    Log.w(TAG, "Skipped snapshot of hardware-backed drawable", error)
    null
  } finally {
    drawable.bounds = saved
  }
}

private const val OVERLAY_TAG = "isocord_expression_flight_overlay"

/** Attaches a non-touchable ComposeView over the activity content root if not already present. */
private fun ensureOverlay(activity: Activity) {
  val root = activity.findViewById<ViewGroup>(android.R.id.content) ?: return
  if (root.findViewWithTag<FlightOverlayComposeView>(OVERLAY_TAG) != null) return
  root.addView(
    FlightOverlayComposeView(activity).apply {
      tag = OVERLAY_TAG
      isClickable = false
      isFocusable = false
    },
    ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT),
  )
}

private class FlightOverlayComposeView(context: Context) : android.widget.FrameLayout(context) {
  init {
    addView(
      ComposeView(context).apply {
        setViewCompositionStrategy(DisposeAfterDetach)
        setContent { ExpressionFlightOverlay() }
      },
      LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT),
    )
  }

  // Never intercept touches; taps during a flight go straight through to ChatView.
  override fun dispatchTouchEvent(ev: MotionEvent?): Boolean = false
}

@Composable
private fun ExpressionFlightOverlay() {
  val flights = ExpressionFlightRegistry.activeFlights.values.toList()
  if (flights.isEmpty()) return
  val view = LocalView.current
  var offsetX by remember { mutableIntStateOf(0) }
  var offsetY by remember { mutableIntStateOf(0) }
  Box(
    Modifier
      .fillMaxSize()
      .onGloballyPositioned {
        val loc = IntArray(2)
        view.getLocationInWindow(loc)
        offsetX = loc[0]
        offsetY = loc[1]
      },
  ) {
    flights.forEach { flight ->
      key(flight.nonce) {
        FlyingItem(flight, offsetX, offsetY)
      }
    }
  }
}

@Composable
private fun FlyingItem(flight: ActiveFlight, offsetX: Int, offsetY: Int) {
  val progress = remember { Animatable(0f) }
  val abortFade = remember { Animatable(1f) }

  LaunchedEffect(flight.nonce) {
    val arrived = withTimeoutOrNull(TARGET_WAIT_MS) {
      snapshotFlow { flight.target }.first { it != null }
    }
    if (arrived == null) {
      abortFade.animateTo(0f, tween(ABORT_FADE_MS))
      ExpressionFlightRegistry.finish(flight.nonce)
      return@LaunchedEffect
    }
    progress.animateTo(1f, tween(FLIGHT_MS, easing = FLIGHT_EASING))
    ExpressionFlightRegistry.finish(flight.nonce)
  }

  val scale = if (flight.crop) ContentScale.Crop else ContentScale.Fit

  Box(
    Modifier
      .layout { measurable, _ ->
        val p = progress.value
        val target = flight.currentTarget() ?: flight.origin
        val left = lerp(flight.origin.left, target.left, p) - offsetX
        val top = lerp(flight.origin.top, target.top, p) - offsetY
        val width = lerp(flight.origin.width, target.width, p).coerceAtLeast(1f)
        val height = lerp(flight.origin.height, target.height, p).coerceAtLeast(1f)
        val placeable = measurable.measure(Constraints.fixed(width.roundToInt(), height.roundToInt()))
        layout(placeable.width, placeable.height) {
          placeable.place(left.roundToInt(), top.roundToInt())
        }
      }
      .graphicsLayer {
        val p = progress.value
        val targetAlpha = if (flight.targetSending) SENDING_ALPHA_MAX else 1f
        alpha = lerp(1f, targetAlpha, p) * abortFade.value
        val corner = lerp(flight.originCornerDp, flight.targetCornerDp, p)
        if (corner > 0f) {
          shape = RoundedCornerShape(corner.dp)
          clip = true
        }
      },
  ) {
    if (flight.bitmap != null) {
      Image(
        bitmap = flight.bitmap,
        contentDescription = null,
        contentScale = scale,
        modifier = Modifier.fillMaxSize(),
      )
    } else if (flight.url.isNotEmpty()) {
      AsyncImage(
        model = flight.url,
        contentDescription = null,
        contentScale = scale,
        modifier = Modifier.fillMaxSize(),
      )
    }
  }
}
