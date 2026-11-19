package me.palmdevs.isocord.chat.rows

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import me.palmdevs.isocord.R
import me.palmdevs.isocord.chat.chatPress
import me.palmdevs.isocord.chat.list.LocalChatActions
import me.palmdevs.isocord.chat.list.LocalChatFonts
import me.palmdevs.isocord.chat.list.LocalChatTheme
import me.palmdevs.isocord.chat.media.cachedPainter

/*
 * The line above a reply or interaction response (message_view_reply_preview.xml, ChannelSpineView).
 * 16dp content line with 12sp text, 4dp below it.
 * A 2dp round-capped spine rises from the avatar's centre, turns through a small arc, and ends 4dp before the content column.
 */

/** Height of the whole preview: the 16dp content line plus 4dp padding and 4dp margin. */
val REPLY_PREVIEW_HEIGHT = 24.dp
private val CONTENT_HEIGHT = 16.dp
private val SPINE_WIDTH = 2.dp
/** The spine stops this far above the avatar. */
private val SPINE_END = 22.dp

/**
 * The preview above a message: a reply, or the "<user> used /command" line of an interaction response.
 * Its presses are its own: no ripple, and a long press does nothing instead of reaching the message.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun MessageTop(row: ChatRow.Message, avatarCenter: Dp, contentStart: Dp) {
  val reply = row.reply
  val command = row.executedCommand
  if (reply == null && command == null) return
  val actions = LocalChatActions.current
  val url = reply?.url
  // A tap jumps to the replied-to message; holding does nothing, and keeps the message's long press quiet.
  Box(
    Modifier
      .fillMaxWidth()
      .height(REPLY_PREVIEW_HEIGHT)
      .then(
        if (url == null) Modifier
        else Modifier.chatPress(
          onClick = { actions.onLinkPress(url) },
          onLongClick = {},
          indication = null,
        ),
      ),
  ) {
    Spine(avatarCenter, contentStart)
    Row(
      verticalAlignment = Alignment.CenterVertically,
      modifier = Modifier.padding(start = contentStart, end = 16.dp).height(CONTENT_HEIGHT),
    ) {
      if (reply != null) ReplyContent(reply) else if (command != null) ExecutedCommandLine(command, row.id)
    }
  }
}

@Composable
private fun Spine(avatarCenter: Dp, contentStart: Dp) {
  val color = LocalChatTheme.current.spine
  // The path is built once per size, not on every frame the row is drawn.
  Spacer(Modifier.fillMaxSize().drawWithCache {
    val stroke = Stroke(width = SPINE_WIDTH.toPx(), cap = StrokeCap.Round)
    val x = avatarCenter.toPx()
    // The horizontal run ends 4dp before the content, where the leading views start.
    val endX = contentStart.toPx() - 4.dp.toPx()
    val y = CONTENT_HEIGHT.toPx() / 2
    // ChannelSpineView: the arc is a quarter of a circle whose diameter is a quarter of the spine view's width.
    val radius = (endX - x) / 8
    val path = Path().apply {
      moveTo(x, SPINE_END.toPx())
      lineTo(x, y + radius)
      arcTo(Rect(x, y, x + 2 * radius, y + 2 * radius), 180f, 90f, false)
      lineTo(endX, y)
    }
    onDrawBehind { drawPath(path, color, style = stroke) }
  })
}

@Composable
private fun RowScope.ReplyContent(reply: Reply) {
  val theme = LocalChatTheme.current
  val fonts = LocalChatFonts.current
  val textStyle = TextStyle(
    color = theme.textMuted,
    fontFamily = fonts.sans,
    fontWeight = FontWeight.Medium,
    fontSize = 12.sp,
    lineHeight = 16.sp,
  )
  if (!reply.note) {
    if (reply.authorAvatarUrl != null) {
      AsyncImage(
        model = reply.authorAvatarUrl,
        contentDescription = null,
        contentScale = ContentScale.Crop,
        modifier = Modifier.size(16.dp).clip(CircleShape).background(theme.cardBackground),
      )
      Spacer(Modifier.size(4.dp))
    }
    // The name may take at most 40% of the screen width.
    val maxName = (LocalConfiguration.current.screenWidthDp * 0.4f).dp
    BasicText(
      text = (if (reply.mention) "@" else "") + reply.authorName,
      maxLines = 1,
      overflow = TextOverflow.Ellipsis,
      style = nameStyle(
        textStyle.copy(fontWeight = FontWeight.SemiBold),
        reply.authorColor,
        reply.authorColors,
        theme.textDefault,
      ),
      modifier = Modifier.widthIn(max = maxName),
    )
    reply.clanTag?.let {
      Spacer(Modifier.size(4.dp))
      ClanTagChip(it, scale = 0.89f)
    }
    Spacer(Modifier.size(4.dp))
  }
  if (reply.attachment) {
    ImageIcon(theme.textMuted)
    Spacer(Modifier.size(4.dp))
  }
  if (reply.spans.isNotEmpty()) {
    // Mentions, emoji and the rest of the inline markup, on one line. Links and spoilers are only styled: a tap
    // anywhere on the preview jumps to the replied-to message.
    SpanText(reply.spans, textStyle, maxLines = 1, modifier = Modifier.weight(1f, fill = false))
    return
  }
  BasicText(
    text = reply.text,
    maxLines = 1,
    overflow = TextOverflow.Ellipsis,
    style = if (reply.note || reply.attachment) textStyle.copy(fontStyle = FontStyle.Italic) else textStyle,
    modifier = Modifier.weight(1f, fill = false),
  )
}

/** Mana's ImageIcon, shown in front of replies to attachment-only messages. */
@Composable
private fun ImageIcon(color: Color) {
  Image(
    painter = cachedPainter(R.drawable.ic_image),
    contentDescription = null,
    colorFilter = ColorFilter.tint(color),
    modifier = Modifier.size(16.dp),
  )
}
