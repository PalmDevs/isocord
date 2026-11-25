package me.palmdevs.isocord.chat.list

import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.layout.layout
import kotlin.time.Duration.Companion.nanoseconds
import kotlin.time.Duration.Companion.seconds
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch
import me.palmdevs.isocord.chat.rows.ChatRow

/**
 * Rows between the oldest visible one and the end of the loaded history at which the next page is requested,
 * plus how many seconds of the current scroll speed (rows per second toward older messages) to look ahead.
 */
private const val LOAD_OLDER_THRESHOLD = 24

private const val LOAD_OLDER_LOOKAHEAD_SECONDS = 1.5f

private const val LOAD_OLDER_MAX_LEAD = 90

/** A page that did not arrive is requested again after this long, while the list is still near its end. */
internal val PAGE_RETRY = 5.seconds

/** Rows between the newest visible one and the newest loaded, at which a detached window asks for newer messages. */
private const val LOAD_NEWER_THRESHOLD = 12

/** Follows a wholesale replacement of the rows, and returns whether the first rows were placed. */
@Composable
internal fun NewestRowsEffect(state: LazyListState, rows: List<ChatRow>, changes: ChatRowChanges, scrollKey: String): Boolean {
  // When the rows were replaced wholesale (another window), follow the new ones; arrivals are handled above.
  // By list item key, so a folded group whose key moved is still the same newest row.
  val newestKey = rows.firstOrNull { it !is ChatRow.Loading }?.key?.let(changes::lazyKey)
  val previousNewest = remember { arrayOfNulls<String>(1) }
  // Positions are only recorded once the first rows have been placed, so the initial (0, 0) can't erase one.
  var positioned by remember { mutableStateOf(false) }
  LaunchedEffect(newestKey) {
    val previous = previousNewest[0]
    previousNewest[0] = newestKey
    if (previous == null && newestKey != null) {
      positioned = true
      val saved = ChatScrollMemory.positions[scrollKey]
      val index = saved?.let { s -> rows.indexOfFirst { changes.lazyKey(it.key) == s.key } } ?: -1
      // Fall through to the newest message when the saved row is no longer loaded.
      if (saved != null && index >= 0) return@LaunchedEffect state.scrollToItem(index, saved.offset)
    }
    // A deletion of the newest message is not another window: the list stays where the user is.
    val replaced = previous != null && rows.none { changes.lazyKey(it.key) == previous } && !changes.deletedOnly
    if ((previous == null || replaced) && newestKey != null) state.scrollToItem(0)
  }
  return positioned
}

@Composable
internal fun AtBottomEffect(state: LazyListState, scrollKey: String, atBottomBuffer: Float, onAtBottomChange: (String, Boolean) -> Unit) {
  // Tells JS whether the user is reading the newest message, which decides whether new ones are read at once.
  val atBottomChange by rememberUpdatedState(onAtBottomChange)
  LaunchedEffect(state) {
    snapshotFlow { if (state.layoutInfo.totalItemsCount == 0) null else state.isAtBottom(atBottomBuffer) }
      .distinctUntilChanged()
      .collect { atBottom -> if (atBottom != null) atBottomChange(scrollKey, atBottom) }
  }
}

@Composable
internal fun ScrollMemoryEffect(state: LazyListState, scrollKey: String, positioned: Boolean) {
  LaunchedEffect(state, scrollKey, positioned) {
    if (scrollKey.isEmpty() || !positioned) return@LaunchedEffect
    snapshotFlow { state.firstVisibleItemIndex to state.firstVisibleItemScrollOffset }
      .distinctUntilChanged()
      .collect { (index, offset) ->
        val key = state.layoutInfo.visibleItemsInfo.firstOrNull()?.key as? String
        if ((index == 0 && offset == 0) || key == null) ChatScrollMemory.positions.remove(scrollKey)
        else ChatScrollMemory.positions[scrollKey] = ChatScrollMemory.Position(key, offset)
      }
  }
}

@Composable
internal fun RowsDrawnEffect(hasContent: Boolean, scrollKey: String, onRowsDrawn: (String) -> Unit) {
  // Tells JS the first real rows of this chat are on screen (the second frame after composing them),
  // so the panel can slide in without the heavy first layout landing in the middle of the animation.
  val drawn by rememberUpdatedState(onRowsDrawn)
  LaunchedEffect(hasContent) {
    if (!hasContent) return@LaunchedEffect
    withFrameNanos {}
    withFrameNanos {}
    drawn(scrollKey)
  }
}

