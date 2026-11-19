package me.palmdevs.isocord.chat.media

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import me.palmdevs.isocord.chat.list.LocalChatActions
import me.palmdevs.isocord.chat.list.LocalChatTheme
import me.palmdevs.isocord.chat.rows.Attachment
import me.palmdevs.isocord.chat.rows.Media
import me.palmdevs.isocord.core.LinkKind
import me.palmdevs.isocord.core.Links

/** Widest card (file, embed) in the chat, as in the reference. */
internal val CARD_MAX_WIDTH = 432.dp

/**
 * The attachments of one message: media in a gallery first, then audio, voice messages and files. A tapped picture
 * reports `isocord://<link>/<messageId>/<index>`: `media`, or `forward-media` for a forward's.
 */
@Composable
fun AttachmentList(messageId: String, attachments: List<Attachment>, link: String = LinkKind.MEDIA) {
  val actions = LocalChatActions.current
  val media = attachments.withIndex().filter { it.value.kind == "image" || it.value.kind == "video" }
  if (media.isNotEmpty()) {
    val tiles = media.map { (index, a) ->
      val video = a.kind == "video"
      MediaTile(
        media = Media(if (video) a.posterUrl.orEmpty() else a.url, a.width, a.height),
        videoUrl = if (video) a.url else null,
        spoiler = a.spoiler,
        description = a.description ?: a.filename,
        altLabel = a.altLabel,
        onOpen = { origin -> actions.onLinkPress("${Links.SCHEME}$link/$messageId/$index?${Links.ORIGIN_PARAM}=$origin") },
        onLongPress = { actions.onMediaLongPress(messageId, "${Links.SCHEME}$link/$messageId/$index") },
      )
    }
    MediaMosaic(tiles)
  }
  // Files and audio report `file/<messageId>/<index>` (or `forward-file`): JS opens or previews a tapped file
  // (onTapAttachmentLink, onTapAttachmentTextPreview) and adds a held one's rows to the long press sheet.
  val fileKind = if (link == LinkKind.FORWARD_MEDIA) LinkKind.FORWARD_FILE else LinkKind.FILE
  attachments.forEachIndexed { index, a ->
    val fileLink = "${Links.SCHEME}$fileKind/$messageId/$index"
    val hold = { actions.onMediaLongPress(messageId, fileLink) }
    when {
      a.kind == "image" || a.kind == "video" -> Unit
      a.kind == "voice" -> VoiceMessage(messageId + a.url, a)
      a.kind == "audio" -> AudioAttachment(messageId + a.url, a, hold)
      else -> FileAttachment(a, onOpen = { actions.onLinkPress(fileLink) }, onHold = hold)
    }
  }
}

@Composable
internal fun cardModifier(): Modifier {
  val theme = LocalChatTheme.current
  val shape = RoundedCornerShape(8.dp)
  return Modifier
    .padding(top = 4.dp)
    .widthIn(max = CARD_MAX_WIDTH)
    .fillMaxWidth()
    .background(theme.cardBackground, shape)
    .border(1.dp, theme.codeBorder, shape)
}
