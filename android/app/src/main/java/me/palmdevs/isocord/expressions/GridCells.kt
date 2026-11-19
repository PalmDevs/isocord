package me.palmdevs.isocord.expressions

import android.os.SystemClock
import android.view.Choreographer
import android.view.accessibility.AccessibilityManager
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.interaction.Interaction
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.PressInteraction
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.painter.Painter
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.onLongClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.graphics.withTranslation
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import me.palmdevs.isocord.chat.ChatFonts
import me.palmdevs.isocord.chat.chatPress
import me.palmdevs.isocord.chat.rows.ChatTheme
import me.palmdevs.isocord.notifications.notify.title

/** The rows' and headers' side padding: the search bar's (ExpressionPicker's `search` style), so they line up. */
internal val SIDE_PADDING = 12.dp

/** Headers, the same in both grids: EmojiPickerViewAdapter's 16sp, and the space between the images and them. */
internal val HEADER_SIZE = 16.sp

internal val HEADER_ABOVE = 12.dp

internal val HEADER_BELOW = 8.dp

/** Sticker corners (radii.sm), for the placeholder, lock overlay and press highlight. */
internal val STICKER_RADIUS = 8.dp

/** lock_overlay: a 16dp lock over a fifth of black. */
internal val LOCK_SIZE = 16.dp

internal val LOCK_SHADE = Color.Black.copy(alpha = 0.2f)

/**
 * A section's name (EmojiPickerViewAdapter's category header, TEXT_MUTED).
 * [HEADER_ABOVE] below the images above it, [HEADER_BELOW] above the ones under it. The rows' own space counts toward both.
 */
@Composable
internal fun Header(title: String, kind: GridKind, theme: ChatTheme, fonts: ChatFonts) {
  val inset = (kind.rowHeight - kind.image) / 2
  Box(
    Modifier
      .fillMaxWidth()
      .padding(start = SIDE_PADDING, end = SIDE_PADDING, top = HEADER_ABOVE - inset, bottom = HEADER_BELOW - inset)
      .semantics { heading() },
  ) {
    BasicText(
      title,
      style = TextStyle(color = theme.textMuted, fontSize = HEADER_SIZE, fontFamily = fonts.sans, fontWeight = FontWeight.SemiBold),
      maxLines = 1,
      overflow = TextOverflow.Ellipsis,
    )
  }
}

/**
 * A row of items: one node that draws each image or placeholder, the lock on locked ones and the press highlight.
 * Takes taps for the item under the finger. With an accessibility service on, an empty child per item exposes them.
 */
@Composable
internal fun Cells(
  row: CellsRow,
  kind: GridKind,
  layout: GridLayout,
  theme: ChatTheme,
  animate: Boolean,
  grid: GridImages,
  accessible: Boolean,
  lock: Painter,
  onPress: (String) -> Unit,
  onLongPress: (String) -> Unit,
) {
  val images = remember(row.items, grid, animate) { RowImages(row.items, grid, animate) }

  val source = remember { CellPressSource() }
  val highlight = animateFloatAsState(if (source.pressing) 1f else 0f, tween(FADE_MS), label = "press")
  val items by rememberUpdatedState(row.items)
  val radius = with(LocalDensity.current) { STICKER_RADIUS.toPx() }
  val lockSize = with(LocalDensity.current) { LOCK_SIZE.toPx() }

  Box(
    Modifier
      .fillMaxWidth()
      .height(kind.rowHeight)
      .chatPress(
        onClick = { items.getOrNull(column(source.position.x, layout, items.size))?.let { onPress(it.key) } },
        onLongClick = { items.getOrNull(column(source.position.x, layout, items.size))?.let { onLongPress(it.key) } },
        interactionSource = source,
        indication = null,
      )
      .drawBehind { drawCells(images, row.items.size, kind, layout, theme, source, highlight.value, lock, radius, lockSize) },
  ) {
    if (accessible) CellsAccessibility(row, layout, onPress, onLongPress)

  }
}

/** The item under [x], or -1 between items. */
private fun column(x: Float, layout: GridLayout, count: Int): Int {
  if (!x.isFinite() || count == 0) return -1
  val step = if (layout.step > 0f) layout.step else layout.image
  val index = ((x - layout.first - layout.image / 2) / step).roundToInt()
  if (index !in 0 until count) return -1
  val center = layout.first + index * layout.step + layout.image / 2
  return if (abs(x - center) <= max(step, layout.image) / 2) index else -1
}

/** Draws an item's image fitted into the square at ([left], [top]). */
private fun DrawScope.drawItemImage(image: ItemImage, left: Float, top: Float, box: Float, alpha: Float) {
  val still = image.still
  val moving = image.moving
  val width = still?.width ?: moving?.intrinsicWidth ?: return
  val height = still?.height ?: moving?.intrinsicHeight ?: return
  val scale = if (width > 0 && height > 0) min(box / width, box / height) else 1f
  val w = if (width > 0) width * scale else box
  val h = if (height > 0) height * scale else box
  val x = (left + (box - w) / 2).roundToInt()
  val y = (top + (box - h) / 2).roundToInt()
  if (still != null) {
    drawImage(still, dstOffset = IntOffset(x, y), dstSize = IntSize(w.roundToInt(), h.roundToInt()), alpha = alpha, filterQuality = FilterQuality.Low)
  } else if (moving != null) {
    // Bounds fixed at the image's own size, the canvas moved and scaled instead. APNGDrawable draws at (0, 0)
    // whatever its bounds. A new bounds size can change its sample size, and a frame decoded at the old one then
    // shows at the wrong size until the next frame, which never comes while paused.
    val boundsWidth = if (width > 0) width else w.roundToInt()
    val boundsHeight = if (height > 0) height else h.roundToInt()
    moving.setBounds(0, 0, boundsWidth, boundsHeight)
    moving.alpha = (alpha * 255).roundToInt()
    drawIntoCanvas {
      it.nativeCanvas.withTranslation(x.toFloat(), y.toFloat()) {
        scale(w / boundsWidth, h / boundsHeight)
        moving.draw(this)
      }
    }
  }
}

