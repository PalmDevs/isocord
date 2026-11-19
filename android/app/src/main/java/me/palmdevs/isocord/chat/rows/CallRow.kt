package me.palmdevs.isocord.chat.rows

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import me.palmdevs.isocord.R
import me.palmdevs.isocord.chat.chatPress
import me.palmdevs.isocord.chat.list.LocalChatActions
import me.palmdevs.isocord.chat.list.LocalChatFonts
import me.palmdevs.isocord.chat.list.LocalChatTheme
import me.palmdevs.isocord.chat.media.cachedPainter

/** addSystemMessageCardStyle: 8dp corners. */
private val CALL_CARD_SHAPE = RoundedCornerShape(8.dp)

/** call_system_message_view.xml: the 24dp icon centred before the 64dp text guideline, 24dp participant circles. */
private val CALL_ICON_SIZE = 24.dp
private val CALL_ICON_COLUMN = 64.dp
private val PARTICIPANT_SIZE = 24.dp

/** OverlappingCirclesView: each circle covers this much of the one before it. */
private val PARTICIPANT_OVERLAP = 8.dp

/**
 * A DM call (CallSystemMessageView): the phone icon, the title (the row's content) and when and how long, and the
 * avatars on the end, on the embed background. Tapping joins the call in the reference; the app has no calls, so
 * only the long press does something.
 */
@Composable
fun CallRow(row: ChatRow.System, call: CallCard) {
  val theme = LocalChatTheme.current
  val fonts = LocalChatFonts.current
  val actions = LocalChatActions.current
  val tint = when {
    call.active -> theme.callConnected
    call.missed -> theme.callDisconnected
    else -> theme.systemIconNormal
  }
  Row(
    verticalAlignment = Alignment.CenterVertically,
    modifier = Modifier
      // The system rows' 16dp above, and the message gutters on the sides.
      .padding(start = 12.dp, end = 12.dp, top = 16.dp)
      .fillMaxWidth()
      .clip(CALL_CARD_SHAPE)
      .background(theme.embedBackground, CALL_CARD_SHAPE)
      .chatPress(onLongClick = { actions.onMessageLongPress(row.id) })
      .padding(vertical = 8.dp),
  ) {
    Box(Modifier.width(CALL_ICON_COLUMN), contentAlignment = Alignment.Center) {
      Image(
        painter = cachedPainter(if (call.missed) R.drawable.system_phone_hang_up else R.drawable.system_phone_call),
        contentDescription = null,
        colorFilter = ColorFilter.tint(tint),
        modifier = Modifier.size(CALL_ICON_SIZE),
      )
    }
    Column(Modifier.weight(1f)) {
      BasicText(
        row.content.joinToString("") { it.text },
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        style = TextStyle(color = theme.headingPrimary, fontFamily = fonts.sans, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, lineHeight = 20.sp),
      )
      call.description?.let {
        BasicText(
          it,
          maxLines = 1,
          style = TextStyle(color = theme.textMuted, fontFamily = fonts.sans, fontSize = 12.sp, lineHeight = 16.sp),
        )
      }
    }
    Participants(call.avatarUrls, Modifier.padding(start = 8.dp, end = 12.dp))
  }
}

/** OverlappingCirclesView: the avatars side by side, each over the last, ringed in the card colour. */
@Composable
private fun Participants(urls: List<String>, modifier: Modifier) {
  val theme = LocalChatTheme.current
  if (urls.isEmpty()) return
  val step = PARTICIPANT_SIZE - PARTICIPANT_OVERLAP
  Box(modifier.width(PARTICIPANT_SIZE + step * (urls.size - 1))) {
    urls.forEachIndexed { index, url ->
      AsyncImage(
        model = url,
        contentDescription = null,
        contentScale = ContentScale.Crop,
        modifier = Modifier
          .offset(x = step * index)
          .size(PARTICIPANT_SIZE)
          .clip(CircleShape)
          .background(theme.cardBackground)
          .border(2.dp, theme.embedBackground, CircleShape),
      )
    }
  }
}
