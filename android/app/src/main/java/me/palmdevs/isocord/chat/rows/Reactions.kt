package me.palmdevs.isocord.chat.rows

import android.net.Uri
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.MutableTransitionState
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandHorizontally
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.shrinkHorizontally
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntSize
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

/**
 * A message's reaction chips and the add reaction button. [addLabel] is drawn after the button's icon (the media
 * viewer's footer, where the button is always shown). [moreCount] above 0 adds a "+N" chip that calls [onMore]
 * (ForumPostActionBarReactions).
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun Reactions(
  messageId: String,
  reactions: List<Reaction>,
  addReaction: Boolean,
  addLabel: String? = null,
  modifier: Modifier = Modifier.padding(top = 4.dp),
  moreCount: Int = 0,
  onMore: () -> Unit = {},
) {
  // Native ReactionView: 6dp corners, 1dp border, 6/5dp padding, 40dp minimum width, 20dp emoji, 14sp count.
  val shape = RoundedCornerShape(6.dp)
  // Chips present at first composition show at once; later ones scale in. A removed chip stays until it has scaled out.
  val initialKeys = remember { reactions.map { it.key }.toSet() }
  var shown by remember { mutableStateOf(reactions) }
  val keys = reactions.map { it.key }.toSet()
  val chips = reactions.toMutableList()
  shown.forEachIndexed { index, old -> if (old.key !in keys) chips.add(minOf(index, chips.size), old) }
  LaunchedEffect(reactions) { shown = chips }
  FlowRow(
    // The horizontal gap sits inside each animated chip, so it grows and shrinks with it.
    horizontalArrangement = Arrangement.Start,
    verticalArrangement = Arrangement.spacedBy(4.dp),
    modifier = modifier,
  ) {
    chips.forEach { reaction ->
      key(reaction.key) {
        ScalingChip(
          visible = reaction.key in keys,
          startVisible = reaction.key in initialKeys,
          onGone = { shown = shown.filter { it.key != reaction.key } },
        ) { ReactionChip(messageId, reaction, shape) }
      }
    }
    if (moreCount > 0) Box(Modifier.padding(end = CHIP_GAP)) { MoreChip(moreCount, shape, onMore) }
    if (addReaction) AddReactionChip(messageId, addLabel, shape)
  }
}

/** ForumPostActionBarReactions' "+N": the users behind the hidden reactions, on the chip's colours and size. */
@Composable
private fun MoreChip(count: Int, shape: Shape, onClick: () -> Unit) {
  val theme = LocalChatTheme.current
  Box(
    contentAlignment = Alignment.Center,
    modifier = Modifier
      .clip(shape)
      .chatPress(onClick = onClick)
      .background(theme.reactionBackground, shape)
      .border(1.dp, theme.reactionBorder, shape)
      .widthIn(min = 40.dp)
      .padding(horizontal = 6.dp, vertical = 5.dp),
  ) {
    // The emoji's 20dp line, so the chip is as tall as a reaction's.
    BasicText(text = "+$count", style = chipTextStyle(theme.reactionText).copy(lineHeight = 20.sp))
  }
}

/** The count's text style: semibold 14sp sans in [color]. */
@Composable
private fun chipTextStyle(color: Color) = TextStyle(
  color = color,
  fontFamily = LocalChatFonts.current.sans,
  fontWeight = FontWeight.SemiBold,
  fontSize = 14.sp,
  lineHeight = 18.sp,
)

/** A chip's height: the 20dp emoji, 5dp padding and 1dp border above and below. One line of chips. */
val REACTION_CHIP_HEIGHT = 32.dp

/** The space after each chip. */
private val CHIP_GAP = 4.dp

/** Scales and grows [content] in when [visible] turns on, out when it turns off, then calls [onGone]. */
@Composable
private fun ScalingChip(visible: Boolean, startVisible: Boolean, onGone: () -> Unit, content: @Composable () -> Unit) {
  val state = remember { MutableTransitionState(startVisible) }
  state.targetState = visible
  LaunchedEffect(visible, state.isIdle) { if (!visible && state.isIdle) onGone() }
  val spec = tween<Float>(REACTIONS_RESIZE_MS, easing = FastOutSlowInEasing)
  // The slot's width animates, so neighbours slide over instead of jumping. Its height doesn't, so the chip stays
  // centred in its line, and it isn't clipped while it scales.
  val width = tween<IntSize>(REACTIONS_RESIZE_MS, easing = FastOutSlowInEasing)
  AnimatedVisibility(
    visibleState = state,
    enter = expandHorizontally(width, Alignment.CenterHorizontally, clip = false) + fadeIn(spec),
    exit = shrinkHorizontally(width, Alignment.CenterHorizontally, clip = false) + fadeOut(spec),
  ) {
    Box(Modifier.padding(end = CHIP_GAP)) {
      Box(Modifier.animateEnterExit(enter = scaleIn(spec), exit = scaleOut(spec))) { content() }
    }
  }
}

