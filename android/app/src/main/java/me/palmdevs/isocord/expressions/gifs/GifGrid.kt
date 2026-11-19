package me.palmdevs.isocord.expressions.gifs

import android.os.SystemClock
import android.view.Choreographer
import androidx.compose.foundation.Image
import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.staggeredgrid.LazyStaggeredGridState
import androidx.compose.foundation.lazy.staggeredgrid.LazyVerticalStaggeredGrid
import androidx.compose.foundation.lazy.staggeredgrid.StaggeredGridCells
import androidx.compose.foundation.lazy.staggeredgrid.items
import androidx.compose.foundation.lazy.staggeredgrid.rememberLazyStaggeredGridState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.onLongClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.SingletonImageLoader
import kotlin.math.max
import kotlin.math.roundToInt
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.first
import me.palmdevs.isocord.R
import me.palmdevs.isocord.chat.ChatFonts
import me.palmdevs.isocord.chat.ChatRipple
import me.palmdevs.isocord.chat.chatPress
import me.palmdevs.isocord.chat.media.cachedPainter
import me.palmdevs.isocord.chat.rows.ChatTheme
import me.palmdevs.isocord.expressions.FADE_MS
import me.palmdevs.isocord.expressions.SIDE_PADDING
import me.palmdevs.isocord.expressions.ScrollWatch

/** GIF_PICKER_GUTTER_SPACING. */
private val GUTTER = 8.dp

/** Tile corners (radii.xs). */
private val TILE_RADIUS = 4.dp

/** A category tile's height: half of GIF_PICKER_ITEM_ESIMTATED_HEIGHT, less the gutter, as in two columns. */
private val CATEGORY_HEIGHT = 82.dp

/** Three columns from this width (GIFPicker's tablet layout), two below. */
private val WIDE = 600.dp

/** GIFs play again once the grid has been still this long, as in the expression grid. */
private const val IDLE_MS = 300L

/** A GIF's height to width is kept within these, so a strip or a tower still fits a column. */
private const val MIN_ASPECT = 0.4f

private const val MAX_ASPECT = 3f

/** gifOverlay: black at 60% under a category's name. */
private val CATEGORY_SHADE = Color.Black.copy(alpha = 0.6f)

/** text-sm/semibold, text-overlay-light. */
private val CATEGORY_TEXT = TextStyle(color = Color.White, fontSize = 14.sp, lineHeight = 18.sp, fontWeight = FontWeight.SemiBold)

private val CATEGORY_ICON = 18.dp

private val BADGE_TEXT = TextStyle(color = Color.White, fontSize = 11.sp, lineHeight = 14.sp, fontWeight = FontWeight.SemiBold)

/**
 * The GIF picker's grid (reference: GIFPickerResultsList's MasonryFlashList and GIFPickerCategoriesPage), one
 * staggered list for both. Images load at their tile's size, not during a fast fling. They play while the grid
 * is still.
 */
@Composable
fun GifGrid(
  tiles: List<GifTile>,
  theme: ChatTheme,
  fonts: ChatFonts,
  bottomPadding: Dp,
  onPress: (String) -> Unit,
  onLongPress: (String) -> Unit,
  onAtTop: (Boolean) -> Unit,
) {
  BoxWithConstraints(Modifier.fillMaxSize()) {
    val columns = if (maxWidth >= WIDE) 3 else 2
    val state = rememberLazyStaggeredGridState()
    val watch = remember { ScrollWatch() }
    var playing by remember { mutableStateOf(true) }

    GifGridEffects(state, watch, tiles.firstOrNull()?.key, onAtTop) { playing = it }

    CompositionLocalProvider(LocalIndication provides remember(theme.ripple) { ChatRipple(theme.ripple) }) {
      LazyVerticalStaggeredGrid(
        columns = StaggeredGridCells.Fixed(columns),
        state = state,
        modifier = Modifier.fillMaxSize().nestedScroll(watch),
        contentPadding = PaddingValues(start = SIDE_PADDING, end = SIDE_PADDING, bottom = bottomPadding),
        verticalItemSpacing = GUTTER,
        horizontalArrangement = Arrangement.spacedBy(GUTTER),
      ) {
        items(tiles, key = { it.key }, contentType = { if (it.category) 0 else 1 }) { tile ->
          Tile(tile, theme, fonts, playing, watch, onPress, onLongPress)
        }
      }
    }
  }
}

/** Pauses the GIFs while the grid moves, reports whether it is at its top, and starts new results at the top. */
@Composable
private fun GifGridEffects(
  state: LazyStaggeredGridState,
  watch: ScrollWatch,
  firstKey: String?,
  onAtTop: (Boolean) -> Unit,
  setPlaying: (Boolean) -> Unit,
) {
  val atTop by rememberUpdatedState(onAtTop)
  LaunchedEffect(state) {
    snapshotFlow { state.isScrollInProgress }.collectLatest { moving ->
      if (moving) {
        setPlaying(false)
      } else {
        watch.stop()
        delay(IDLE_MS)
        setPlaying(true)
      }
    }
  }
  LaunchedEffect(state) {
    snapshotFlow { state.firstVisibleItemIndex == 0 && state.firstVisibleItemScrollOffset == 0 }
      .distinctUntilChanged()
      .collect { atTop(it) }
  }
  LaunchedEffect(firstKey) {
    if (state.firstVisibleItemIndex != 0 || state.firstVisibleItemScrollOffset != 0) state.scrollToItem(0)
  }
}

