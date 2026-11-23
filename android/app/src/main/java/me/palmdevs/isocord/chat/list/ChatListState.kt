package me.palmdevs.isocord.chat.list

import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.layout
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import me.palmdevs.isocord.chat.rows.ChatRow

/**
 * How far above the newest row still counts as reading it: new messages keep the list at the bottom and are read
 * at once. The reference's DimensionStore.isAtBottom wants the exact bottom; a little slack forgives a nudge.
 */
internal val AT_BOTTOM_BUFFER = 32.dp

/** Time uncomposed arrivals stay eligible to animate before settling. */
private const val ARRIVALS_SETTLE_MS = 1_000L

/**
 * Where each chat was left, by channel, for the app process. Holds the first visible row's key and its offset.
 * A chat left at the newest message has no entry.
 */
internal object ChatScrollMemory {
  class Position(val key: String, val offset: Int)

  private const val MAX_CHATS = 50
  val positions = object : LinkedHashMap<String, Position>(16, 0.75f, true) {
    override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, Position>) = size > MAX_CHATS
  }
}

/**
 * Keeps messages still when the composer above the list grows or shrinks, while reading older messages.
 * Undoes the bottom-edge shift in the same measure pass. At the newest message the list follows.
 * The keyboard and panels below the composer still push the list. Own behaviour, not checked against the reference.
 */
internal fun Modifier.keepStillUnderComposer(
  state: LazyListState,
  composer: ComposerSize,
  composerHeight: () -> Int?,
  atBottomBuffer: Float,
): Modifier =
  layout { measurable, constraints ->
    val height = composerHeight()
    val previous = composer.last
    composer.last = height
    if (height != null && previous != null && height != previous) {
      // The state is read without subscribing: this runs again when the list is resized, not when it scrolls.
      Snapshot.withoutReadObservation {
        if (!state.isAtBottom(atBottomBuffer)) {
          state.requestScrollToItem(state.firstVisibleItemIndex, state.firstVisibleItemScrollOffset + height - previous)
        }
      }
    }
    val placeable = measurable.measure(constraints)
    layout(placeable.width, placeable.height) { placeable.place(0, 0) }
  }

/** The composer's height at the list's last measure, kept across recompositions. */
internal class ComposerSize {
  var last: Int? = null
}

/** Whether the newest row is laid out within [buffer] px of its resting place at the bottom. */
internal fun LazyListState.isAtBottom(buffer: Float, maxIndex: Int = 0): Boolean {
  val newest = layoutInfo.visibleItemsInfo.firstOrNull() ?: return false
  // Offsets run from the bottom (reversed layout): a list scrolled up by d px has the newest row at -d.
  return newest.index <= maxIndex && -newest.offset <= buffer
}

/**
 * Finds rows that arrived at the newest end of an update: new keys before the previous newest row.
 * None when the update drops the previous newest row or touches a loading row at the newest end.
 */
internal class ChatArrivals(private val lazyKey: (String) -> String = { it }) {
  private var rows: List<ChatRow> = emptyList()
  private val entering: MutableSet<String> = HashSet()

  /** Whether the last [update] got new rows. A recomposition with the same rows returns the same set, unchanged. */
  var fresh = false
    private set

  fun update(next: List<ChatRow>): Set<String> {
    fresh = next !== rows
    if (!fresh) return entering
    val previous = rows
    rows = next
    val newest = previous.firstOrNull()
    val at = if (newest == null || newest is ChatRow.Loading || next.firstOrNull() is ChatRow.Loading) {
      -1
    } else {
      val newestKey = lazyKey(newest.key)
      next.indexOfFirst { lazyKey(it.key) == newestKey }
    }
    if (at < 0) {
      entering.clear()
    } else if (at > 0) {
      val known = previous.mapTo(HashSet<String>()) { lazyKey(it.key) }
      next.subList(0, at).mapNotNullTo(entering) { row -> lazyKey(row.key).takeIf { it !in known } }
    }
    return entering
  }

