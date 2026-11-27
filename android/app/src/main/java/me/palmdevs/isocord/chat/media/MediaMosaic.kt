package me.palmdevs.isocord.chat.media

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.painter.BitmapPainter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.onPlaced
import androidx.compose.ui.layout.positionInWindow
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import me.palmdevs.isocord.chat.chatPress
import me.palmdevs.isocord.chat.list.LocalChatActions
import me.palmdevs.isocord.chat.list.LocalChatFonts
import me.palmdevs.isocord.chat.list.LocalChatTheme
import me.palmdevs.isocord.chat.rows.Media
import me.palmdevs.isocord.expressions.ActiveFlight
import me.palmdevs.isocord.expressions.LocalChatFlightKey
import me.palmdevs.isocord.expressions.LocalChatFlightTarget
import me.palmdevs.isocord.expressions.flightTarget

private val MEDIA_GAP = 4.dp

private val MEDIA_MAX_HEIGHT = 350.dp

private const val MOSAIC_MAX = 10

/** One image, video or GIF in a gallery. */
class MediaTile(
  val media: Media,
  /** A video file: played over the poster. */
  val videoUrl: String? = null,
  /** The video is a GIF replacement: autoplays muted on a loop. */
  val gifv: Boolean = false,
  /** Hosted player (YouTube ...): a play button that opens this link. */
  val playLink: String? = null,
  /** Non-null (the "SPOILER" label) when hidden until tapped. */
  val spoiler: String? = null,
  val description: String? = null,
  val altLabel: String? = null,
  /** Tapping a still image, with the tile's place in the window ([originOf]) for the media viewer to grow from. */
  val onOpen: ((origin: String) -> Unit)? = null,
  /** Long press, so the message's own menu still opens over its media. */
  val onLongPress: (() -> Unit)? = null,
)

/**
 * A tile's place in the window as `x,y,width,height` in dp, sent with `isocord://media` and `isocord://embed-media`.
 * The viewer grows from it (openMediaModal originLayout). Empty when the tile is not laid out.
 */
fun originOf(coordinates: LayoutCoordinates?, density: Float): String {
  if (coordinates == null || !coordinates.isAttached) return ""
  val position = coordinates.positionInWindow()
  val size = coordinates.size
  return "${position.x / density},${position.y / density},${size.width / density},${size.height / density}"
}

/** Where each tile goes, in pixels. */
private class TileRect(val x: Int, val y: Int, val width: Int, val height: Int)

/** The reference's layout rules by tile count: 1 fills, 2 and 4 are two columns, 3 is one big and two small, more are rows of three (the remainder on top). */
private fun mosaicRects(count: Int, singleAspect: Float, naturalWidth: Int, width: Int, gap: Int, maxHeight: Int): List<TileRect> {
  if (count == 1) {
    var w = if (naturalWidth > 0) minOf(width, naturalWidth) else width
    var h = (w / singleAspect).toInt()
    if (h > maxHeight) {
      h = maxHeight
      w = (h * singleAspect).toInt()
    }
    return listOf(TileRect(0, 0, w, h))
  }
  val third = (width - 2 * gap) / 3
  val tall = 2 * third + gap
  if (count == 3) {
    return listOf(
      TileRect(0, 0, tall, tall),
      TileRect(tall + gap, 0, third, third),
      TileRect(tall + gap, third + gap, third, third),
    )
  }
  val remainder = count % 3
  val rects = ArrayList<TileRect>(count)
  var x = 0
  var y = 0
  var units = 0
  var rowHeight = 0
  for (index in 0 until count) {
    val (columns, span) = when {
      count == 2 || count == 4 -> 2 to 3
      index < remainder -> remainder to 6 / remainder
      else -> 3 to 2
    }
    val w = (width - (columns - 1) * gap) / columns
    val h = if (count == 4 || columns >= 3) third else tall
    rects.add(TileRect(x, y, w, h))
    rowHeight = h
    x += w + gap
    units += span
    if (units >= 6) {
      y += rowHeight + gap
      x = 0
      units = 0
    }
  }
  return rects
}

/** A gallery of images and videos; a single tile is scaled down (never up) to the available width and 350dp. */
@Composable
fun MediaMosaic(tiles: List<MediaTile>, modifier: Modifier = Modifier) {
  val shown = tiles.take(MOSAIC_MAX)
  if (shown.isEmpty()) return
  val gap = with(LocalDensity.current) { MEDIA_GAP.roundToPx() }
  val maxHeight = with(LocalDensity.current) { MEDIA_MAX_HEIGHT.roundToPx() }
  val density = LocalDensity.current.density
  val first = shown.firstOrNull()?.media
  val flight = LocalChatFlightTarget.current
  Layout(
    content = {
      shown.forEachIndexed { index, tile ->
        MediaTileView(tile, flight = if (index == 0) flight else null)
      }
    },
    modifier = modifier.padding(top = 4.dp).clip(RoundedCornerShape(8.dp)),
  ) { measurables, constraints ->
    // Sizes are in dp; without a known size the tile is a square.
    val aspect = if (first != null && first.width > 0 && first.height > 0) first.width.toFloat() / first.height else 1f
    val natural = if (first != null && first.width > 0) (first.width * density).toInt() else 0
    val rects = mosaicRects(shown.size, aspect, natural, constraints.maxWidth, gap, maxHeight)
    val placeables = measurables.mapIndexed { index, measurable ->
      val r = rects[index]
      measurable.measure(Constraints.fixed(r.width, r.height))
    }
    layout(rects.maxOf { it.x + it.width }, rects.maxOf { it.y + it.height }) {
      placeables.forEachIndexed { index, placeable -> placeable.place(rects[index].x, rects[index].y) }
    }
  }
}

