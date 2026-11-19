package me.palmdevs.isocord.chat.rows

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import me.palmdevs.isocord.R
import me.palmdevs.isocord.chat.list.LocalChatFonts
import me.palmdevs.isocord.chat.list.LocalChatTheme
import me.palmdevs.isocord.chat.media.cachedPainter
import me.palmdevs.isocord.notifications.notify.avatarUrl
import me.palmdevs.isocord.notifications.notify.title

/** ChatBeginningRowIcon: a "lg" Mana icon, 24dp, in the icon-strong colour. */
private val ICON_SIZE = 24.dp

/** The drawable of a ChatBeginningRowIcon: the text, thread or forum post (chat bubble) icon. */
internal fun welcomeIcon(name: String?): Int? = when (name) {
  "text" -> R.drawable.mention_text
  "thread" -> R.drawable.mention_thread
  "post" -> R.drawable.mention_message
  else -> null
}

/**
 * The start of a channel's history (ChatBeginningRow): a 64dp icon (the other user's avatar in a DM), title, subtitle.
 * DMs are centred, channels left-aligned. The action buttons all write, so they are left out.
 */
@Composable
fun WelcomeRow(row: ChatRow.Welcome) {
  val theme = LocalChatTheme.current
  val sans = LocalChatFonts.current.sans
  val dm = row.avatarUrl != null
  Column(
    horizontalAlignment = if (dm) Alignment.CenterHorizontally else Alignment.Start,
    modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
  ) {
    if (row.avatarUrl != null) {
      AsyncImage(
        model = row.avatarUrl,
        contentDescription = null,
        contentScale = ContentScale.Crop,
        modifier = Modifier.size(80.dp).clip(CircleShape).background(theme.cardBackground),
      )
    } else {
      Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier.size(64.dp).clip(RoundedCornerShape(16.dp)).background(theme.placeholder),
      ) {
        val icon = welcomeIcon(row.icon)
        if (icon != null) {
          Image(
            painter = cachedPainter(icon),
            contentDescription = null,
            colorFilter = ColorFilter.tint(theme.textStrong),
            modifier = Modifier.size(ICON_SIZE),
          )
        } else {
          BasicText(
            text = row.glyph ?: "#",
            style = TextStyle(
              color = theme.textStrong,
              fontFamily = sans,
              fontWeight = FontWeight.Medium,
              fontSize = 36.sp,
              lineHeight = 40.sp,
            ),
          )
        }
      }
    }
    val align = if (dm) TextAlign.Center else TextAlign.Start
    BasicText(
      text = row.title,
      style = TextStyle(
        color = theme.textStrong,
        fontFamily = sans,
        fontWeight = FontWeight.Bold,
        fontSize = if (dm) 28.sp else 24.sp,
        lineHeight = if (dm) 34.sp else 30.sp,
        textAlign = align,
      ),
      modifier = Modifier.padding(top = 16.dp),
    )
    if (row.handle != null) {
      BasicText(
        text = row.handle,
        style = TextStyle(
          color = theme.textDefault,
          fontFamily = sans,
          fontWeight = FontWeight.Medium,
          fontSize = 20.sp,
          lineHeight = 24.sp,
          textAlign = align,
        ),
      )
    }
    if (row.subtitle != null) {
      BasicText(
        text = row.subtitle,
        style = TextStyle(
          color = theme.textDefault,
          fontFamily = sans,
          fontWeight = FontWeight.Medium,
          fontSize = 16.sp,
          lineHeight = 20.sp,
          textAlign = align,
        ),
        modifier = Modifier.padding(top = 8.dp, bottom = 16.dp),
      )
    } else if (row.tags.isNotEmpty()) {
      FlowRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.padding(top = 8.dp, bottom = 16.dp),
      ) {
        row.tags.forEach { WelcomeTagChip(it) }
      }
    } else {
      Spacer(Modifier.height(16.dp))
    }
  }
}

/** ForumPostAppliedTags' chip (TagGroup size xs): 24dp tall, emoji 14dp, name text-xs/medium. */
@Composable
private fun WelcomeTagChip(tag: WelcomeTag) {
  val theme = LocalChatTheme.current
  Row(
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.spacedBy(4.dp),
    modifier = Modifier
      .heightIn(min = 24.dp)
      .border(1.dp, theme.controlSecondaryBorder, RoundedCornerShape(4.dp))
      .background(theme.controlSecondary, RoundedCornerShape(4.dp))
      .padding(horizontal = 8.dp),
  ) {
    if (tag.emojiUrl != null) {
      AsyncImage(model = tag.emojiUrl, contentDescription = null, modifier = Modifier.size(14.dp))
    }
    BasicText(
      text = tag.name,
      maxLines = 1,
      overflow = TextOverflow.Ellipsis,
      style = TextStyle(
        color = theme.controlSecondaryText,
        fontFamily = LocalChatFonts.current.sans,
        fontWeight = FontWeight.Medium,
        fontSize = 12.sp,
        lineHeight = 16.sp,
      ),
    )
  }
}