/**
 * A GIF or category tile: its image over the placeholder, the category's name or the provider badge on top. A GIF
 * can be held (GIFPickerItemActionSheet).
 */
@Composable
private fun Tile(
  tile: GifTile,
  theme: ChatTheme,
  fonts: ChatFonts,
  playing: Boolean,
  watch: ScrollWatch,
  onPress: (String) -> Unit,
  onLongPress: (String) -> Unit,
) {
  val context = LocalContext.current
  val image = remember(tile.src) { GifImage(context, SingletonImageLoader.get(context), tile.src) }
  var size by remember { mutableStateOf(IntSize.Zero) }
  val press by rememberUpdatedState(onPress)
  val longPress by rememberUpdatedState(onLongPress)
  val holdable = !tile.category && tile.src.isNotEmpty()
  val shape = RoundedCornerShape(TILE_RADIUS)
  val aspect = if (tile.width > 0 && tile.height > 0) {
    (tile.width.toFloat() / tile.height).coerceIn(1 / MAX_ASPECT, 1 / MIN_ASPECT)
  } else {
    1f
  }

  LaunchedEffect(image, size) {
    if (size == IntSize.Zero) return@LaunchedEffect
    snapshotFlow { watch.fast }.first { !it }
    image.load(size.width, size.height)
  }
  LaunchedEffect(image, playing) { image.setPlaying(playing) }

  Box(
    (if (tile.category) Modifier.height(CATEGORY_HEIGHT) else Modifier.aspectRatio(aspect))
      .fillMaxWidth()
      .clip(shape)
      .onSizeChanged { size = it }
      .semantics {
        contentDescription = tile.label
        role = Role.Button
        if (holdable) onLongClick { longPress(tile.key); true }
      }
      .chatPress(
        onClick = { if (tile.src.isNotEmpty()) press(tile.key) },
        onLongClick = if (holdable) ({ longPress(tile.key) }) else null,
      )
      .drawBehind { drawTileImage(image, theme.placeholder) },
  ) {
    if (tile.category) CategoryLabel(tile, fonts)
    if (tile.badge.isNotEmpty()) Badge(tile.badge, fonts, theme)
  }
}

/** The image cropped to fill the tile, fading in over the placeholder (the grids' 100ms fade). */
private fun DrawScope.drawTileImage(image: GifImage, placeholder: Color) {
  image.version.intValue
  val drawable = image.drawable
  val shown = when {
    drawable == null -> 0f
    else -> ((SystemClock.uptimeMillis() - image.arrivedAt) / FADE_MS.toFloat()).coerceIn(0f, 1f)
  }
  if (shown < 1f) drawRect(placeholder, alpha = 1f - shown)
  if (drawable == null) return
  val width = drawable.intrinsicWidth.takeIf { it > 0 } ?: size.width.roundToInt()
  val height = drawable.intrinsicHeight.takeIf { it > 0 } ?: size.height.roundToInt()
  val scale = max(size.width / width, size.height / height)
  val w = (width * scale).roundToInt()
  val h = (height * scale).roundToInt()
  val x = ((size.width - w) / 2).roundToInt()
  val y = ((size.height - h) / 2).roundToInt()
  drawable.setBounds(x, y, x + w, y + h)
  drawable.alpha = (shown * 255).roundToInt()
  drawIntoCanvas { drawable.draw(it.nativeCanvas) }
  if (shown < 1f) Choreographer.getInstance().postFrameCallback { image.redraw() }
}

/** GIFPickerCategoryView: the dimmed image with the icon and name centred on it. */
@Composable
private fun BoxScope.CategoryLabel(tile: GifTile, fonts: ChatFonts) {
  val icon = when (tile.icon) {
    GifTileIcon.TRENDING -> R.drawable.gif_category_trending
    GifTileIcon.FAVORITES -> R.drawable.gif_category_favorites
    else -> null
  }
  Box(Modifier.matchParentSize().background(CATEGORY_SHADE))
  Row(
    Modifier.align(Alignment.Center).padding(8.dp),
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.spacedBy(4.dp),
  ) {
    if (icon != null) {
      Image(cachedPainter(icon), contentDescription = null, colorFilter = ColorFilter.tint(Color.White), modifier = Modifier.size(CATEGORY_ICON))
    }
    BasicText(tile.label, style = CATEGORY_TEXT.copy(fontFamily = fonts.sans), maxLines = 2, overflow = TextOverflow.Ellipsis)
  }
}

/** The provider of a GIF when several are chosen (the gif-providers plugin's ProviderPill). */
@Composable
private fun BoxScope.Badge(text: String, fonts: ChatFonts, theme: ChatTheme) {
  BasicText(
    text,
    style = BADGE_TEXT.copy(fontFamily = fonts.sans),
    modifier = Modifier
      .align(Alignment.BottomStart)
      .padding(6.dp)
      .background(theme.mediaBadgeBackground, RoundedCornerShape(TILE_RADIUS))
      .padding(horizontal = 4.dp, vertical = 1.dp),
  )
}
