package me.palmdevs.isocord.chat.viewer

import androidx.compose.animation.core.snap
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.util.lerp
import coil3.compose.AsyncImage
import coil3.request.ImageRequest
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import me.palmdevs.isocord.chat.list.LocalChatFonts
import me.palmdevs.isocord.chat.list.LocalChatTheme
import me.palmdevs.isocord.chat.media.MediaState
import me.palmdevs.isocord.chat.media.PlayButton
import me.palmdevs.isocord.chat.media.ProxyImage
import me.palmdevs.isocord.chat.media.VideoSurface
import me.palmdevs.isocord.chat.media.loadedCopy
import me.palmdevs.isocord.chat.media.rememberGifvPlayer
import me.palmdevs.isocord.chat.media.rememberMedia
import me.saket.telephoto.zoomable.DynamicZoomSpec
import me.saket.telephoto.zoomable.ZoomSpec
import me.saket.telephoto.zoomable.rememberZoomableState
import me.saket.telephoto.zoomable.zoomable

/** MediaPlayerMuteManager: whether viewer videos play muted, kept while the app runs. */
internal object ViewerMute {
  var muted by mutableStateOf(false)
}

// The largest side the full picture is decoded at.
private const val FULL_MAX_PIXELS = 4096

/** The size media is shown at, in dp, and how far it zooms relative to that size. */
internal class ViewerFit(val width: Float, val height: Float, val maxZoom: Float)

/**
 * getMediaViewerStateForScreen: media smaller than the window keeps its size (pixels as dp), larger is fitted.
 * The zoom limit lets large media reach one pixel per dp and doubles small media.
 * Media of unknown size gets the window as its box, fitted inside it, and zooms to twice that.
 */
internal fun fitToWindow(windowWidth: Float, windowHeight: Float, source: ViewerSource): ViewerFit {
  val width = source.width.toFloat()
  val height = source.height.toFloat()
  if (width <= 0f || height <= 0f) return ViewerFit(windowWidth, windowHeight, 2f)
  val windowRatio = windowWidth / windowHeight
  val ratio = width / height
  if (width < windowWidth && height < windowHeight) {
    val fraction = if (ratio > windowRatio) width / windowWidth else height / windowHeight
    val bound = min(0.5f, fraction / 1.01f)
    return ViewerFit(width, height, if (bound == 0f) 2f else 1f / bound)
  }
  return if (ratio > windowRatio) {
    val scale = windowWidth / width
    ViewerFit(windowWidth, height * scale, 1f / scale + 1f)
  } else {
    val scale = windowHeight / height
    ViewerFit(width * scale, windowHeight, 1f / scale + 1f)
  }
}

/**
 * One page: the media in its box, growing from the tapped tile ([start]) as [progress] runs 0 to 1.
 * MediaViewerItemPresenter, cover mode: the box resizes, the picture keeps covering it.
 * Pictures zoom with the whole page (the reference's zooming ScrollView), so a zoomed picture pans past its edges.
 */
@Composable
internal fun ViewerPage(
  source: ViewerSource,
  fit: ViewerFit,
  start: ViewerOrigin?,
  progress: () -> Float,
  active: Boolean,
  revealed: Boolean,
  onReveal: () -> Unit,
  onTap: () -> Unit,
  onLongPress: () -> Unit,
  onZoomedChange: (Boolean) -> Unit,
  onPlayer: (MediaState?) -> Unit,
  onLinkPress: (String) -> Unit,
) {
  val density = LocalDensity.current
  val hidden = source.spoiler != null && !revealed
  val isVideo = source.videoUrl != null || source.embedUrl != null
  val zoomState = rememberZoomableState(DynamicZoomSpec.fixed(ZoomSpec(maxZoomFactor = fit.maxZoom)))
  val zoomed = (zoomState.zoomFraction ?: 0f) > 0.01f
  LaunchedEffect(zoomed) { onZoomedChange(zoomed) }
  // A page left behind is shown unzoomed when it comes back.
  LaunchedEffect(active) { if (!active) zoomState.resetZoom(snap()) }
  val zoomable = source.embedUrl == null && !hidden && progress() >= 1f

  BoxWithConstraints(
    Modifier
      .fillMaxSize()
      .then(
        if (zoomable) {
          Modifier.zoomable(zoomState, onClick = { onTap() }, onLongClick = { onLongPress() })
        } else {
          Modifier.pointerInput(hidden) {
            detectTapGestures(onTap = { if (hidden) onReveal() else onTap() }, onLongPress = { onLongPress() })
          }
        },
      ),
  ) {
    val windowWidth = constraints.maxWidth.toFloat()
    val windowHeight = constraints.maxHeight.toFloat()
    Box(
      Modifier
        .layout { measurable, _ ->
          val p = progress()
          val targetWidth = fit.width * density.density
          val targetHeight = fit.height * density.density
          val targetX = (windowWidth - targetWidth) / 2
          val targetY = (windowHeight - targetHeight) / 2
          val width = lerp(start?.width?.times(density.density) ?: targetWidth, targetWidth, p)
          val height = lerp(start?.height?.times(density.density) ?: targetHeight, targetHeight, p)
          val x = lerp(start?.x?.times(density.density) ?: targetX, targetX, p)
          val y = lerp(start?.y?.times(density.density) ?: targetY, targetY, p)
          val placeable = measurable.measure(Constraints.fixed(width.roundToInt(), height.roundToInt()))
          layout(constraints.maxWidth, constraints.maxHeight) { placeable.place(x.roundToInt(), y.roundToInt()) }
        }
        .graphicsLayer {
          val corner = lerp(ENTRANCE_CORNER, 0f, (progress() / 0.25f).coerceIn(0f, 1f))
          shape = RoundedCornerShape(corner.dp)
          clip = true
        },
    ) {
      ViewerPicture(source, fit)
      when {
        hidden -> SpoilerCover(source.spoiler.orEmpty())
        source.embedUrl != null -> HostedPlayer(source, active)
        source.videoUrl != null -> ViewerVideo(source, active, onPlayer)
      }
    }
  }
}

