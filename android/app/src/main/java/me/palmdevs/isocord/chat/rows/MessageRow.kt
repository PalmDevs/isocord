package me.palmdevs.isocord.chat.rows

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.AnimationVector1D
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.VectorConverter
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
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Size
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

internal val AVATAR_SIZE = 40.dp

// The reference's MESSAGE_EDGE_INSET (12) + MESSAGE_AVATAR_SIZE (40) + MESSAGE_AVATAR_GAP (12) puts message
// text at MESSAGE_CONTENT_INSET (64dp), with 12dp kept at the end; each message has 2dp above and below.
private val GUTTER = 12.dp

internal val AVATAR_GAP = 12.dp

private val END_SPACING = 12.dp

private val GROUP_SPACING = 16.dp

/** How long a message takes to resize when its reactions change. Material standard, as a row's entry. Reaction chips scale in and out over the same time. */
internal const val REACTIONS_RESIZE_MS = 200

@Composable
fun MessageRow(row: ChatRow.Message) {
  val actions = LocalChatActions.current
  // The group spacing sits outside the swipe, so only the message itself slides and the gutter fits it.
  Box(Modifier.padding(top = if (row.grouped) 0.dp else GROUP_SPACING)) {
    SwipeToReply(
      canEdit = row.swipe?.let { it == SwipeMode.REPLY_EDIT },
      onSwipe = { actions.onMessageSwipe(row.id, it.wire) },
    ) { MessageRowContent(row) }
  }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun MessageRowContent(row: ChatRow.Message) {
  val theme = LocalChatTheme.current
  val actions = LocalChatActions.current
  val highlight = LocalChatHighlight.current

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
    Column(Modifier.weight(1f).padding(start = start, end = END_SPACING).then(if (row.status == "sending") Modifier.alpha(0.5f) else Modifier)) {
      if (!row.grouped) Header(row)
      MessageText(row.content, row.jumbo, row.edited)
      row.rich?.let { RichParts(it) }
      AttachmentList(row.id, row.attachments)
      row.embeds.forEachIndexed { index, embed -> EmbedView(embed, row.id, index) }
      // Buttons and other interactive components sit below the embeds, as in the reference.
      row.rich?.components?.takeIf { it.isNotEmpty() }?.let { ComponentsView(it, row.id) }
      row.stickers.forEach { StickerView(it) }
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
