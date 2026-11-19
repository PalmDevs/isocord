package me.palmdevs.isocord.chat.rows

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import kotlinx.serialization.Serializable
import kotlinx.serialization.Transient
import me.palmdevs.isocord.R
import me.palmdevs.isocord.chat.chatPress
import me.palmdevs.isocord.chat.list.LocalChatActions
import me.palmdevs.isocord.chat.list.LocalChatFonts
import me.palmdevs.isocord.chat.list.LocalChatTheme
import me.palmdevs.isocord.chat.media.AttachmentList
import me.palmdevs.isocord.chat.media.cachedPainter
import me.palmdevs.isocord.core.LinkKind

@androidx.compose.runtime.Immutable
@Serializable
data class Forward(
  /** The forwarding message, whose actions a hold on the footer opens. Set from the message, not sent. */
  @Transient val messageId: String = "",
  val label: String = "",
  val content: List<Span> = emptyList(),
  val attachments: List<Attachment> = emptyList(),
  val embeds: List<Embed> = emptyList(),
  /** getForwardInfo footerInfo.originLabel: "#channel", or the server's name for another server. No footer without it. */
  val origin: String? = null,
  /** footerInfo.originIconUrl: the server's icon when the source is in another server. */
  val originIconUrl: String? = null,
  /** footerInfo.timestampLabel. */
  val timestamp: String? = null,
  /** footerInfo.accessibilityLabel: "Message originally sent in {origin} at {timestamp}". */
  val accessibilityLabel: String? = null,
  /** isocord://forward/<guild|@me>/<channel>/<message>, reported through onLinkPress when the footer is tapped. */
  val url: String? = null,
)

/** The read-only rich parts of a message: poll, components, forward, interaction header, ephemeral footer. */
@androidx.compose.runtime.Immutable
data class Rich(
  val poll: Poll?,
  val components: List<Component>,
  val forward: Forward?,
  val interaction: String?,
  val ephemeral: String?,
)

/** Groups a message's rich parts; null when it has none. */
internal fun richOf(m: ChatRow.Message): Rich? {
  if (m.poll == null && m.components.isEmpty() && m.forward == null && m.interaction == null && m.ephemeral == null) {
    return null
  }
  val forward = m.forward?.let {
    it.copy(
      messageId = m.id,
      origin = it.origin?.ifEmpty { null },
      originIconUrl = it.originIconUrl?.ifEmpty { null },
      timestamp = it.timestamp?.ifEmpty { null },
    )
  }
  return Rich(m.poll, m.components, forward, m.interaction, m.ephemeral)
}

/** "<user> used /command" above the message. */
@Composable
fun InteractionHeader(text: String) {
  val theme = LocalChatTheme.current
  BasicText(
    text,
    maxLines = 1,
    style = TextStyle(color = theme.textMuted, fontFamily = LocalChatFonts.current.sans, fontSize = 14.sp, lineHeight = 18.sp),
    modifier = Modifier.padding(bottom = 2.dp),
  )
}

/** "Only you can see this". */
@Composable
fun EphemeralFooter(text: String) {
  val theme = LocalChatTheme.current
  BasicText(
    text,
    style = TextStyle(color = theme.textMuted, fontFamily = LocalChatFonts.current.sans, fontSize = 12.sp, lineHeight = 16.sp),
    modifier = Modifier.padding(top = 4.dp),
  )
}

// MessageAccessoriesView (forward mode): a 4dp bar with 2dp round corners runs down the forwarded content, which
// starts 16dp after it (MessageMargins: the bar's width plus 16dp); the parts are 8dp apart
// (message_accessories_vertical_spacing).
private val FORWARD_BAR_WIDTH = 4.dp
private val FORWARD_CONTENT_START = 20.dp
private val FORWARD_SPACING = 8.dp