private const val SPOILER_REVEAL_MS = 150

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun MediaTileView(tile: MediaTile, flight: ActiveFlight? = null) {
  val theme = LocalChatTheme.current
  val actions = LocalChatActions.current
  // Survives the list recycling the row.
  var revealed by rememberSaveable { mutableStateOf(false) }
  val hidden = tile.spoiler != null && !revealed
  val videoUrl = if (hidden) null else tile.videoUrl
  // Videos the user starts play exclusively (MediaState); GIF-style loops come from the shared pool.
  val state = rememberMedia(id = "tile:${tile.media.url}", url = if (tile.gifv) "" else videoUrl ?: "")
  val visible = remember { mutableStateOf(false) }
  val gifvPlayer by rememberGifvPlayer(if (tile.gifv) videoUrl else null, visible)
  val player = if (tile.gifv) gifvPlayer else state.player
  val isVideo = videoUrl != null || tile.playLink != null
  val aspect = if (tile.media.width > 0 && tile.media.height > 0) tile.media.width.toFloat() / tile.media.height else 16f / 9
  // A GIF that is the still of a video must not animate.
  val image = remember(tile.media, tile.gifv) { tile.media.proxied(animated = !tile.gifv) }
  // The spoiler cover fades out on reveal (SpoilerView animates the change over 150 ms).
  val cover by animateFloatAsState(if (hidden) 1f else 0f, tween(SPOILER_REVEAL_MS), label = "spoiler")
  val placed = remember { arrayOfNulls<LayoutCoordinates>(1) }
  val density = LocalDensity.current.density
  val flightKey = LocalChatFlightKey.current
  // Key by flightKey only so the snapshot stays visible when MESSAGE_UPDATE swaps gif.src for the proxied thumbnail.
  var fallback by remember(flightKey) { mutableStateOf(flight?.bitmap) }
  if (fallback == null && flight?.bitmap != null) {
    val bitmap = flight.bitmap
    SideEffect { fallback = bitmap }
  }
  val placeholder = remember(fallback) { fallback?.let(::BitmapPainter) }

  Box(
    Modifier
      .fillMaxSize()
      .background(theme.cardBackground)
      .border(0.25.dp, theme.mediaBorder)
      .then(if (tile.gifv) Modifier.trackVisible(visible) else Modifier)
      .onPlaced { placed[0] = it }
      .flightTarget(flight)
      .chatPress(
        onLongClick = tile.onLongPress,
        onClick = {
          when {
            hidden -> revealed = true
            tile.playLink != null -> actions.onLinkPress(tile.playLink)
            // A stopped video starts inline; tapping it while it plays opens it in the viewer.
            videoUrl != null && !tile.gifv && !state.playing -> state.toggle()
            else -> tile.onOpen?.invoke(originOf(placed[0], density))
          }
        },
      ),
  ) {
    if (tile.media.url.isNotEmpty()) {
      AsyncImage(
        model = image,
        contentDescription = tile.description,
        placeholder = placeholder,
        contentScale = ContentScale.Crop,
        modifier = Modifier.fillMaxSize(),
      )
    }
    // The poster stays underneath; the video view is transparent until its first frame is drawn.
    if (player != null && !hidden) VideoSurface(player, aspect, Modifier.fillMaxSize())
    if (cover > 0f) TileSpoilerCover(tile.spoiler.orEmpty(), cover)
    if (!hidden) {
      if (isVideo && !tile.gifv && !state.playing) PlayButton(Modifier.align(Alignment.Center))
      tile.altLabel?.let { AltBadge(it, Modifier.align(Alignment.BottomStart)) }
    }
  }
}

private val TileLabelStyle = TextStyle(color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp, lineHeight = 16.sp)

/** A spoiler is covered completely, not blurred (SpoilerOverlayView: a solid overlay with a centred label on #111214, 12/8dp padding). */
@Composable
internal fun TileSpoilerCover(label: String, alpha: Float) {
  val theme = LocalChatTheme.current
  Box(
    contentAlignment = Alignment.Center,
    modifier = Modifier.fillMaxSize().graphicsLayer { this.alpha = alpha }.background(theme.spoilerBackground),
  ) {
    BasicText(
      text = label,
      style = TileLabelStyle.copy(fontFamily = LocalChatFonts.current.sans),
      modifier = Modifier.background(theme.spoilerLabelBackground, CircleShape).padding(horizontal = 12.dp, vertical = 8.dp),
    )
  }
}

/** The ALT badge over a tile's bottom corner. */
@Composable
private fun AltBadge(text: String, modifier: Modifier) {
  BasicText(
    text = text,
    style = TileLabelStyle.copy(fontFamily = LocalChatFonts.current.sans, fontSize = 10.sp, lineHeight = 14.sp),
    modifier = modifier.padding(8.dp).background(LocalChatTheme.current.mediaBadgeBackground, RoundedCornerShape(4.dp)).padding(horizontal = 4.dp),
  )
}

/** An image scaled down (never up) to fit the available width and the 350dp media height. */
@Composable
fun MediaImage(media: Media, description: String?) {
  MediaMosaic(listOf(MediaTile(media, description = description)))
}
