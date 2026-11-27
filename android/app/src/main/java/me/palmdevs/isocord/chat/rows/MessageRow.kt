package me.palmdevs.isocord.chat.rows

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.AnimationVector1D
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.VectorConverter
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.layout
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.constrainHeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import me.palmdevs.isocord.chat.chatPress
import me.palmdevs.isocord.chat.list.LocalChatActions
import me.palmdevs.isocord.chat.list.LocalChatFonts
import me.palmdevs.isocord.chat.list.LocalChatHighlight
import me.palmdevs.isocord.chat.list.LocalChatTheme
import me.palmdevs.isocord.chat.list.SwipeMode
import me.palmdevs.isocord.chat.list.SwipeToReply
import me.palmdevs.isocord.chat.media.AttachmentList
import me.palmdevs.isocord.core.LinkKind
import me.palmdevs.isocord.core.Links
import me.palmdevs.isocord.core.Perf
import me.palmdevs.isocord.expressions.LocalChatFlightKey
import me.palmdevs.isocord.expressions.LocalChatFlightTarget
import me.palmdevs.isocord.expressions.rememberActiveFlight

internal val AVATAR_SIZE = 40.dp

// The reference's MESSAGE_EDGE_INSET (12) + MESSAGE_AVATAR_SIZE (40) + MESSAGE_AVATAR_GAP (12) puts message
// text at MESSAGE_CONTENT_INSET (64dp), with 12dp kept at the end; each message has 2dp above and below.
private val GUTTER = 12.dp

internal val AVATAR_GAP = 12.dp

private val END_SPACING = 12.dp

internal val GROUP_SPACING = 16.dp

/** How long a message takes to resize when its reactions change. Material standard, as a row's entry. Reaction chips scale in and out over the same time. */
internal const val REACTIONS_RESIZE_MS = 200

// Our own, not in the reference: a message that is still sending breathes between these two opacities.
private const val SENDING_ALPHA_MIN = 0.35f

/** The opacity a sending row starts at. The picker flight lands on it, so the hand-over doesn't jump. */
internal const val SENDING_ALPHA_MAX = 0.65f

private const val SENDING_BREATHE_MS = 1000

private const val SENDING_SETTLE_MS = 500

