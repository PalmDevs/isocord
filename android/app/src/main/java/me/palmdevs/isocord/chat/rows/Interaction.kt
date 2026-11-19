@file:UseSerializers(ArgbColorSerializer::class)

package me.palmdevs.isocord.chat.rows

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import kotlinx.serialization.Serializable
import kotlinx.serialization.UseSerializers
import me.palmdevs.isocord.R
import me.palmdevs.isocord.chat.chatPress
import me.palmdevs.isocord.chat.list.LocalChatActions
import me.palmdevs.isocord.chat.list.LocalChatFonts
import me.palmdevs.isocord.chat.list.LocalChatTheme
import me.palmdevs.isocord.chat.media.cachedPainter

/** A piece of the executed command line: the user's name, the command, or the text around them. */
@Immutable
@Serializable
data class CommandPart(val text: String = "", val role: String? = null)

/** createExecutedCommand: who ran the command, drawn above its response like a reply's author. */
@Immutable
@Serializable
data class ExecutedCommand(
  val avatarUrl: String? = null,
  val authorColor: Color? = null,
  val authorColors: List<Color> = emptyList(),
  /** The user's profile: a tap on the avatar or name. */
  val userUrl: String? = null,
  val parts: List<CommandPart> = emptyList(),
)

/** A piece of the ephemeral line; [url] makes it a link. */
@Immutable
@Serializable
data class EphemeralPart(val text: String = "", val url: String? = null)

@Immutable
@Serializable
data class EphemeralIndication(val parts: List<EphemeralPart> = emptyList())

private const val NAME_ROLE = "name"
private const val COMMAND_ROLE = "command"

/**
 * The executed command line (createExecutedCommand): the 16dp avatar, the name in its role colour, the command on
 * a mention pill (commandNameBackgroundStyles: MENTION_BACKGROUND, 4dp corners), the rest muted. 12sp, one line.
 */
@Composable
internal fun RowScope.ExecutedCommandLine(command: ExecutedCommand, messageId: String) {
  val theme = LocalChatTheme.current
  val fonts = LocalChatFonts.current
  val actions = LocalChatActions.current
  val style = TextStyle(color = theme.textMuted, fontFamily = fonts.sans, fontWeight = FontWeight.Medium, fontSize = 12.sp, lineHeight = 16.sp)
  // A tap on the user opens their profile (bindUserMenu); holding keeps the message's own actions.
  val userPress = Modifier.chatPress(
    onClick = command.userUrl?.let { url -> { actions.onLinkPress(url) } },
    onLongClick = { actions.onMessageLongPress(messageId) },
  )
  command.avatarUrl?.let {
    AsyncImage(
      model = it,
      contentDescription = null,
      contentScale = ContentScale.Crop,
      modifier = Modifier.size(16.dp).clip(CircleShape).background(theme.cardBackground).then(userPress),
    )
    Spacer(Modifier.size(4.dp))
  }
  // The name may take at most 40% of the screen width, as a reply's author.
  val maxName = (LocalConfiguration.current.screenWidthDp * 0.4f).dp
  command.parts.forEach { part ->
    when (part.role) {
      NAME_ROLE -> BasicText(
        part.text,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        style = nameStyle(style.copy(fontWeight = FontWeight.SemiBold), command.authorColor, command.authorColors, theme.textDefault),
        modifier = Modifier.widthIn(max = maxName).clip(RoundedCornerShape(4.dp)).then(userPress),
      )
      COMMAND_ROLE -> BasicText(
        part.text,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        style = style.copy(color = theme.mentionForeground),
        modifier = Modifier
          .weight(1f, fill = false)
          .background(theme.mentionBackground, RoundedCornerShape(4.dp))
          .padding(horizontal = 2.dp),
      )
      else -> BasicText(part.text, maxLines = 1, style = style)
    }
  }
}

/**
 * EphemeralIndicationView: the eye icon, then "Only you can see this • Dismiss message" in 12sp medium muted text.
 * The dismiss part is a link that drops the message from this device. The help article button is left out.
 */
@Composable
internal fun EphemeralIndicationLine(indication: EphemeralIndication) {
  val theme = LocalChatTheme.current
  val fonts = LocalChatFonts.current
  val actions = LocalChatActions.current
  val style = TextStyle(color = theme.textMuted, fontFamily = fonts.sans, fontWeight = FontWeight.Medium, fontSize = 12.sp, lineHeight = 16.sp)
  Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 4.dp)) {
    Image(
      painter = cachedPainter(R.drawable.ic_eye),
      contentDescription = null,
      colorFilter = ColorFilter.tint(theme.textMuted),
      modifier = Modifier.size(16.dp),
    )
    Spacer(Modifier.size(4.dp))
    indication.parts.forEach { part ->
      val url = part.url
      BasicText(
        part.text,
        style = if (url != null) style.copy(color = theme.textLink) else style,
        modifier = if (url != null) {
          Modifier.clip(RoundedCornerShape(4.dp)).chatPress(onClick = { actions.onLinkPress(url) })
        } else {
          Modifier
        },
      )
    }
  }
}
