package me.palmdevs.isocord.chat.rows

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
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
import me.palmdevs.isocord.core.LinkKind
import me.palmdevs.isocord.core.Links
import me.palmdevs.isocord.notifications.notify.avatarUrl

/*
 * The author line and the avatar, sized from the official message_view.xml.
 * Name 16/20 semibold, timestamp 12/15 medium, 4dp name to chips, 8dp before the timestamp.
 * Role icon 18dp, avatar decoration 48dp around the 40dp avatar.
 */

private val NAME_STYLE_SIZE = 16.sp
private val NAME_STYLE_LINE = 20.sp

/** The text style of a username: a gradient brush when the role has enhanced colours, else the flat colour. */
fun nameStyle(base: TextStyle, color: Color?, colors: List<Color>, fallback: Color): TextStyle =
  if (colors.size >= 2) base.copy(brush = Brush.horizontalGradient(colors)) else base.copy(color = color ?: fallback)

/** The server tag chip (ClanTagChipletView): 18dp tall at scale 1, 4dp radius, badge and text 12 at scale 1. */
@Composable
fun ClanTagChip(tag: ClanTag, scale: Float = 1f, modifier: Modifier = Modifier) {
  val theme = LocalChatTheme.current
  val fonts = LocalChatFonts.current
  Row(
    verticalAlignment = Alignment.CenterVertically,
    modifier = modifier
      .height((18 * scale).dp)
      .background(theme.tagBackground, RoundedCornerShape(4.dp))
      .padding(horizontal = (4 * scale).dp),
  ) {
    if (tag.badgeUrl != null) {
      AsyncImage(
        model = tag.badgeUrl,
        contentDescription = null,
        modifier = Modifier.size((12 * scale).dp),
      )
      Spacer(Modifier.width(2.dp))
    }
    BasicText(
      text = tag.tag,
      maxLines = 1,
      overflow = TextOverflow.Ellipsis,
      style = TextStyle(
        color = theme.textDefault,
        fontFamily = fonts.sans,
        fontWeight = FontWeight.SemiBold,
        fontSize = (12 * scale).sp,
        lineHeight = (14 * scale).sp,
      ),
    )
  }
}

@Composable
private fun RoleIconView(icon: RoleIcon, modifier: Modifier = Modifier) {
  if (icon.url != null) {
    AsyncImage(model = icon.url, contentDescription = null, modifier = modifier.size(18.dp))
  } else if (icon.emoji != null) {
    BasicText(text = icon.emoji, style = TextStyle(fontSize = 14.sp, lineHeight = 18.sp), modifier = modifier)
  }
}

/** MessageTagView: 12sp semibold, 4dp side padding, 1dp above and below the text. */
@Composable
private fun MessageTag(text: String, color: Color, background: Color) {
  BasicText(
    text = text,
    style = TextStyle(
      color = color,
      fontFamily = LocalChatFonts.current.sans,
      fontWeight = FontWeight.SemiBold,
      fontSize = 12.sp,
      lineHeight = 16.sp,
    ),
    modifier = Modifier
      .padding(start = 4.dp)
      // Takes its taps without acting, so they never reach the reply preview drawn under the header.
      .chatPress(onClick = {}, indication = null)
      .background(background, RoundedCornerShape(4.dp))
      .padding(horizontal = 4.dp, vertical = 1.dp),
  )
}

@Composable
fun Header(row: ChatRow.Message) {
  val actions = LocalChatActions.current
  val press = { part: String -> actions.onLinkPress("${Links.SCHEME}${LinkKind.AUTHOR}/${row.id}/$part") }
  val theme = LocalChatTheme.current
  val fonts = LocalChatFonts.current
  Row(verticalAlignment = Alignment.CenterVertically) {
    BasicText(
      text = row.authorName,
      maxLines = 1,
      overflow = TextOverflow.Ellipsis,
      style = nameStyle(
        TextStyle(
          fontFamily = fonts.sans,
          fontWeight = FontWeight.SemiBold,
          fontSize = NAME_STYLE_SIZE,
          lineHeight = NAME_STYLE_LINE,
        ),
        row.authorColor,
        row.authorColors,
        theme.textStrong,
      ),
      modifier = Modifier.weight(1f, fill = false).alignByBaseline().chatPress(
        onClick = { press("name") },
        // handleLongPressUsername: holding the name opens the profile (heldPart.ts).
        onLongClick = { actions.onMediaLongPress(row.id, "${Links.SCHEME}${LinkKind.AUTHOR}/${row.id}/name") },
      ),
    )
    row.clanTag?.let { ClanTagChip(it, modifier = Modifier.padding(start = 4.dp).chatPress(onClick = { press("guild-tag") })) }
    row.roleIcon?.let { RoleIconView(it, Modifier.padding(start = 4.dp).chatPress(onClick = { press("role-icon") })) }
    if (row.bot) MessageTag("APP", theme.botTagText, theme.botTagBackground)
    row.originalPoster?.let { MessageTag(it, theme.opTagText, theme.opTagBackground) }
    BasicText(
      text = row.timestamp,
      maxLines = 1,
      style = TextStyle(
        color = theme.textMuted,
        fontFamily = fonts.sans,
        fontWeight = FontWeight.Medium,
        fontSize = 12.sp,
        lineHeight = 15.sp,
      ),
      modifier = Modifier.padding(start = 8.dp).alignByBaseline(),
    )
    row.silent?.let { label ->
      // suppress_notifications_icon (message_view.xml): 16dp, 4dp after the timestamp, in the muted colour.
      // Tap: handleTapSuppressNotificationsIcon.
      Image(
        painter = cachedPainter(R.drawable.header_silent),
        contentDescription = label,
        colorFilter = ColorFilter.tint(theme.textMuted),
        modifier = Modifier.padding(start = 4.dp).size(16.dp).chatPress(onClick = { press("silent") }),
      )
    }
  }
}

/** The avatar with its decoration ring. The ring is 1.2x the avatar, centred on it. */
@Composable
fun MessageAvatar(row: ChatRow.Message, size: Dp, modifier: Modifier = Modifier) {
  val theme = LocalChatTheme.current
  val actions = LocalChatActions.current
  Box(modifier.size(size).clip(CircleShape).chatPress(onClick = { actions.onLinkPress("${Links.SCHEME}${LinkKind.AUTHOR}/${row.id}/avatar") })) {
    AsyncImage(
      model = row.avatarUrl,
      contentDescription = null,
      contentScale = ContentScale.Crop,
      modifier = Modifier
        .size(size)
        .clip(CircleShape)
        .background(theme.cardBackground),
    )
    if (row.avatarDecorationUrl != null) {
      AsyncImage(
        model = row.avatarDecorationUrl,
        contentDescription = null,
        modifier = Modifier.wrapContentSize(Alignment.Center, unbounded = true).size(size * 1.2f),
      )
    }
  }
}