/**
 * The picture filling the page's box, asked for at the size it reaches at full zoom (the proxy scales it, never past
 * its own size). The tile's copy from the memory cache stands in until it arrives.
 */
@Composable
private fun ViewerPicture(source: ViewerSource, fit: ViewerFit) {
  if (source.url.isEmpty()) return
  val context = LocalContext.current
  val density = LocalDensity.current.density
  val request = remember(source, fit) {
    var width = source.width
    var height = source.height
    if (width > 0 && height > 0) {
      val wanted = fit.width * density * fit.maxZoom
      val scale = min(min(1f, wanted / width), FULL_MAX_PIXELS.toFloat() / max(width, height))
      width = max(1, (width * scale).roundToInt())
      height = max(1, (height * scale).roundToInt())
    } else {
      width = FULL_MAX_PIXELS / 2
      height = FULL_MAX_PIXELS / 2
    }
    ImageRequest.Builder(context)
      .data(ProxyImage(source.url, source.width, source.height, animated = !source.gifv))
      .size(width, height)
      .placeholderMemoryCacheKey(loadedCopy(context, source.url))
      .build()
  }
  AsyncImage(
    model = request,
    contentDescription = source.description,
    // The box of unknown-size media is the window, so the picture fits in it rather than covering it.
    contentScale = if (source.width > 0 && source.height > 0) ContentScale.Crop else ContentScale.Fit,
    modifier = Modifier.fillMaxSize(),
  )
}

/** MediaModalSpoilerOverlay: the media covered, with the label, until tapped (as in the chat's tiles). */
@Composable
private fun SpoilerCover(label: String) {
  val theme = LocalChatTheme.current
  Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize().background(theme.spoilerBackground)) {
    BasicText(
      text = label,
      style = TextStyle(color = Color.White, fontFamily = LocalChatFonts.current.sans, fontWeight = FontWeight.Bold, fontSize = 12.sp, lineHeight = 16.sp),
      modifier = Modifier.background(theme.spoilerLabelBackground, CircleShape).padding(horizontal = 12.dp, vertical = 8.dp),
    )
  }
}

/**
 * MediaModalVideo: a video file over its still. It plays when its page is shown and pauses when left; GIF-style
 * videos loop muted on the chat's pooled players. The footer's controls drive the state reported to [onPlayer].
 */
@Composable
private fun ViewerVideo(source: ViewerSource, active: Boolean, onPlayer: (MediaState?) -> Unit) {
  val gifv = source.gifv
  val state = rememberMedia(id = "viewer:${source.videoUrl}", url = if (gifv) "" else source.videoUrl.orEmpty())
  val visible = rememberUpdatedState(active)
  val gifvPlayer by rememberGifvPlayer(if (gifv) source.videoUrl else null, visible)
  val player = if (gifv) gifvPlayer else state.player
  if (!gifv) {
    DisposableEffect(state) {
      onPlayer(state)
      onDispose { onPlayer(null) }
    }
    LaunchedEffect(active) {
      if (active && !state.playing) state.toggle() else if (!active) state.player?.pause()
    }
    LaunchedEffect(player, ViewerMute.muted) { player?.volume = if (ViewerMute.muted) 0f else 1f }
  }
  val aspect = if (source.width > 0 && source.height > 0) source.width.toFloat() / source.height else 16f / 9
  Box(Modifier.fillMaxSize()) {
    if (player != null) VideoSurface(player, aspect, Modifier.fillMaxSize())
    if (!gifv && !state.playing) PlayButton(Modifier.align(Alignment.Center)) { state.toggle() }
  }
}