/**
 * The accessibility services' state: on while any is enabled (TalkBack, Switch Access, Voice Access, ...), the same
 * test Compose makes before it does any accessibility work.
 */
@Composable
internal fun rememberAccessibilityEnabled(): Boolean {
  val context = LocalContext.current
  val manager = remember(context) { context.getSystemService(AccessibilityManager::class.java) }
  var enabled by remember(manager) { mutableStateOf(manager?.isEnabled == true) }
  DisposableEffect(manager) {
    val listener = AccessibilityManager.AccessibilityStateChangeListener { enabled = it }
    manager?.addAccessibilityStateChangeListener(listener)
    onDispose { manager?.removeAccessibilityStateChangeListener(listener) }
  }
  return enabled
}

/**
 * An interaction source that keeps the last press and whether it is down, as it happens (no collector per row), so
 * the tap can tell which item it was on and the row can highlight it.
 */
private class CellPressSource : MutableInteractionSource {
  private val inner = MutableInteractionSource()
  var position: Offset = Offset.Unspecified
    private set
  var pressing by mutableStateOf(false)
    private set

  override val interactions = inner.interactions

  override suspend fun emit(interaction: Interaction) {
    note(interaction)
    inner.emit(interaction)
  }

  override fun tryEmit(interaction: Interaction): Boolean {
    note(interaction)
    return inner.tryEmit(interaction)
  }

  private fun note(interaction: Interaction) {
    when (interaction) {
      is PressInteraction.Press -> {
        position = interaction.pressPosition
        pressing = true
      }
      is PressInteraction.Release, is PressInteraction.Cancel -> pressing = false
    }
  }
}

/** Draws a row's images or placeholders, the locks and the press highlight. */
private fun DrawScope.drawCells(
  images: RowImages,
  count: Int,
  kind: GridKind,
  layout: GridLayout,
  theme: ChatTheme,
  source: CellPressSource,
  highlight: Float,
  lock: Painter,
  radius: Float,
  lockSize: Float,
) {
    images.version.intValue
    val top = (size.height - layout.image) / 2
    val box = Size(layout.image, layout.image)
    val now = SystemClock.uptimeMillis()
    var fading = false
    images.images.forEachIndexed { index, image ->
      val item = image.item
      val left = layout.first + index * layout.step
      // The placeholder until the image is there, then fading out under it (the reference's 100ms fade).
      val shown = if (!image.loaded) 0f else if (image.arrivedAt == 0L) 1f else ((now - image.arrivedAt) / FADE_MS.toFloat()).coerceIn(0f, 1f)
      if (shown < 1f) {
        if (image.loaded) fading = true
        if (kind.round) {
          drawOval(theme.placeholder, Offset(left, top), box, alpha = 1f - shown)
        } else {
          drawRoundRect(theme.placeholder, Offset(left, top), box, CornerRadius(radius), alpha = 1f - shown)
        }
      }
      if (shown > 0f) drawItemImage(image, left, top, layout.image, shown)
      if (item.locked) {
        if (kind.round) {
          drawRect(LOCK_SHADE, Offset(left, top), box)
        } else {
          drawRoundRect(LOCK_SHADE, Offset(left, top), box, CornerRadius(radius))
        }
        translate(left + (layout.image - lockSize) / 2, top + (layout.image - lockSize) / 2) {
          with(lock) { draw(Size(lockSize, lockSize)) }
        }
      }
    }
    if (fading) Choreographer.getInstance().postFrameCallback { images.redraw() }
    val alpha = highlight
    val pressed = column(source.position.x, layout, count)
    if (alpha > 0f && pressed >= 0) {
      val left = layout.first + pressed * layout.step
      if (kind.round) {
        drawOval(theme.ripple, Offset(left, top), box, alpha = alpha)
      } else {
        drawRoundRect(theme.ripple, Offset(left, top), box, CornerRadius(radius), alpha = alpha)
      }
    }
}

/** What accessibility services see of the items. */
@Composable
private fun BoxScope.CellsAccessibility(row: CellsRow, layout: GridLayout, onPress: (String) -> Unit, onLongPress: (String) -> Unit) {
  // What accessibility services see of the items (the reference's one view per emoji): an empty node over each
  // image with its name and the row's actions. Touches still go to the row; these draw and load nothing.
  val image = with(LocalDensity.current) { layout.image.toDp() }
  row.items.forEachIndexed { index, item ->
    key(item.key) {
      Box(
        Modifier
          .offset { IntOffset((layout.first + index * layout.step).roundToInt(), 0) }
          .align(Alignment.CenterStart)
          .size(image)
          .semantics {
            contentDescription = item.label
            role = Role.Button
            onClick { onPress(item.key); true }
            onLongClick { onLongPress(item.key); true }
          },
      )
    }
  }
}
