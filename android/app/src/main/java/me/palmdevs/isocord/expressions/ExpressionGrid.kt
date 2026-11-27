package me.palmdevs.isocord.expressions

import android.os.SystemClock
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.gestures.FlingBehavior
import androidx.compose.foundation.gestures.ScrollScope
import androidx.compose.foundation.gestures.ScrollableDefaults
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.layout.LazyLayoutCacheWindow
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.rememberVectorPainter
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.vectorResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil3.SingletonImageLoader
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.distinctUntilChanged
import me.palmdevs.isocord.R
import me.palmdevs.isocord.chat.ChatFonts
import me.palmdevs.isocord.chat.rows.ChatTheme
import me.palmdevs.isocord.chat.rows.Sticker
import me.palmdevs.isocord.notifications.notify.title

/** The `kind` prop of the grid, which JS sets. */
object GridKindName {
  const val EMOJI = "emoji"
  const val STICKER = "sticker"
}

/**
 * What the grid shows and its sizes: as many items as fit at least [minGap] apart, spread across the row
 * (`space-between`) inside [SIDE_PADDING].
 * Emoji: the reference's IMAGE_SIZE (33) in 44dp rows.
 * Sticker: STICKER_SIZE (64) in ROW_HEIGHT (64 + 2 * PADDING_VERTICAL) rows, MIN_MARGIN apart.
 */
enum class GridKind(val image: Dp, val rowHeight: Dp, val minGap: Dp, val minColumns: Int, val round: Boolean) {
  Emoji(33.dp, 44.dp, 11.dp, minColumns = 5, round = true),
  Sticker(64.dp, 72.dp, 8.dp, minColumns = 1, round = false),
}

/** The image fade (image_fade_duration / 3). */
internal const val FADE_MS = 100

/** Animations play again once the grid has been still this long (EmojiPickerView's scroll idle timer). */
private const val IDLE_MS = 300L

/** Past this speed (px/s) new images are not loaded until the grid slows down (`scrollFastVelocity`). */
private const val FAST_VELOCITY = 8000f

/** Rows composed ahead of the screen in idle time, and kept behind it, as fractions of its height. */
private const val CACHE_AHEAD = 1f

private const val CACHE_BEHIND = 0.5f

/** The fastest a fling starts (px/s): EmojiPickerView.fling clamps both directions to 12500. */
private const val MAX_FLING = 12500f

/** The platform fling, started at no more than [MAX_FLING]. */
private class CappedFling(private val inner: FlingBehavior) : FlingBehavior {
  override suspend fun ScrollScope.performFling(initialVelocity: Float): Float =
    with(inner) { performFling(initialVelocity.coerceIn(-MAX_FLING, MAX_FLING)) }
}

/** A jump to a section's header, asked for by the `scrollToSection` command. One object per command. */
class ScrollRequest(val section: Int)

/** Where the items of a row sit, in px: the first item's left edge and the distance between items. */
@Immutable
internal class GridLayout(val columns: Int, val first: Float, val step: Float, val image: Float)

private fun gridLayout(kind: GridKind, width: Float, density: Float): GridLayout {
  val image = kind.image.value * density
  val padding = SIDE_PADDING.value * density
  val gap = kind.minGap.value * density
  val columns = max(kind.minColumns, floor((width - 2 * padding + gap) / (image + gap)).toInt())
  val step = if (columns > 1) (width - 2 * padding - image) / (columns - 1) else 0f
  return GridLayout(columns, padding, step, image)
}

@Immutable
internal sealed interface GridRow {
  val key: String
  val section: Int
}

@Immutable
internal data class HeaderRow(override val key: String, override val section: Int, val title: String) : GridRow

@Immutable
internal data class CellsRow(override val key: String, override val section: Int, val items: List<GridItem>) : GridRow

/** The rows for a column count, and the row each section starts at. */
internal class GridRows(val rows: List<GridRow>, val sectionStart: IntArray)

private fun buildRows(sections: List<GridSection>, columns: Int): GridRows {
  val rows = ArrayList<GridRow>()
  val starts = IntArray(sections.size)
  sections.forEachIndexed { index, section ->
    starts[index] = rows.size
    if (section.title.isNotEmpty()) rows += HeaderRow("h:${section.key}", index, section.title)
    for (start in section.items.indices step columns) {
      rows += CellsRow("${section.key}:$start", index, section.items.subList(start, min(start + columns, section.items.size)))
    }
  }
  return GridRows(rows, starts)
}

/**
 * How fast the grid moves, from the scrolls it reports to its parents: new images wait while it is [fast]
 * (EmojiPickerView's scrollFastOptimization).
 */
class ScrollWatch : NestedScrollConnection {
  var fast by mutableStateOf(false)
    private set
  private var velocity = 0f
  private var last = 0L

