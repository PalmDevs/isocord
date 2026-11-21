package me.palmdevs.isocord.chat.viewer

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.AnimationVector1D
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.PagerState
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.runtime.snapshots.SnapshotStateMap
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlin.math.abs
import kotlin.math.min
import kotlinx.coroutines.launch
import me.palmdevs.isocord.chat.media.MediaState
import me.palmdevs.isocord.chat.rows.ChatRow
import me.palmdevs.isocord.core.LinkKind
import me.palmdevs.isocord.core.Links

/*
 * The media viewer (reference modules/media_viewer/native): a pager of pictures and videos.
 * Grows out of the tapped tile, zooms, closes by swiping up or down.
 * The header is JS, drawn over this view. The footer is drawn here: video controls, ALT button, message, media strip, React button.
 */

/** The viewer's timings, which the JS header fades follow (MediaViewerHost.tsx). */
object ViewerMotion {
  /** useEntranceAnimation: 300 ms on the standard easing (0.4, 0, 0.2, 1). */
  const val ENTRANCE_MS = 300
  /** MediaViewer: the overlay fades in over 150 ms, linear. */
  const val OVERLAY_IN_MS = 150
  /** MediaViewer: the overlay fades out over 75 ms, linear. */
  const val OVERLAY_OUT_MS = 75
}

// MediaViewerItemPresenter: the corners go from 16 to square over the first quarter of the entrance.
internal const val ENTRANCE_CORNER = 16f

@Composable
fun MediaViewer(
  sources: List<ViewerSource>,
  initialIndex: Int,
  origin: ViewerOrigin?,
  message: ChatRow.Message?,
  labels: ViewerLabels,
  closeRequested: Boolean,
  bottomInset: Dp,
  speed: Float,
  actions: ViewerActions,
) {
  if (sources.isEmpty()) return
  val density = LocalDensity.current
  val view = LocalView.current
  val scope = rememberCoroutineScope()
  val latest by rememberUpdatedState(actions)

  val opening = initialIndex.coerceIn(0, sources.lastIndex)
  val pager = rememberPagerState(initialPage = opening) { sources.size }
  val entrance = remember { Animatable(0f) }
  var entered by remember { mutableStateOf(false) }
  // useMediaViewerPanGesture: translatePos, isInteracting, isClosing, overlayEnabled.
  val pan = remember { ViewerPan() }
  var overlayEnabled by remember { mutableStateOf(true) }
  // Per page: zoomed in, the spoiler revealed (the tapped one was revealed in the chat), the video's player.
  val zoomedPages = remember { mutableStateMapOf<Int, Boolean>() }
  val revealed = remember { mutableStateMapOf(opening to true) }
  val players = remember { mutableStateMapOf<Int, MediaState>() }
  val zoomed = zoomedPages[pager.currentPage] == true

  LaunchedEffect(speed) {
    players.values.forEach { it.setPlaybackSpeed(speed) }
  }

  LaunchedEffect(Unit) {
    entrance.animateTo(1f, tween(ViewerMotion.ENTRANCE_MS, easing = FastOutSlowInEasing))
    entered = true
  }
  LaunchedEffect(pager) {
    snapshotFlow { pager.settledPage }.collect { latest.onIndexChange(it) }
  }
  val overlayVisible = overlayEnabled && !pan.interacting && !pan.closing
  LaunchedEffect(overlayVisible) { latest.onOverlayChange(overlayVisible) }
  val overlay = rememberOverlay(overlayVisible, pan.closing)

  // The view's own place in the window, so the tile's window position can be placed inside it.
  val viewOffset = remember(view) {
    val location = IntArray(2)
    view.getLocationInWindow(location)
    Offset(location[0] / density.density, location[1] / density.density)
  }

  BoxWithConstraints(Modifier.fillMaxSize()) {
    val windowWidth = maxWidth.value
    val windowHeight = maxHeight.value
    val fits = remember(sources, windowWidth, windowHeight) { sources.map { fitToWindow(windowWidth, windowHeight, it) } }
    // useMediaViewerClosePosition: far enough for the current media to leave the screen.
    val closePosition = with(density) { ((windowHeight + fits[pager.currentPage].height) / 2).dp.toPx() }

    // The gesture below outlives compositions; it reads the current page's state through these.
    val dismissLatest by rememberUpdatedState<(Float) -> Unit> { velocity ->
      pan.dismiss(scope, velocity, closePosition, latest.onClosing, latest.onClosed)
    }
    val zoomedLatest by rememberUpdatedState(zoomed)
    LaunchedEffect(closeRequested) { if (closeRequested) dismissLatest(0f) }

    // MediaViewerTsx5: black, faded in with the entrance and out as the media is dragged away.
    Box(
      Modifier
        .fillMaxSize()
        .graphicsLayer {
          alpha = min(entrance.value, (1f - abs(pan.translation) / closePosition).coerceIn(0f, 1f))
        }
        .background(Color.Black),
    )

    Box(Modifier.fillMaxSize().viewerPan(pan, scope, { !zoomedLatest && entered }, dismissLatest)) {
      ViewerPager(
        pager = pager,
        sources = sources,
        fits = fits,
        opening = opening,
        origin = origin?.let { ViewerOrigin(it.x - viewOffset.x, it.y - viewOffset.y, it.width, it.height) },
        entrance = entrance,
        entered = entered,
        pan = pan,
        revealed = revealed,
        zoomedPages = zoomedPages,
        players = players,
        speed = speed,
        actions = latest,
        onTap = { overlayEnabled = !overlayEnabled },
      )
    }

    // Like the reference's header (setShowHeader), the footer is removed once faded out, so taps reach the media.
    if (overlay.value > 0f) {
      val current = pager.currentPage
      ViewerFooter(
        message = message,
        sources = sources,
        selected = current,
        player = players[current],
        speed = speed,
        hidden = { sources[it].spoiler != null && revealed[it] != true },
        onSelect = { scope.launch { pager.animateScrollToPage(it) } },
        onAlt = { latest.onLinkPress("${Links.SCHEME}${LinkKind.VIEWER}/${ViewerAction.ALT}/$current") },
        onSpeed = { x, y, w, h ->
          latest.onLinkPress("${Links.SCHEME}${LinkKind.VIEWER}/${ViewerAction.SPEED}?${Links.ORIGIN_PARAM}=$x,$y,$w,$h")
        },
        labels = labels,
        bottomInset = bottomInset,
        modifier = Modifier.align(Alignment.BottomCenter).overlayMotion(entrance, overlay),
      )
    }
  }
}

