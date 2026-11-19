package me.palmdevs.isocord.chat.rows

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import me.palmdevs.isocord.chat.chatPress
import me.palmdevs.isocord.chat.list.LocalChatActions
import me.palmdevs.isocord.chat.list.LocalChatFonts
import me.palmdevs.isocord.chat.list.LocalChatTheme

/** ThreadEmbedView: 12dp corners and side padding, 8dp top and bottom, a 1dp subtle border. */
private val CARD_SHAPE = RoundedCornerShape(12.dp)

/**
 * The card under a message a thread was started from (ThreadEmbedView, thread_embed_view.xml): the thread's name
 * and message count, then the newest message's author and text, or a note in italics. Tapping it opens the thread.
 */
@Composable
fun ThreadEmbedCard(thread: ThreadEmbed, modifier: Modifier = Modifier) {
  val theme = LocalChatTheme.current
  val fonts = LocalChatFonts.current
  val actions = LocalChatActions.current
  // Every text of the card is 14sp; the name and count are bold.
  val bold = TextStyle(fontFamily = fonts.sans, fontWeight = FontWeight.Bold, fontSize = 14.sp, lineHeight = 18.sp)
  Column(
    modifier
      .fillMaxWidth()
      .clip(CARD_SHAPE)
      .background(theme.threadEmbedBackground, CARD_SHAPE)
      .border(1.dp, theme.codeBorder, CARD_SHAPE)
      .chatPress(onClick = { actions.onLinkPress(thread.url) })
      .padding(horizontal = 12.dp, vertical = 8.dp),
  ) {
    Row(verticalAlignment = Alignment.CenterVertically) {
      BasicText(
        thread.name,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        style = bold.copy(color = theme.headingPrimary),
        modifier = Modifier.weight(1f),
      )
      BasicText(
        thread.countLabel,
        maxLines = 1,
        style = bold.copy(color = theme.textLink),
        modifier = Modifier.padding(start = 12.dp, end = 4.dp),
      )
    }
    ThreadPreview(thread, bold, Modifier.padding(top = 4.dp))
  }
}

/** The newest message: an 18dp avatar and the author's name before up to two lines of its text. */
@Composable
private fun ThreadPreview(thread: ThreadEmbed, bold: TextStyle, modifier: Modifier) {
  val theme = LocalChatTheme.current
  // The message text is medium, a note normal italic (setMessage's italicizeMessage).
  val style = bold.copy(
    color = theme.textDefault,
    fontWeight = if (thread.note) FontWeight.Normal else FontWeight.Medium,
    fontStyle = if (thread.note) FontStyle.Italic else FontStyle.Normal,
  )
  val prefix = remember(thread, theme) {
    thread.authorName?.let { name ->
      buildAnnotatedString {
        withStyle(SpanStyle(color = thread.authorColor ?: theme.textDefault, fontWeight = FontWeight.Bold, fontStyle = FontStyle.Normal)) {
          append(name)
        }
        append(" ")
      }
    }
  }
  Row(modifier) {
    thread.authorAvatarUrl?.let { url ->
      AsyncImage(
        model = url,
        contentDescription = null,
        contentScale = ContentScale.Crop,
        modifier = Modifier.size(18.dp).clip(CircleShape).background(theme.cardBackground),
      )
      Spacer(Modifier.size(4.dp))
    }
    Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
      SpanText(thread.preview, style, maxLines = 2, prefix = prefix, modifier = Modifier.weight(1f, fill = false))
      thread.trailingIcon?.let { PreviewIcon(it, theme.textDefault) }
    }
  }
}