  /** Whether the row arrived and has not been composed since; it animates only that first time. */
  fun consume(key: String): Boolean = entering.remove(lazyKey(key))

  /** Arrivals not composed by now are off screen; they show without animating when scrolled to later. */
  fun settle() = entering.clear()
}

/** Returns the index of the row showing a message: the message itself, or the folded group that holds it. */
internal fun List<ChatRow>.indexOfMessage(id: String): Int = indexOfFirst { row ->
  row.key == id || (row is ChatRow.HiddenGroup && row.messages.any { it.key == id })
}

/** Which way [jumpTarget] lies while off screen (1 above, among older rows; -1 below), else 0. */
@Composable
internal fun jumpTargetSide(state: LazyListState, rows: List<ChatRow>, changes: ChatRowChanges, jumpTarget: String?): Int {
  val jumpRows by rememberUpdatedState(rows)
  val targetSide by remember(jumpTarget) {
    derivedStateOf {
      // Without a target nothing is read, so scrolling does not re-run this on every frame.
      if (jumpTarget == null) return@derivedStateOf 0
      val visible = state.layoutInfo.visibleItemsInfo
      val index = jumpRows.indexOfMessage(jumpTarget)
      val key = jumpRows.getOrNull(index)?.key?.let(changes::lazyKey)
      when {
        visible.isEmpty() || key == null || visible.any { it.key == key } -> 0
        index > visible.last().index -> 1
        else -> -1
      }
    }
  }
  return targetSide
}

/** Applies the saved scroll position of the chat once its first real rows are there. */
@Composable
internal fun RestoreScrollOnFirstRows(state: LazyListState, rows: List<ChatRow>, changes: ChatRowChanges, scrollKey: String, hasContent: Boolean) {
  // Restoring a saved position is requested while composing, so the first layout that has real rows already
  // uses it (a LaunchedEffect would run after that frame). Without one the list starts at the newest row.
  val restored = remember { BooleanArray(1) }
  if (hasContent && !restored[0]) {
    restored[0] = true
    val saved = ChatScrollMemory.positions[scrollKey]
    val index = saved?.let { s -> rows.indexOfFirst { changes.lazyKey(it.key) == s.key } } ?: -1
    if (saved != null && index >= 0) state.requestScrollToItem(index, saved.offset)
  }
}

/** Scrolls to the bottom when the user's own or a read-along message arrives; returns the arrivals for row motion. */
@Composable
internal fun rememberArrivals(
  state: LazyListState,
  rows: List<ChatRow>,
  changes: ChatRowChanges,
  atBottomBuffer: Float,
  typingInset: Float = 0f,
): ChatArrivals {
  // Messages that just arrived at the newest end. A lazy list keeps its first visible row in place (by key) when
  // rows are inserted before it, which would leave a new message under the chat input. So, in the same pass that
  // composes it (no frame shows it hidden): the user's own message always brings the list to the bottom, as
  // sending does in the reference, and anyone's does while the user was reading the newest one.
  val arrivals = remember(changes) { ChatArrivals(changes::lazyKey) }
  val entering = arrivals.update(rows)
  // Only on the pass that got the new rows: later recompositions (the jump button, an inset) return the same set,
  // and scrolling again then would pull back a user who scrolled up while their message is still sending.
  if (arrivals.fresh && entering.isNotEmpty()) {
    val newest = rows.first()
    val own = newest is ChatRow.Message && newest.status == "sending" && changes.lazyKey(newest.key) in entering
    // Read without subscribing: this composable must not recompose on every scrolled frame.
    if (own || Snapshot.withoutReadObservation { state.isAtBottom(atBottomBuffer + typingInset, maxIndex = entering.size) }) {
      state.requestScrollToItem(0)
    }
  }
  LaunchedEffect(rows) {
    delay(ARRIVALS_SETTLE_MS)
    arrivals.settle()
  }
  return arrivals
}
