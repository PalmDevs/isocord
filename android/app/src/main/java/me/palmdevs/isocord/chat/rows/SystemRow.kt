package me.palmdevs.isocord.chat.rows

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withLink
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import me.palmdevs.isocord.R
import me.palmdevs.isocord.chat.chatPress
import me.palmdevs.isocord.chat.list.LocalChatActions
import me.palmdevs.isocord.chat.list.LocalChatFonts
import me.palmdevs.isocord.chat.list.LocalChatTheme
import me.palmdevs.isocord.chat.media.cachedPainter

private val ICON_SIZE = 16.dp

/**
 * A system message (SystemMessageView): the type's icon in the avatar column, the text with its links, the time,
 * the "Wave to say hi!" button under a join, and the reactions. Text starts at 64dp like ordinary messages.
 */
@Composable
fun SystemRow(row: ChatRow.System) {
  // CALL and AutoMod messages have views of their own in the reference.
  row.call?.let { return CallRow(row, it) }
  row.automod?.let { return AutomodRow(row, it) }
  IconSystemRow(row)
}

/** The icon, the text and its accessories (SystemMessageView). */
@Composable
private fun IconSystemRow(row: ChatRow.System) {
  val theme = LocalChatTheme.current
  val fonts = LocalChatFonts.current
  val actions = LocalChatActions.current
  val text = remember(row, theme) { systemText(row.content, theme) { actions.onLinkPress(it) } }

  Row(
    modifier = Modifier
      .padding(top = 16.dp)
      .fillMaxWidth()
      .chatPress(onLongClick = { actions.onMessageLongPress(row.id) })
      .padding(vertical = 2.dp),
  ) {
    // 12dp edge inset + (40dp avatar - 16dp icon) / 2, so the icon is centred under the avatars; text starts at 64dp.
    Box(Modifier.padding(start = 24.dp, top = 2.dp).width(ICON_SIZE).height(20.dp), contentAlignment = Alignment.Center) {
      systemIcon(row.icon)?.let { icon ->
        Image(
          painter = cachedPainter(icon),
          contentDescription = null,
          colorFilter = ColorFilter.tint(systemTint(row.tint, theme)),
          modifier = Modifier.size(ICON_SIZE),
        )
      }
    }
    Column(Modifier.weight(1f).padding(start = 24.dp, end = 12.dp)) {
      // MessageContentAccessory: PrimaryNormal 16, text-default.
      BasicText(
        text = text,
        style = TextStyle(color = theme.textDefault, fontFamily = fonts.sans, fontSize = 16.sp, lineHeight = 20.sp),
      )
      // TimestampMessageAccessory: PrimaryMedium, text-muted.
      BasicText(
        text = row.timestamp,
        maxLines = 1,
        style = TextStyle(
          color = theme.textMuted,
          fontFamily = fonts.sans,
          fontWeight = FontWeight.Medium,
          fontSize = 12.sp,
          lineHeight = 16.sp,
        ),
      )
      if (row.waveLabel != null && row.waveUrl != null) WaveButton(row.waveLabel, row.waveUrl)
      if (row.reactions.isNotEmpty()) Reactions(row.id, row.reactions, row.addReaction, modifier = Modifier.padding(top = 8.dp))
      // ThreadEmbedMessageAccessory: after the reactions.
      row.thread?.let { ThreadEmbedCard(it, Modifier.padding(top = 8.dp)) }
    }
  }
}

/** The "Wave to say hi!" sticker reply under a join message. */
@Composable
private fun WaveButton(label: String, url: String) {
  val theme = LocalChatTheme.current
  val actions = LocalChatActions.current
  val shape = RoundedCornerShape(8.dp)
  BasicText(
    text = label,
    maxLines = 1,
    style = TextStyle(
      color = theme.textDefault,
      fontFamily = LocalChatFonts.current.sans,
      fontWeight = FontWeight.SemiBold,
      fontSize = 14.sp,
      lineHeight = 18.sp,
    ),
    modifier = Modifier
      .padding(top = 8.dp)
      .clip(shape)
      .background(theme.cardBackground, shape)
      .border(1.dp, theme.codeBorder, shape)
      .chatPress(onClick = { actions.onLinkPress(url) })
      .padding(horizontal = 12.dp, vertical = 7.dp),
  )
}

/** The text of a system message: links medium in their colour (formatUsernameOnClick's `medium`), `$b` parts bold. */
internal fun systemText(spans: List<Span>, theme: ChatTheme, onLink: (String) -> Unit): AnnotatedString = buildAnnotatedString {
  spans.forEach { span ->
    val weight = if (span.bold) FontWeight.Bold else if (span.link != null) FontWeight.Medium else null
    val style = SpanStyle(color = span.color ?: Color.Unspecified, fontWeight = weight)
    val url = span.link
    if (url != null) {
      val linkStyle = style.copy(color = span.color ?: theme.textDefault)
      withLink(LinkAnnotation.Clickable(url, TextLinkStyles(linkStyle)) { onLink(url) }) { append(span.text) }
    } else {
      withStyle(style) { append(span.text) }
    }
  }
}

/** The drawable of a SystemMessageView icon (ReactAsset), by the row's icon key. */
private fun systemIcon(name: String): Int? = when (name) {
  "arrowRight" -> R.drawable.system_arrow_right
  "arrowLeft" -> R.drawable.system_arrow_left
  "pencil" -> R.drawable.system_pencil
  "reaction" -> R.drawable.system_reaction
  "pin" -> R.drawable.system_pin
  "ticket" -> R.drawable.system_ticket
  "boost" -> R.drawable.system_boost
  "announcements" -> R.drawable.system_announcements
  "x" -> R.drawable.system_x
  "checkmark" -> R.drawable.system_checkmark
  "circleError" -> R.drawable.system_circle_error
  "thread" -> R.drawable.system_thread
  "stage" -> R.drawable.system_stage
  "microphoneArrowRight" -> R.drawable.system_microphone_arrow_right
  "handRequestSpeak" -> R.drawable.system_hand_request_speak
  "lock" -> R.drawable.system_lock
  "lockUnlocked" -> R.drawable.system_lock_unlocked
  "polls" -> R.drawable.system_polls
  "refresh" -> R.drawable.system_refresh
  "gameController" -> R.drawable.system_game_controller
  "voice" -> R.drawable.system_voice
  "userCheck" -> R.drawable.system_user_check
  else -> null
}

/** SystemMessageView's icon colours, by the row's tint key. */
private fun systemTint(name: String, theme: ChatTheme): Color = when (name) {
  "positive" -> theme.systemIconPositive
  "danger" -> theme.systemIconDanger
  "warning" -> theme.systemIconWarning
  "boost" -> theme.systemIconBoost
  "muted" -> theme.textMuted
  else -> theme.systemIconNormal
}
