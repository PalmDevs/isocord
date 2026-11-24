package me.palmdevs.isocord.chat.rows

import androidx.annotation.DrawableRes
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.unit.dp
import me.palmdevs.isocord.R
import me.palmdevs.isocord.chat.media.cachedPainter

/** PreviewIcon names (src/features/chat/rows/messagePreview.ts) and their drawables. */
@DrawableRes
internal fun previewIconRes(name: String): Int? = when (name) {
  "image" -> R.drawable.preview_image
  "video" -> R.drawable.preview_video
  "audio" -> R.drawable.preview_audio
  "attachment" -> R.drawable.preview_attachment
  "link" -> R.drawable.preview_link
  "sticker" -> R.drawable.preview_sticker
  "call-active" -> R.drawable.preview_call_active
  "call-ended" -> R.drawable.preview_call_ended
  else -> null
}

/** ChannelRowPreview's PreviewIcon size: messageTypeIconSizeNew "xxs". */
internal val PREVIEW_ICON_SIZE = 12.dp

/** The space between the text and the PreviewIcon. */
internal val PREVIEW_ICON_GAP = 4.dp

/** ChannelRowPreview's PreviewIcon, after the text, in the text colour. */
@Composable
fun PreviewIcon(name: String, color: Color, modifier: Modifier = Modifier) {
  val res = previewIconRes(name) ?: return
  Image(
    painter = cachedPainter(res),
    contentDescription = null,
    colorFilter = ColorFilter.tint(color),
    modifier = modifier.padding(start = PREVIEW_ICON_GAP).size(PREVIEW_ICON_SIZE),
  )
}
