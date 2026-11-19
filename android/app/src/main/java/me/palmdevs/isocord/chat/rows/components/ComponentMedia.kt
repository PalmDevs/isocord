package me.palmdevs.isocord.chat.rows.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.onPlaced
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import me.palmdevs.isocord.chat.chatPress
import me.palmdevs.isocord.chat.list.LocalChatActions
import me.palmdevs.isocord.chat.list.LocalChatTheme
import me.palmdevs.isocord.chat.media.FileAttachment
import me.palmdevs.isocord.chat.media.MediaMosaic
import me.palmdevs.isocord.chat.media.MediaTile
import me.palmdevs.isocord.chat.media.TileSpoilerCover
import me.palmdevs.isocord.chat.media.originOf
import me.palmdevs.isocord.chat.media.proxied
import me.palmdevs.isocord.chat.rows.Attachment
import me.palmdevs.isocord.chat.rows.Component
import me.palmdevs.isocord.chat.rows.LocalComponentsMessage
import me.palmdevs.isocord.chat.rows.Media
import me.palmdevs.isocord.core.LinkKind
import me.palmdevs.isocord.core.Links

/** THUMBNAIL_NORMAL_SIZE: a section's thumbnail. */
private val THUMBNAIL_SIZE = 60.dp
private val THUMBNAIL_SHAPE = RoundedCornerShape(8.dp)

/** Opening a component's media at its window origin, and holding it. */
private class MediaPress(val open: (origin: String) -> Unit, val hold: () -> Unit)

/**
 * Returns the actions of item [item] of component [componentId] (handleMessagesTapImage "component"); null outside
 * a message or without an id.
 */
@Composable
private fun rememberMediaPress(componentId: Int, item: Int): MediaPress? {
  val messageId = LocalComponentsMessage.current
  if (messageId == null || componentId < 0) return null
  val actions = LocalChatActions.current
  val link = "${Links.SCHEME}${LinkKind.COMPONENT_MEDIA}/$messageId/$componentId/$item"
  return MediaPress(
    open = { origin -> actions.onLinkPress("$link?${Links.ORIGIN_PARAM}=$origin") },
    hold = { actions.onMediaLongPress(messageId, link) },
  )
}

/** The poster of a video item, else the image itself. */
private fun Attachment.still() = Media(if (kind == "video") posterUrl ?: url else url, width, height)

/** MediaGalleryDisplayComponentView: the items in the chat's media mosaic, opened in the viewer. */
@Composable
internal fun ComponentGallery(c: Component) {
  val tiles = c.items.mapIndexed { index, item ->
    // Each tile presses itself, as attachment tiles do.
    val press = rememberMediaPress(c.mediaId, index)
    MediaTile(
      media = item.still(),
      videoUrl = if (item.kind == "video") item.url else null,
      spoiler = item.spoiler,
      description = item.description,
      altLabel = item.altLabel,
      onOpen = press?.open,
      onLongPress = press?.hold,
    )
  }
  MediaMosaic(tiles)
}

/** ThumbnailDisplayComponentView: a 60dp square, covered until tapped when a spoiler. */
@Composable
internal fun ComponentThumbnail(c: Component) {
  val item = c.items.firstOrNull() ?: return
  val theme = LocalChatTheme.current
  val press = rememberMediaPress(c.mediaId, 0)
  val placed = remember { arrayOfNulls<LayoutCoordinates>(1) }
  val density = LocalDensity.current.density
  var revealed by remember(item) { mutableStateOf(item.spoiler == null) }
  Box(
    Modifier
      .size(THUMBNAIL_SIZE)
      .clip(THUMBNAIL_SHAPE)
      .background(theme.cardBackground)
      .onPlaced { placed[0] = it }
      .chatPress(
        onClick = { if (revealed) press?.open?.invoke(originOf(placed[0], density)) else revealed = true },
        onLongClick = press?.hold,
      ),
  ) {
    AsyncImage(
      model = item.still().proxied(),
      contentDescription = item.description,
      contentScale = ContentScale.Crop,
      modifier = Modifier.fillMaxSize(),
    )
    if (!revealed) TileSpoilerCover(item.spoiler.orEmpty(), 1f)
  }
}

/** FileDisplayComponentView: the attachment file card. A tap opens the file's link (onLinkClicked). */
@Composable
internal fun ComponentFile(c: Component) {
  val file = c.items.firstOrNull() ?: return
  val actions = LocalChatActions.current
  val messageId = LocalComponentsMessage.current
  FileAttachment(
    file,
    onOpen = { actions.onLinkPress(file.url) },
    onHold = { messageId?.let(actions.onMessageLongPress) },
  )
}