/** The pages: each picture or video, the tapped one growing out of its tile. */
@Composable
private fun ViewerPager(
  pager: PagerState,
  sources: List<ViewerSource>,
  fits: List<ViewerFit>,
  opening: Int,
  origin: ViewerOrigin?,
  entrance: Animatable<Float, AnimationVector1D>,
  entered: Boolean,
  pan: ViewerPan,
  revealed: SnapshotStateMap<Int, Boolean>,
  zoomedPages: SnapshotStateMap<Int, Boolean>,
  players: SnapshotStateMap<Int, MediaState>,
  speed: Float,
  actions: ViewerActions,
  onTap: () -> Unit,
) {
  HorizontalPager(
    state = pager,
    // Not turned off while zoomed (the reference's scrollEnabled): telephoto pans a zoomed picture itself and
    // leaves the swipe to the pager once the picture's edge is reached, and a pinch never reaches the pager.
    // Turning it off left the pager stuck after a pinch that ended a little above the smallest zoom. Off during
    // a swipe to close, so a sideways drift does not hand the gesture to the pager (the reference's failOffsetX).
    userScrollEnabled = entered && !pan.closing && !pan.interacting,
    key = { it },
    modifier = Modifier.fillMaxSize(),
  ) { page ->
    val start = if (page == opening) origin else null
    ViewerPage(
      source = sources[page],
      fit = fits[page],
      start = start,
      progress = { if (page == opening) entrance.value else 1f },
      active = entered && pager.settledPage == page && !pan.closing,
      revealed = revealed[page] == true,
      onReveal = { revealed[page] = true },
      onTap = onTap,
      onLongPress = { actions.onLinkPress("${Links.SCHEME}${LinkKind.VIEWER}/${ViewerAction.OPTIONS}/$page") },
      onZoomedChange = { zoomedPages[page] = it },
      onPlayer = { state ->
        if (state != null) {
          state.setPlaybackSpeed(speed)
          players[page] = state
        } else {
          players.remove(page)
        }
      },
      onLinkPress = actions.onLinkPress,
    )
  }
}