@Composable
fun ForwardView(forward: Forward) {
  val theme = LocalChatTheme.current
  val fonts = LocalChatFonts.current
  val muted = TextStyle(color = theme.textMuted, fontFamily = fonts.sans, fontSize = 12.sp, lineHeight = 16.sp)
  Column(
    Modifier
      .padding(top = 4.dp)
      .fillMaxWidth()
      .drawBehind {
        val width = FORWARD_BAR_WIDTH.toPx()
        drawRoundRect(theme.spine, size = Size(width, size.height), cornerRadius = CornerRadius(width / 2))
      }
      .padding(start = FORWARD_CONTENT_START),
  ) {
    // forward_header_view: a 16dp icon (ArrowAngleRightUpIcon), then the 14sp label 4dp after it, on one line.
    Row(verticalAlignment = Alignment.CenterVertically) {
      Image(
        painter = cachedPainter(R.drawable.ic_forward),
        contentDescription = null,
        colorFilter = ColorFilter.tint(theme.textMuted),
        modifier = Modifier.size(16.dp),
      )
      BasicText(
        forward.label,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        style = muted.copy(fontSize = 14.sp, lineHeight = 18.sp, fontStyle = FontStyle.Italic, fontWeight = FontWeight.Medium),
        modifier = Modifier.padding(start = 4.dp),
      )
    }
    MessageText(forward.content)
    // The chat's own gallery, players and file cards; taps open the snapshot's media (`forward-media` links).
    AttachmentList(forward.messageId, forward.attachments, link = LinkKind.FORWARD_MEDIA)
    forward.embeds.forEachIndexed { index, embed ->
      EmbedView(embed, forward.messageId, index, link = LinkKind.FORWARD_EMBED_MEDIA)
    }
    forward.origin?.let { ForwardBreadcrumb(forward, it) }
  }
}

/**
 * The footer under forwarded content (forward_breadcrumb_view): origin, dot, time, chevron.
 * All 14sp text-muted, 4dp apart, origin medium, 1dp above and below.
 * A tap opens the source message (handleForwardBreadcrumb), a hold the forwarding message's actions.
 */
@Composable
private fun ForwardBreadcrumb(forward: Forward, origin: String) {
  val theme = LocalChatTheme.current
  val actions = LocalChatActions.current
  val style = TextStyle(color = theme.textMuted, fontFamily = LocalChatFonts.current.sans, fontSize = 14.sp, lineHeight = 18.sp)
  val url = forward.url
  Row(
    verticalAlignment = Alignment.CenterVertically,
    modifier = Modifier
      .padding(top = FORWARD_SPACING)
      .clip(RoundedCornerShape(4.dp))
      .chatPress(
        onClick = url?.let { link -> { actions.onLinkPress(link) } },
        onLongClick = { actions.onMessageLongPress(forward.messageId) },
      )
      .then(forward.accessibilityLabel?.let { label -> Modifier.semantics(mergeDescendants = true) { contentDescription = label } } ?: Modifier)
      .padding(vertical = 1.dp),
  ) {
    forward.originIconUrl?.let {
      // The server's icon, 16dp with 4dp corners.
      AsyncImage(model = it, contentDescription = null, modifier = Modifier.size(16.dp).clip(RoundedCornerShape(4.dp)))
      Spacer(Modifier.width(4.dp))
    }
    BasicText(
      origin,
      maxLines = 1,
      overflow = TextOverflow.Ellipsis,
      style = style.copy(fontWeight = FontWeight.Medium),
      modifier = Modifier.weight(1f, fill = false),
    )
    forward.timestamp?.let {
      Spacer(Modifier.width(4.dp))
      BasicText("•", maxLines = 1, style = style)
      Spacer(Modifier.width(4.dp))
      BasicText(it, maxLines = 1, overflow = TextOverflow.Ellipsis, style = style, modifier = Modifier.weight(1f, fill = false))
    }
    if (url != null) {
      Spacer(Modifier.width(4.dp))
      ChevronSmallRight(theme.textMuted)
    }
  }
}

// ChevronSmallRightIcon (24 viewport), drawn 12dp as the breadcrumb's arrow.
private val CHEVRON_PATH = PathParser().parsePathString(
  "M9.3 5.3a1 1 0 0 0 0 1.4l5.29 5.3-5.3 5.3a1 1 0 1 0 1.42 1.4l6-6a1 1 0 0 0 0-1.4l-6-6a1 1 0 0 0-1.42 0Z",
).toPath()

@Composable
private fun ChevronSmallRight(color: Color) {
  Canvas(Modifier.size(12.dp)) {
    scale(size.width / 24f, pivot = Offset.Zero) { drawPath(CHEVRON_PATH, color) }
  }
}

/** Forwarded content and the poll, drawn under the message text. Components come after the embeds. */
@Composable
fun RichParts(rich: Rich) {
  rich.forward?.let { ForwardView(it) }
  rich.poll?.let { PollView(it) }
}
