package me.palmdevs.isocord.chat.viewer

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.AnimationVector1D
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import me.palmdevs.isocord.chat.chatPress
import me.palmdevs.isocord.chat.list.LocalChatFonts
import me.palmdevs.isocord.chat.list.LocalChatTheme
import me.palmdevs.isocord.chat.media.MediaState
import me.palmdevs.isocord.chat.media.ProxyImage
import me.palmdevs.isocord.chat.rows.AVATAR_GAP
import me.palmdevs.isocord.chat.rows.AVATAR_SIZE
import me.palmdevs.isocord.chat.rows.ChatRow
import me.palmdevs.isocord.chat.rows.Header
import me.palmdevs.isocord.chat.rows.MessageAvatar
import me.palmdevs.isocord.chat.rows.MessageText
import me.palmdevs.isocord.chat.rows.Reactions

// Constants.tsx: THUMBNAIL_HEIGHT, THUMBNAIL_MIN_WIDTH, THUMBNAIL_MAX_WIDTH, THUMBNAIL_MARGIN.
private val THUMBNAIL_HEIGHT = 48.dp

private const val THUMBNAIL_MIN_WIDTH = 24f

private const val THUMBNAIL_MAX_WIDTH = 72f

private val THUMBNAIL_MARGIN = 2.dp

private val FOOTER_HORIZONTAL = 16.dp

/** Where the message's text starts; the media strip and the reactions line up with it. */
private val FOOTER_CONTENT_START = FOOTER_HORIZONTAL + AVATAR_SIZE + AVATAR_GAP

// MediaMessagePreview: the message is cut after three lines.
private const val FOOTER_LINES = 3

/**
 * The footer: the playing video's controls, the ALT button, the message (cut after three lines, without its media),
 * a strip of the media and the reactions with the React button, the last two lined up with the message's text.
 */
@Composable
internal fun ViewerFooter(
  message: ChatRow.Message?,
  sources: List<ViewerSource>,
  selected: Int,
  player: MediaState?,
  speed: Float,
  hidden: (Int) -> Boolean,
  onSelect: (Int) -> Unit,
  onAlt: () -> Unit,
  onSpeed: (Float, Float, Float, Float) -> Unit,
  labels: ViewerLabels,
  bottomInset: Dp,
  modifier: Modifier,
) {
  val theme = LocalChatTheme.current
  val fonts = LocalChatFonts.current
  val hasAlt = !sources[selected].description.isNullOrEmpty()
  Column(modifier.fillMaxWidth()) {
    if (hasAlt) {
      // MediaModalOverlayAltText: over the media, at the end, 8dp in.
      BasicText(
        text = labels.alt,
        style = TextStyle(color = Color.White, fontFamily = fonts.sans, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, lineHeight = 16.sp),
        modifier = Modifier
          .align(Alignment.End)
          .padding(8.dp)
          .clip(RoundedCornerShape(4.dp))
          .chatPress(onClick = onAlt)
          .background(theme.overlayButton)
          .padding(horizontal = 8.dp, vertical = 4.dp),
      )
    }
    if (message == null && sources.size < 2 && player == null) return@Column
    Column(
      Modifier
        .fillMaxWidth()
        // A tap on the footer itself does not reach the media below (which would hide the overlay).
        .pointerInput(Unit) { detectTapGestures { } }
        .background(theme.background)
        .padding(top = 8.dp, bottom = 8.dp + bottomInset),
    ) {
      if (player != null) VideoControls(player, speed, onSpeed)
      if (message != null) {
        Row(Modifier.padding(horizontal = FOOTER_HORIZONTAL)) {
          MessageAvatar(message, AVATAR_SIZE)
          Spacer(Modifier.width(AVATAR_GAP))
          Column(Modifier.weight(1f)) {
            Header(message)
            if (message.content.isNotEmpty()) MessageText(message.content, edited = message.edited, maxLines = FOOTER_LINES)
          }
        }
      }
      if (sources.size > 1) Thumbnails(sources, selected, hidden, onSelect)
      if (message != null) {
        Box(Modifier.padding(start = FOOTER_CONTENT_START, end = FOOTER_HORIZONTAL, top = 4.dp)) {
          Reactions(message.id, message.reactions, addReaction = true, addLabel = labels.react)
        }
      }
    }
  }
}

/** The media in a row, lined up with the message's text; the shown one at full strength and kept in view. */
@Composable
private fun Thumbnails(sources: List<ViewerSource>, selected: Int, hidden: (Int) -> Boolean, onSelect: (Int) -> Unit) {
  val theme = LocalChatTheme.current
  val list = rememberLazyListState(initialFirstVisibleItemIndex = selected)
  LaunchedEffect(selected) { list.animateScrollToItem(selected) }
  LazyRow(
    state = list,
    contentPadding = PaddingValues(start = FOOTER_CONTENT_START - THUMBNAIL_MARGIN, end = FOOTER_HORIZONTAL - THUMBNAIL_MARGIN),
    modifier = Modifier.padding(top = 8.dp).height(THUMBNAIL_HEIGHT),
  ) {
    itemsIndexed(sources) { index, source ->
      val aspect = if (source.width > 0 && source.height > 0) source.width.toFloat() / source.height else 1f
      val width = (THUMBNAIL_HEIGHT.value * aspect).coerceIn(THUMBNAIL_MIN_WIDTH, THUMBNAIL_MAX_WIDTH).dp
      Box(
        Modifier
          .padding(horizontal = THUMBNAIL_MARGIN)
          .size(width, THUMBNAIL_HEIGHT)
          .clip(RoundedCornerShape(2.dp))
          // Our own choice: the reference marks the shown one by centring and widening it while scrubbing.
          .alpha(if (index == selected) 1f else 0.5f)
          .chatPress(onClick = { onSelect(index) }),
      ) {
        AsyncImage(
          model = remember(source) { ProxyImage(source.url, source.width, source.height, animated = false) },
          contentDescription = source.description,
          contentScale = ContentScale.Crop,
          modifier = Modifier.fillMaxSize(),
        )
        // MediaViewerThumbnails: a spoiler not yet revealed stays covered in the strip too.
        if (hidden(index)) Box(Modifier.fillMaxSize().background(theme.spoilerBackground))
      }
    }
  }
}

// useOverlayLayoutDriver: the header and footer slide 50dp and fade in over the last quarter of the entrance.
private const val OVERLAY_ENTRANCE_FROM = 0.75f

private val OVERLAY_ENTRANCE_OFFSET = 50.dp

/** The footer slides and fades in over the last quarter of the entrance, and with the overlay's own fade. */
internal fun Modifier.overlayMotion(
  entrance: Animatable<Float, AnimationVector1D>,
  overlay: Animatable<Float, AnimationVector1D>,
): Modifier = graphicsLayer {
  val shown = ((entrance.value - OVERLAY_ENTRANCE_FROM) / (1f - OVERLAY_ENTRANCE_FROM)).coerceIn(0f, 1f)
  alpha = shown * overlay.value
  translationY = (1f - shown) * OVERLAY_ENTRANCE_OFFSET.toPx()
}