  override fun onPostScroll(consumed: Offset, available: Offset, source: NestedScrollSource): Offset {
    val now = SystemClock.uptimeMillis()
    val elapsed = now - last
    last = now
    val speed = if (elapsed in 1..100) abs(consumed.y) * 1000f / elapsed else 0f
    velocity = (velocity + speed) / 2
    val isFast = velocity > FAST_VELOCITY
    if (isFast != fast) fast = isFast
    return Offset.Zero
  }

  fun stop() {
    velocity = 0f
    fast = false
  }

}

/**
 * The expression picker's grid (reference: EmojiPickerView), drawn by rows like Telegram's.
 * One node draws a whole row's images (kept per row, see GridImages), so nothing is composed per item.
 * An unloaded image is a placeholder oval of BACKGROUND_MOD_MUTED. While the grid flings fast, no images are requested.
 */
// LazyLayoutCacheWindow is still experimental.
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun ExpressionGrid(
  sections: List<GridSection>,
  kind: GridKind,
  theme: ChatTheme,
  fonts: ChatFonts,
  animate: Boolean,
  bottomPadding: Dp,
  scrollRequest: ScrollRequest?,
  onPress: (String, String) -> Unit,
  onLongPress: (String) -> Unit,
  onActiveSection: (Int) -> Unit,
  onAtTop: (Boolean) -> Unit,
) {
  BoxWithConstraints(Modifier.fillMaxSize()) {
    val density = LocalDensity.current.density
    val width = constraints.maxWidth.toFloat()
    val layout = remember(kind, width, density) { gridLayout(kind, width, density) }
    val grid = remember(sections, layout.columns) { buildRows(sections, layout.columns) }
    // Rows are composed ahead in the idle time between frames (RecyclerView's prefetch), not in the frame that
    // scrolls them in.
    val listState = rememberLazyListState()
    val watch = remember { ScrollWatch() }
    val context = LocalContext.current
    val pixels = layout.image.roundToInt()
    val images = remember(context, pixels) { GridImages(context, SingletonImageLoader.get(context), pixels) { watch.fast } }
    val accessible = rememberAccessibilityEnabled()
    val lock = rememberVectorPainter(ImageVector.vectorResource(R.drawable.ic_lock))

    GridEffects(listState, images, watch, grid, sections.firstOrNull()?.key, scrollRequest, onActiveSection, onAtTop)

    val defaultFling = ScrollableDefaults.flingBehavior()
    val fling = remember(defaultFling) { CappedFling(defaultFling) }

    LazyColumn(
      state = listState,
      modifier = Modifier.fillMaxSize().nestedScroll(watch),
      flingBehavior = fling,
      contentPadding = PaddingValues(bottom = bottomPadding),
      cacheWindow = LazyLayoutCacheWindow(aheadFraction = CACHE_AHEAD, behindFraction = CACHE_BEHIND),
    ) {
      items(grid.rows, key = { it.key }, contentType = { if (it is HeaderRow) 0 else 1 }) { row ->
        when (row) {
          is HeaderRow -> Header(row.title, kind, theme, fonts)
          is CellsRow -> Cells(row, kind, layout, theme, animate, images, accessible, lock, onPress, onLongPress)
        }
      }
    }
  }
}

private fun <T> Flow<T>.distinct() = distinctUntilChanged()

/** The grid's side effects: animation pauses, the active section, the top flag and scroll requests. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun GridEffects(
  listState: LazyListState,
  images: GridImages,
  watch: ScrollWatch,
  grid: GridRows,
  firstKey: String?,
  scrollRequest: ScrollRequest?,
  onActiveSection: (Int) -> Unit,
  onAtTop: (Boolean) -> Unit,
) {
  val currentGrid by rememberUpdatedState(grid)
  val active by rememberUpdatedState(onActiveSection)
  val atTop by rememberUpdatedState(onAtTop)
// Animations hold still while the grid moves; fast scrolling ends as soon as it stops.
LaunchedEffect(listState) {
  snapshotFlow { listState.isScrollInProgress }.collectLatest { moving ->
    if (moving) {
      images.playing = false
    } else {
      watch.stop()
      delay(IDLE_MS)
      images.playing = true
    }
  }
}
LaunchedEffect(images) { images.run() }
// The section of the first row on screen (EmojiPickerScroller: the header at or above it).
LaunchedEffect(listState) {
  snapshotFlow { currentGrid.rows.getOrNull(listState.firstVisibleItemIndex)?.section ?: 0 }
    .distinct()
    .collect { active(it) }
}
LaunchedEffect(listState) {
  snapshotFlow { listState.firstVisibleItemIndex == 0 && listState.firstVisibleItemScrollOffset == 0 }
    .distinct()
    .collect { atTop(it) }
}
// Other results (a search typed or cleared) start at the top.
LaunchedEffect(firstKey) {
  if (listState.firstVisibleItemIndex != 0 || listState.firstVisibleItemScrollOffset != 0) listState.scrollToItem(0)
}
LaunchedEffect(scrollRequest) {
  val start = scrollRequest?.let { currentGrid.sectionStart.getOrNull(it.section) } ?: return@LaunchedEffect
  listState.scrollToItem(start)
}
}