@Composable
fun MessageRow(row: ChatRow.Message) {
  val actions = LocalChatActions.current
  // Kept above SwipeToReply so the animatable survives when confirmation enables swiping (row.swipe: null -> replyEdit).
  val sendingAlpha = rememberSendingAlphaModifier(row.status == "sending")
  // The group spacing sits outside the swipe, so only the message itself slides and the gutter fits it.
  Box(Modifier.padding(top = if (row.grouped) 0.dp else GROUP_SPACING)) {
    SwipeToReply(
      canEdit = row.swipe?.let { it == SwipeMode.REPLY_EDIT },
      onSwipe = { actions.onMessageSwipe(row.id, it.wire) },
    ) { Perf.span("chat:compose-message") { MessageRowContent(row, sendingAlpha) } }
  }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun MessageRowContent(row: ChatRow.Message, sendingAlpha: Modifier) {
  val theme = LocalChatTheme.current
  val actions = LocalChatActions.current
  val highlight = LocalChatHighlight.current
  val flight = rememberActiveFlight(LocalChatFlightKey.current)
  if (flight != null) {
    val sending = row.status == "sending"
    SideEffect { flight.targetSending = sending }
  }

  Column(
    modifier = Modifier
      .fillMaxWidth()
      // Messages that mention the user are tinted and carry a bar down their leading edge.
      .drawBehind {
        if (row.mentioned) {
          drawRect(theme.mentionedBackground)
          drawRect(theme.mentionedBar, size = Size(2.dp.toPx(), size.height))
        }
        // The message the composer replies to or edits (createChannelStream: isEditing for replyingMessageId and editing). Read here, so
        // only the rows it moves between redraw.
        if (highlight.composerTarget == row.id) drawRect(theme.highlight)
        // The flash on a message that was jumped to. Read here, so only this row redraws while it fades.
        if (highlight.id == row.id) drawRect(theme.highlight, alpha = highlight.alpha.value)
      }
      .chatPress(
        onLongClick = { actions.onMessageLongPress(row.id) },
      )
      .padding(vertical = 2.dp),
  ) {
    // Above the avatar, with the spine running from the avatar's centre up to it.
    MessageTop(row, avatarCenter = GUTTER + AVATAR_SIZE / 2, contentStart = GUTTER + AVATAR_SIZE + AVATAR_GAP)
    // Padding instead of spacers: fewer nodes to compose and measure for every row that scrolls in.
    Row(Modifier.padding(start = GUTTER)) {
    if (!row.grouped) MessageAvatar(row, AVATAR_SIZE, Modifier.padding(top = 2.dp))
    val start = if (row.grouped) AVATAR_SIZE + AVATAR_GAP else AVATAR_GAP
    Column(Modifier.weight(1f).padding(start = start, end = END_SPACING).then(sendingAlpha)) {
      if (!row.grouped) Header(row)
      Perf.span("chat:compose-message-text") { MessageText(row.content, row.jumbo, row.edited) }
      row.rich?.let { RichParts(it) }
      CompositionLocalProvider(LocalChatFlightTarget provides flight) {
        Perf.span("chat:compose-media") {
          AttachmentList(row.id, row.attachments)
          row.embeds.forEachIndexed { index, embed -> EmbedView(embed, row.id, index) }
        }
        // Buttons and other interactive components sit below the embeds, as in the reference.
        row.rich?.components?.takeIf { it.isNotEmpty() }?.let { ComponentsView(it, row.id) }
        row.stickers.forEach { StickerView(it) }
      }
      MessageReactions(row)
      // ThreadEmbedMessageAccessory: after the reactions.
      row.thread?.let { ThreadEmbedCard(it, Modifier.padding(top = 4.dp, bottom = 4.dp)) }
      row.ephemeralIndication?.let { EphemeralIndicationLine(it) }
      row.statusLabel?.let { label ->
        BasicText(
          label,
          style = TextStyle(color = theme.unreadText, fontFamily = LocalChatFonts.current.sans, fontSize = 12.sp, lineHeight = 16.sp),
          modifier = Modifier.padding(top = 4.dp).chatPress(onClick = { actions.onLinkPress("${Links.SCHEME}${LinkKind.RETRY}/${row.id}") }),
        )
      }
    }
    }
  }
}

/**
 * Returns a modifier that pulses a pending message's opacity and fades it to full opacity once
 * sending finishes.
 */
@Composable
private fun rememberSendingAlphaModifier(sending: Boolean): Modifier {
  val alpha = remember { Animatable(if (sending) SENDING_ALPHA_MAX else 1f) }
  var active by remember { mutableStateOf(sending) }
  if (sending) active = true

  LaunchedEffect(sending) {
    if (sending) {
      if (alpha.value > SENDING_ALPHA_MAX) {
        alpha.animateTo(SENDING_ALPHA_MAX, tween(SENDING_SETTLE_MS, easing = FastOutSlowInEasing))
      }
      alpha.animateTo(
        targetValue = SENDING_ALPHA_MIN,
        animationSpec = infiniteRepeatable(
          animation = tween(SENDING_BREATHE_MS, easing = FastOutSlowInEasing),
          repeatMode = RepeatMode.Reverse,
        ),
      )
    } else if (alpha.value < 1f) {
      alpha.animateTo(1f, tween(SENDING_SETTLE_MS, easing = LinearEasing))
      active = false
    } else {
      active = false
    }
  }

  return if (active) Modifier.graphicsLayer { this.alpha = alpha.value } else Modifier
}

/**
 * The reactions, in a box every message has so their height animates as they come and go. Rows below slide
 * instead of jumping. A box composed or reused for a row takes its first height at once. Unlike
 * animateContentSize it doesn't clip, so chips scaling in on a new line aren't cut off.
 */
@Composable
private fun MessageReactions(row: ChatRow.Message) {
  val scope = rememberCoroutineScope()
  val height = remember(row.id) { HeightAnimation() }
  val resize = Modifier.layout { measurable, constraints ->
    val placeable = measurable.measure(constraints)
    val animatable = height.animatable ?: Animatable(placeable.height, Int.VectorConverter).also { height.animatable = it }
    if (animatable.targetValue != placeable.height) {
      scope.launch { animatable.animateTo(placeable.height, tween(REACTIONS_RESIZE_MS, easing = FastOutSlowInEasing)) }
    }
    layout(placeable.width, constraints.constrainHeight(animatable.value)) { placeable.place(0, 0) }
  }
  Box(resize) {
    if (row.reactions.isNotEmpty() || row.addReaction) Reactions(
      row.id, row.reactions, row.addReaction,
      // 8dp above and below the reactions in a message.
      modifier = Modifier.padding(vertical = 8.dp),
    )
  }
}

/** The reactions box's height animation, made on its first measure. */
private class HeightAnimation {
  var animatable: Animatable<Int, AnimationVector1D>? = null
}
