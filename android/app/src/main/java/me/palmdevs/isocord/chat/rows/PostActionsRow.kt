package me.palmdevs.isocord.chat.rows

import android.net.Uri
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import me.palmdevs.isocord.R
import me.palmdevs.isocord.chat.chatPress
import me.palmdevs.isocord.chat.list.LocalChatActions
import me.palmdevs.isocord.chat.list.LocalChatFonts
import me.palmdevs.isocord.chat.list.LocalChatTheme
import me.palmdevs.isocord.chat.media.cachedPainter
import me.palmdevs.isocord.core.LinkKind
import me.palmdevs.isocord.core.Links

/** IconButton size sm (ButtonConstants): a 32dp pill, an 18dp icon, button.BORDER_RADIUS corners. */
private val BUTTON_SIZE = 32.dp
private val BUTTON_ICON = 18.dp
private val BUTTON_SHAPE = RoundedCornerShape(8.dp)
/** Button size sm with an icon: 12dp side padding, 6dp between icon and text. */
private val BUTTON_PADDING = 12.dp
private val BUTTON_GAP = 6.dp

/** ForumPostActionBarView's footer_divider: 8dp of BACKGROUND_SURFACE_HIGH under the bar. */
private val FOOTER_DIVIDER = 8.dp

/** ForumPostActionBarView's header_divider: a 1dp BORDER_SUBTLE line, 8dp under the first message. */
private val HEADER_DIVIDER = 1.dp
private val HEADER_DIVIDER_MARGIN = 8.dp

/** The height of the row above its bar, which the pinned copy leaves out. */
internal val POST_ACTIONS_HEADER = HEADER_DIVIDER_MARGIN + HEADER_DIVIDER

/** The post actions row in the list: the header divider under the first message, then the bar. */
@Composable
fun PostActionsRow(row: ChatRow.PostActions) {
  val theme = LocalChatTheme.current
  Column(Modifier.fillMaxWidth()) {
    Box(Modifier.padding(top = HEADER_DIVIDER_MARGIN).fillMaxWidth().height(HEADER_DIVIDER).background(theme.separator))
    PostActionsBar(row)
  }
}

/**
 * ForumPostActionBar: the first message's reactions, then Follow, Copy Link and Jump To Top, over the footer
 * divider. Drawn in the list and pinned to its top.
 */
@Composable
fun PostActionsBar(row: ChatRow.PostActions, modifier: Modifier = Modifier) {
  val theme = LocalChatTheme.current
  val actions = LocalChatActions.current
  Column(modifier.fillMaxWidth().background(theme.background)) {
    Row(
      verticalAlignment = Alignment.CenterVertically,
      modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
    ) {
      Reactions(
        messageId = row.messageId,
        reactions = row.reactions,
        addReaction = row.addReaction,
        modifier = Modifier.weight(1f),
        moreCount = row.moreCount,
        onMore = {
          val key = row.moreKey ?: return@Reactions
          actions.onLinkPress("${Links.SCHEME}${LinkKind.REACTIONS}/${row.messageId}/${Uri.encode(key)}")
        },
      )
      Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        PostActionIconButton(if (row.following) R.drawable.post_unfollow else R.drawable.post_follow, row.follow)
        PostActionIconButton(R.drawable.preview_link, row.copyLink)
        PostActionIconButton(R.drawable.post_jump_to_top, row.jumpToTop)
      }
    }
    Box(Modifier.fillMaxWidth().height(FOOTER_DIVIDER).background(theme.postActionsDivider))
  }
}

/** IconButton size sm, variant secondary: the icon on the secondary control's fill and border, and its text if any (Button sm). */
@Composable
private fun PostActionIconButton(icon: Int, button: PostActionButton) {
  val theme = LocalChatTheme.current
  val actions = LocalChatActions.current
  Box(
    contentAlignment = Alignment.Center,
    modifier = Modifier
      .height(BUTTON_SIZE)
      .then(if (button.text == null) Modifier.width(BUTTON_SIZE) else Modifier)
      .clip(BUTTON_SHAPE)
      .chatPress(onClick = { actions.onLinkPress(button.url) })
      .background(theme.controlSecondary, BUTTON_SHAPE)
      .border(1.dp, theme.controlSecondaryBorder, BUTTON_SHAPE)
      .semantics {
        contentDescription = button.label
        role = Role.Button
      },
  ) {
    Row(
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.spacedBy(BUTTON_GAP),
      modifier = if (button.text == null) Modifier else Modifier.padding(horizontal = BUTTON_PADDING),
    ) {
      Image(
        painter = cachedPainter(icon),
        contentDescription = null,
        colorFilter = ColorFilter.tint(theme.controlSecondaryText),
        modifier = Modifier.size(BUTTON_ICON),
      )
      button.text?.let {
        BasicText(
          text = it,
          maxLines = 1,
          style = TextStyle(
            color = theme.controlSecondaryText,
            fontFamily = LocalChatFonts.current.sans,
            fontWeight = FontWeight.SemiBold,
            fontSize = 14.sp,
            lineHeight = 18.sp,
          ),
        )
      }
    }
  }
}
