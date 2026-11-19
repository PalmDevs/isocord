package me.palmdevs.isocord.chat.list

import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.platform.LocalDensity
import me.palmdevs.isocord.chat.rows.ChatRow
import me.palmdevs.isocord.chat.rows.POST_ACTIONS_HEADER

/**
 * Whether the forum post action bar is pinned to the top of the list (ChatViewStickyHeader). A sticky header: once
 * the row's bar reaches the list's top edge, or lies above it among older rows. Always without the first message.
 * Offsets run from the bottom (reversed layout), so the top edge is `viewportEndOffset`.
 */
@Composable
internal fun postActionsPinned(state: LazyListState, rows: List<ChatRow>, changes: ChatRowChanges, bar: ChatRow.PostActions?): Boolean {
  val header = with(LocalDensity.current) { POST_ACTIONS_HEADER.toPx() }
  val pinRows by rememberUpdatedState(rows)
  val key = bar?.key
  val pinnedOnly = bar?.pinnedOnly == true
  val pinned by remember(key, pinnedOnly, header) {
    derivedStateOf {
      // Without a bar in the list nothing is read, so scrolling does not re-run this.
      if (key == null || pinnedOnly) return@derivedStateOf pinnedOnly
      val info = state.layoutInfo
      val visible = info.visibleItemsInfo
      if (visible.isEmpty()) return@derivedStateOf false
      val item = visible.firstOrNull { it.key == changes.lazyKey(key) }
      if (item != null) return@derivedStateOf item.offset + item.size - header > info.viewportEndOffset
      pinRows.indexOfFirst { it.key == key } > visible.last().index
    }
  }
  return pinned
}