/** A chip's fill, border and count colour. */
private data class ChipColors(val background: Color, val border: Color, val text: Color)

/**
 * ReactionView.configureBackground and configureTextColor. A super reaction takes its palette for the theme: the
 * fill, and the accent for the count and, when the user made it, the border. Without a palette the chip's own.
 */
private fun chipColors(reaction: Reaction, theme: ChatTheme): ChipColors {
  val normal = ChipColors(
    background = if (reaction.me) theme.reactionReactedBackground else theme.reactionBackground,
    border = if (reaction.me) theme.reactionReactedBorder else theme.reactionBorder,
    text = if (reaction.me) theme.reactionReactedText else theme.reactionText,
  )
  if (!reaction.burst) return normal
  val palette = reaction.burstColors?.let { if (theme.dark) it.dark else it.light }
  return ChipColors(
    background = palette?.background ?: normal.background,
    border = if (reaction.me) palette?.accent ?: normal.border else Color.Transparent,
    text = palette?.accent ?: theme.reactionText,
  )
}

/** One reaction: tap reacts or unreacts, hold lists who reacted. A super reaction chip names itself with `/burst`. */
@Composable
private fun ReactionChip(messageId: String, reaction: Reaction, shape: Shape) {
  val theme = LocalChatTheme.current
  val actions = LocalChatActions.current
  val colors = chipColors(reaction, theme)
  val path = "$messageId/${Uri.encode(reaction.key)}" + if (reaction.burst) "/${Links.BURST_PART}" else ""
  // Tap reacts or unreacts, hold lists who reacted. The chip takes both gestures, so the message's own long press stays quiet.
  Row(
    verticalAlignment = Alignment.CenterVertically,
    modifier = Modifier
      .clip(shape)
      .chatPress(
        onClick = { actions.onLinkPress("${Links.SCHEME}${LinkKind.REACT}/$path") },
        onLongClick = { actions.onLinkPress("${Links.SCHEME}${LinkKind.REACTIONS}/$path") },
      )
      .background(colors.background, shape)
      .border(1.dp, colors.border, shape)
      .widthIn(min = 40.dp)
      .padding(horizontal = 6.dp, vertical = 5.dp),
  ) {
    if (reaction.emojiUrl != null) {
      AsyncImage(model = reaction.emojiUrl, contentDescription = reaction.emoji, modifier = Modifier.size(20.dp))
    } else {
      BasicText(text = reaction.emoji, style = TextStyle(fontSize = 17.sp, lineHeight = 20.sp))
    }
    BasicText(
      text = reaction.count.toString(),
      style = chipTextStyle(colors.text),
      modifier = Modifier.padding(start = 6.dp),
    )
  }
}

/** The add reaction button, with [label] after its icon when given. */
@Composable
private fun AddReactionChip(messageId: String, label: String?, shape: Shape) {
  val theme = LocalChatTheme.current
  val actions = LocalChatActions.current
  // Native AddReactionView: the chip's colours and corners, 6dp padding all round, an 18dp icon tinted with the interactive text colour.
  Row(
    verticalAlignment = Alignment.CenterVertically,
    modifier = Modifier
      .clip(shape)
      .chatPress(onClick = { actions.onLinkPress("${Links.SCHEME}${LinkKind.ADD_REACTION}/$messageId") })
      .background(theme.reactionBackground, shape)
      .border(1.dp, theme.reactionBorder, shape)
      .padding(6.dp),
  ) {
    Image(
      painter = cachedPainter(R.drawable.ic_add_reaction),
      contentDescription = label,
      colorFilter = ColorFilter.tint(theme.reactionAddIcon),
      modifier = Modifier.size(18.dp),
    )
    if (label != null) {
      // The chip's count style, so the button lines up with the reactions next to it.
      BasicText(
        text = label,
        style = chipTextStyle(theme.reactionText),
        modifier = Modifier.padding(start = 6.dp, end = 2.dp),
      )
    }
  }
}
