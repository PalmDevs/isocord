package me.palmdevs.isocord.chat.rows.components

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.StartOffset
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.graphicsLayer
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
import me.palmdevs.isocord.chat.rows.ChatTheme
import me.palmdevs.isocord.chat.rows.Component

/** message_component_button_view: 8dp corners, 32dp minimum, a 1dp border. */
private val BUTTON_SHAPE = RoundedCornerShape(8.dp)
private val BUTTON_MIN_SIZE = 32.dp
/** The label's side padding, or the smaller one next to an emoji or the link icon (configureLabelPadding). */
private val LABEL_PADDING = 12.dp
private val LABEL_PADDING_NEAR_ICON = 4.dp

/** ButtonComponentView: a disabled label is at half opacity, its emoji and link icon at 30%. */
private const val DISABLED_LABEL_ALPHA = 0.5f
private const val DISABLED_ICON_ALPHA = 0.3f
/** setThemedBackgroundColor: a disabled button's fill. */
private const val DISABLED_FILL_ALPHA = 0.5f

/** ProgressDots: three dots, each pulsing a third of a cycle after the last. Its timing resource is our pick. */
private const val DOTS_CYCLE_MS = 900
private const val DOTS = 3
private const val DOT_MIN_SCALE = 0.5f

/** A button style's fill, border and label colours. */
private class ButtonLook(val fill: Color, val border: Color, val text: Color)

/** ButtonComponentView.configureStyle: brand for primary and premium, secondary for link and unknown styles. */
private fun buttonLook(style: String?, theme: ChatTheme) = when (style) {
  "secondary", "link" -> ButtonLook(theme.controlSecondary, theme.controlSecondaryBorder, theme.controlSecondaryText)
  "success" -> ButtonLook(theme.controlConnected, theme.controlConnectedBorder, theme.controlConnectedText)
  "danger" -> ButtonLook(theme.controlCritical, theme.controlCriticalBorder, theme.controlCriticalText)
  "primary", "premium" -> ButtonLook(theme.controlPrimary, theme.controlPrimaryBorder, theme.controlPrimaryText)
  else -> ButtonLook(theme.controlSecondary, theme.controlSecondaryBorder, theme.controlSecondaryText)
}

/**
 * ButtonComponentView: emoji, label and a link button's launch icon on the style's colours. While its interaction
 * runs, dots take the label's place and the button keeps its size.
 */
@Composable
internal fun ComponentButton(c: Component) {
  val theme = LocalChatTheme.current
  val actions = LocalChatActions.current
  val look = buttonLook(c.style, theme)
  val url = c.url
  Box(
    contentAlignment = Alignment.Center,
    modifier = Modifier
      .heightIn(min = BUTTON_MIN_SIZE)
      .widthIn(min = BUTTON_MIN_SIZE)
      .clip(BUTTON_SHAPE)
      .background(if (c.disabled) look.fill.copy(alpha = look.fill.alpha * DISABLED_FILL_ALPHA) else look.fill)
      .border(1.dp, look.border, BUTTON_SHAPE)
      .then(if (url != null) Modifier.chatPress(onClick = { actions.onLinkPress(url) }) else Modifier),
  ) {
    ButtonContent(c, look.text, Modifier.alpha(if (c.loading) 0f else 1f))
    if (c.loading) LoadingDots()
  }
}

@Composable
private fun ButtonContent(c: Component, color: Color, modifier: Modifier) {
  val theme = LocalChatTheme.current
  val fonts = LocalChatFonts.current
  val link = c.style == "link"
  val hasEmoji = c.emoji != null || c.emojiUrl != null
  val iconAlpha = if (c.disabled) DISABLED_ICON_ALPHA else 1f
  Row(verticalAlignment = Alignment.CenterVertically, modifier = modifier) {
    if (hasEmoji) {
      val emojiModifier = Modifier.padding(start = LABEL_PADDING).size(20.dp).alpha(iconAlpha)
      if (c.emojiUrl != null) {
        AsyncImage(model = c.emojiUrl, contentDescription = null, modifier = emojiModifier)
      } else {
        BasicText(c.emoji.orEmpty(), style = TextStyle(fontSize = 17.sp, lineHeight = 20.sp), modifier = emojiModifier)
      }
    }
    // configureLabelPadding: without a label, the emoji keeps the end padding.
    BasicText(
      c.label.orEmpty(),
      maxLines = 1,
      overflow = TextOverflow.Ellipsis,
      style = TextStyle(color = color, fontFamily = fonts.sans, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, lineHeight = 18.sp),
      modifier = Modifier
        .alpha(if (c.disabled) DISABLED_LABEL_ALPHA else 1f)
        .padding(
          start = if (hasEmoji) LABEL_PADDING_NEAR_ICON else LABEL_PADDING,
          end = if (link) LABEL_PADDING_NEAR_ICON else LABEL_PADDING,
        ),
    )
    if (link) {
      Image(
        painter = cachedPainter(R.drawable.component_window_launch),
        contentDescription = null,
        colorFilter = ColorFilter.tint(theme.controlSecondaryText),
        modifier = Modifier.padding(end = LABEL_PADDING).size(18.dp).alpha(iconAlpha),
      )
    }
  }
}

/** ProgressDots: three dots in the default text colour, 24dp wide, pulsing in turn. */
@Composable
internal fun LoadingDots(modifier: Modifier = Modifier) {
  val color = LocalChatTheme.current.textDefault
  val transition = rememberInfiniteTransition(label = "dots")
  Row(horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically, modifier = modifier.width(24.dp)) {
    repeat(DOTS) { index ->
      val scale by transition.animateFloat(
        initialValue = DOT_MIN_SCALE,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
          tween(DOTS_CYCLE_MS / 2),
          RepeatMode.Reverse,
          initialStartOffset = StartOffset(index * DOTS_CYCLE_MS / (DOTS * 2)),
        ),
        label = "dot",
      )
      Box(
        Modifier
          .size(6.dp)
          .graphicsLayer {
            scaleX = scale
            scaleY = scale
          }
          .background(color, CircleShape),
      )
    }
  }
}
