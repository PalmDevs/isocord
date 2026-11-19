package me.palmdevs.isocord.chat.rows

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
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

/** flagged_message_embed_view.xml: a 32dp avatar before the 44dp text guideline. */
private val FLAGGED_AVATAR_SIZE = 32.dp
private val FLAGGED_TEXT_START = 44.dp

private val CARD_SHAPE = RoundedCornerShape(8.dp)

/**
 * A message from AutoMod (AutomodSystemMessageView, and the incident messages it sends): AutoMod's avatar and
 * author line like a message, the text, the channel, the flagged message's card and the reactions.
 */
@Composable
fun AutomodRow(row: ChatRow.System, automod: Automod) {
  val theme = LocalChatTheme.current
  val fonts = LocalChatFonts.current
  val actions = LocalChatActions.current
  val text = remember(row, theme) { systemText(row.content, theme) { actions.onLinkPress(it) } }
  // The same insets as a message: 16dp above the group, the avatar at 12dp, the text at 64dp.
  Row(
    modifier = Modifier
      .padding(top = 16.dp)
      .fillMaxWidth()
      .chatPress(onLongClick = { actions.onMessageLongPress(row.id) })
      .padding(vertical = 2.dp)
      .padding(start = 12.dp),
  ) {
    AutomodAvatar(Modifier.padding(top = 2.dp))
    Column(Modifier.weight(1f).padding(start = AVATAR_GAP, end = 12.dp)) {
      AutomodHeader(automod, row.timestamp)
      BasicText(
        text = text,
        style = TextStyle(color = theme.textDefault, fontFamily = fonts.sans, fontWeight = FontWeight.Medium, fontSize = 16.sp, lineHeight = 22.sp),
      )
      automod.channel?.let { ChannelChip(it) }
      automod.flagged?.let { FlaggedCard(it, Modifier.padding(top = 12.dp)) }
      if (row.reactions.isNotEmpty()) Reactions(row.id, row.reactions, row.addReaction, modifier = Modifier.padding(top = 8.dp))
    }
  }
}

/** AutoMod's avatar: the reference's auto_moderation_avatar picture, copied from the APK. */
@Composable
private fun AutomodAvatar(modifier: Modifier) {
  Image(
    painter = cachedPainter(R.drawable.system_automod_avatar),
    contentDescription = null,
    modifier = modifier.size(AVATAR_SIZE).clip(CircleShape),
  )
}

/** "AutoMod", the OFFICIAL tag and the time, styled like a message's header (MessageHeader.kt). */
@Composable
private fun AutomodHeader(automod: Automod, timestamp: String) {
  val theme = LocalChatTheme.current
  val fonts = LocalChatFonts.current
  Row(verticalAlignment = Alignment.CenterVertically) {
    BasicText(
      automod.name,
      maxLines = 1,
      style = TextStyle(color = theme.textStrong, fontFamily = fonts.sans, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, lineHeight = 20.sp),
    )
    BasicText(
      automod.badge,
      style = TextStyle(color = theme.botTagText, fontFamily = fonts.sans, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, lineHeight = 16.sp),
      modifier = Modifier
        .padding(start = 4.dp)
        .background(theme.botTagBackground, RoundedCornerShape(4.dp))
        .padding(horizontal = 4.dp, vertical = 1.dp),
    )
    BasicText(
      timestamp,
      maxLines = 1,
      style = TextStyle(color = theme.textMuted, fontFamily = fonts.sans, fontWeight = FontWeight.Medium, fontSize = 12.sp, lineHeight = 15.sp),
      modifier = Modifier.padding(start = 8.dp),
    )
  }
}

/** automod_message_channel: the flagged message's channel, 4dp by 2dp inside a tag. */
@Composable
private fun ChannelChip(channel: String) {
  val theme = LocalChatTheme.current
  BasicText(
    channel,
    maxLines = 1,
    overflow = TextOverflow.Ellipsis,
    style = TextStyle(color = theme.textDefault, fontFamily = LocalChatFonts.current.sans, fontWeight = FontWeight.Medium, fontSize = 14.sp, lineHeight = 18.sp),
    modifier = Modifier
      .padding(top = 4.dp)
      .background(theme.tagBackground, RoundedCornerShape(4.dp))
      .padding(horizontal = 4.dp, vertical = 2.dp),
  )
}

/** The flagged message (FlaggedMessageEmbedView): its author and text, then the keyword and rule. Jumps to it. */
@Composable
private fun FlaggedCard(flagged: FlaggedMessage, modifier: Modifier) {
  val theme = LocalChatTheme.current
  val fonts = LocalChatFonts.current
  val actions = LocalChatActions.current
  Row(
    modifier
      .fillMaxWidth()
      .clip(CARD_SHAPE)
      .background(theme.embedBackground, CARD_SHAPE)
      .chatPress(onClick = { actions.onLinkPress(flagged.url) })
      .padding(12.dp),
  ) {
    AsyncImage(
      model = flagged.avatarUrl,
      contentDescription = null,
      contentScale = ContentScale.Crop,
      modifier = Modifier.size(FLAGGED_AVATAR_SIZE).clip(CircleShape).background(theme.cardBackground),
    )
    Column(Modifier.weight(1f).padding(start = FLAGGED_TEXT_START - FLAGGED_AVATAR_SIZE)) {
      BasicText(
        flagged.authorName,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        style = TextStyle(color = flagged.authorColor ?: theme.textStrong, fontFamily = fonts.sans, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, lineHeight = 20.sp),
      )
      MessageText(flagged.content)
      val footer = listOfNotNull(flagged.keyword, flagged.rule).joinToString(" • ")
      if (footer.isNotEmpty()) {
        BasicText(
          footer,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis,
          style = TextStyle(color = theme.textMuted, fontFamily = fonts.sans, fontSize = 12.sp, lineHeight = 16.sp),
          modifier = Modifier.padding(top = 4.dp),
        )
      }
    }
  }
}