@Composable
internal fun ScrollRequestEffect(
  state: LazyListState,
  rows: List<ChatRow>,
  scrollKey: String,
  scrollTarget: ScrollTarget?,
  scrollMargin: Float,
  highlight: ChatHighlight,
  scope: CoroutineScope,
) {
  // A scroll requested by JS. It waits for its row (rows can arrive after the request) and happens once per nonce.
  val handledNonce = remember { IntArray(1) }
  val latestRows by rememberUpdatedState(rows)
  val target = scrollTarget?.takeIf { it.scrollKey == scrollKey }
  val targetLoaded = remember(rows, target) { target != null && (target.messageId == null || rows.indexOfMessage(target.messageId) >= 0) }
  LaunchedEffect(target?.nonce, targetLoaded) {
    if (target == null || !targetLoaded || target.nonce == handledNonce[0]) return@LaunchedEffect
    // Lets a replaced window (see the newest key effect above) settle first.
    withFrameNanos {}
    val index = if (target.messageId == null) 0 else latestRows.indexOfMessage(target.messageId)
    if (index < 0) return@LaunchedEffect
    handledNonce[0] = target.nonce
    state.scrollToRow(index, center = target.messageId != null, margin = scrollMargin)
    // Not tied to this effect: a recomposition that restarts it must not cut the flash short.
    if (target.flash && target.messageId != null) scope.launch { highlight.flash(target.messageId) }
  }
}

@Composable
internal fun LoadNewerEffect(
  state: LazyListState,
  anchorPending: () -> Boolean = { false },
  onLoadNewer: () -> Unit,
) {
  // A detached window asks for newer messages when the newest visible row is close to the newest loaded one.
  val loadNewer by rememberUpdatedState(onLoadNewer)
  LaunchedEffect(state) {
    var requestedTotal = -1
    var requestedAt = 0L
    snapshotFlow {
      if (anchorPending()) null
      else state.layoutInfo.totalItemsCount to state.firstVisibleItemIndex
    }.collect { pair ->
      val (total, first) = pair ?: return@collect
      if (total == 0 || first > LOAD_NEWER_THRESHOLD) return@collect
      val now = System.nanoTime()
      if (total != requestedTotal || (now - requestedAt).nanoseconds > PAGE_RETRY) {
        requestedTotal = total
        requestedAt = now
        loadNewer()
      }
    }
  }
}

@Composable
internal fun LoadOlderEffect(state: LazyListState, rows: List<ChatRow>, onLoadOlder: () -> Unit) {
  // Prefetch: the next page is requested while the oldest visible row is still LOAD_OLDER_THRESHOLD rows (more
  // when scrolling fast toward older messages) away from the end of what is loaded. Only asks while a
  // loading row ends the list, i.e. while JS knows there may be more; JS keeps one request in flight.
  val loadOlder by rememberUpdatedState(onLoadOlder)
  val currentRows by rememberUpdatedState(rows)
  LaunchedEffect(state) {
    var requestedTotal = -1
    var requestedAt = 0L
    var lastIndex = 0
    var lastTime = 0L
    var speed = 0f
    snapshotFlow {
      val info = state.layoutInfo
      info.totalItemsCount to (info.visibleItemsInfo.lastOrNull()?.index ?: 0)
    }
      .collect { (total, lastVisible) ->
        val now = System.nanoTime()
        if (lastTime != 0L && now > lastTime) {
          val instant = (lastVisible - lastIndex) * 1e9f / (now - lastTime)
          // Smoothed, and only the direction toward older messages counts.
          speed = (speed * 0.6f + instant * 0.4f).coerceAtLeast(0f)
        }
        lastIndex = lastVisible
        lastTime = now
        val lead = (LOAD_OLDER_THRESHOLD + speed * LOAD_OLDER_LOOKAHEAD_SECONDS).toInt().coerceAtMost(LOAD_OLDER_MAX_LEAD)
        val more = (currentRows.lastOrNull() as? ChatRow.Loading)?.placeholder == false
        if (!more || total == 0 || lastVisible < total - lead) return@collect
        if (total != requestedTotal || (now - requestedAt).nanoseconds > PAGE_RETRY) {
          requestedTotal = total
          requestedAt = now
          loadOlder()
        }
      }
  }
}
