package me.palmdevs.isocord.chat.rows

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import me.palmdevs.isocord.chat.chatPress
import me.palmdevs.isocord.chat.list.ChatRowChanges
import me.palmdevs.isocord.chat.list.RowMotion
import me.palmdevs.isocord.chat.list.LocalChatActions
import me.palmdevs.isocord.chat.list.LocalChatFonts
import me.palmdevs.isocord.chat.list.LocalChatTheme

// BlockedGroupDelegateKt.setupLayout's side margins, and the open group's corner radius.
private val GROUP_MARGIN = 8.dp
private val GROUP_RADIUS = 8.dp

// blocked_message_group_view.xml: the label's goneMarginStart and padding, and its 18sp line with that padding.
private val LABEL_START = 14.dp
private val LABEL_PADDING = 8.dp
private val LABEL_HEIGHT = 34.dp

// BlockedMessageGroupView's VerticalSpacingItemDecoration under the messages.
private val MESSAGES_BOTTOM = 16.dp

/** How long a group takes to open or close. Matches a message's reactions resize. */
private const val REVEAL_MS = REACTIONS_RESIZE_MS

private val HIDDEN_BACKGROUND_OPACITY = 0.25f

/**
 * BlockedMessageGroupView: "N blocked messages" in a muted label. A tap opens the messages under it on a filled,
 * rounded background. Opening and closing animate the height, the fill and the messages' fade.
 */
@Composable
fun HiddenGroupRow(row: ChatRow.HiddenGroup) {
  val theme = LocalChatTheme.current
  val fonts = LocalChatFonts.current
  val actions = LocalChatActions.current
  val spec = tween<Float>(REVEAL_MS, easing = FastOutSlowInEasing)
  val fill by animateColorAsState(
    if (row.revealed) theme.hiddenGroupBackground else theme.hiddenGroupBackground.copy(alpha = HIDDEN_BACKGROUND_OPACITY),
    tween(REVEAL_MS, easing = FastOutSlowInEasing),
    label = "hiddenGroupFill",
  )
  Column(
    Modifier
      .fillMaxWidth()
      // A margin outside the fill, as above a new message group.
      .padding(start = GROUP_MARGIN, top = GROUP_SPACING, end = GROUP_MARGIN)
      .clip(RoundedCornerShape(GROUP_RADIUS))
      .background(fill),
  ) {
    // The label sits centred in a fixed strip, not between paddings.
    Box(
      Modifier
        .fillMaxWidth()
        .heightIn(min = LABEL_HEIGHT)
        .chatPress(onClick = { actions.onLinkPress(row.url) })
        .padding(start = LABEL_PADDING, end = LABEL_PADDING),
      contentAlignment = Alignment.Center,
    ) {
      BasicText(
        row.text,
        style = TextStyle(
          color = theme.hiddenGroupText,
          fontFamily = fonts.sans,
          fontWeight = FontWeight.SemiBold,
          fontSize = 14.sp,
          lineHeight = 18.sp,
        ),
      )
    }
    AnimatedVisibility(
      visible = row.revealed,
      enter = expandVertically(tween(REVEAL_MS, easing = FastOutSlowInEasing), expandFrom = Alignment.Top) + fadeIn(spec),
      exit = shrinkVertically(tween(REVEAL_MS, easing = FastOutSlowInEasing), shrinkTowards = Alignment.Top) + fadeOut(spec),
    ) {
      GroupMessages(row)
    }
  }
}

/** Draws an open group's messages. One deleted while open fades and collapses, as in the list. */
@Composable
private fun GroupMessages(row: ChatRow.HiddenGroup) {
  val changes = remember { ChatRowChanges() }
  val messages = changes.update(row.messages) {
    if (row.revealed) row.messages.mapTo(HashSet<Any>()) { it.key } else emptySet()
  }
  // The list draws newest at the bottom, so the oldest message goes first here.
  Column(Modifier.padding(bottom = MESSAGES_BOTTOM)) {
    messages.asReversed().forEach { message ->
      key(message.key) {
        val motion = if (changes.isLeaving(message.key)) {
          Modifier.then(RowMotion(message.key, leaving = true, onLeft = { changes.finish(message.key) }))
        } else {
          Modifier
        }
        Box(motion) {
          when (message) {
            is ChatRow.Message -> MessageRow(message)
            is ChatRow.System -> SystemRow(message)
            else -> Unit
          }
        }
      }
    }
  }
}
