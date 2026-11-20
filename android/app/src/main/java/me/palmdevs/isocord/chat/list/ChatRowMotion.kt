package me.palmdevs.isocord.chat.list

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.items
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.Measurable
import androidx.compose.ui.layout.MeasureResult
import androidx.compose.ui.layout.MeasureScope
import androidx.compose.ui.layout.layout
import androidx.compose.ui.node.LayoutModifierNode
import androidx.compose.ui.node.ModifierNodeElement
import androidx.compose.ui.node.invalidateMeasurement
import androidx.compose.ui.node.invalidatePlacement
import androidx.compose.ui.unit.Constraints
import kotlin.math.roundToInt
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import me.palmdevs.isocord.chat.rows.ChatRow

/**
 * An arriving message grows while fading in. A deleted one fades out while collapsing, a little faster.
 * The reference list (DCDChatList) has no item animator. Durations are Material standard.
 */
private const val ENTER_HEIGHT_MS = 200f

private const val ENTER_FADE_MS = 400f

private const val EXIT_HEIGHT_MS = 200f

private const val EXIT_FADE_MS = 150f

/**
 * Rows deleted on screen, kept until they fade and collapse.
 * Pending messages the server confirmed under a new id keep their list item and enter animation, as do folded groups
 * whose key moved.
 * Window swaps, paging and channel switches animate nothing.
 */
internal class ChatRowChanges {
  private var incoming: List<ChatRow> = emptyList()
  private var shown: List<ChatRow> = emptyList()
  private var shownVersion = -1

  /** Bumped when a leaving row is gone, so the list is composed again without it. */
  private var version by mutableIntStateOf(0)

  /** Rows on their way out, by key. Read by their items, which then animate. */
  private val leaving = mutableStateMapOf<String, ChatRow>()

  /** The list item key of a sent message that was pending under its nonce. */
  private val aliases = HashMap<String, String>()

  /** Whether the last update from JS only removed rows (besides arrivals, dividers and confirmed messages). */
  var deletedOnly = false
    private set

  fun lazyKey(key: String): String = aliases[key] ?: key

  fun isLeaving(key: String): Boolean = leaving.containsKey(key)

  fun finish(key: String) {
    if (leaving.remove(key) != null) version++
  }

  fun update(next: List<ChatRow>, visibleKeys: () -> Set<Any>): List<ChatRow> {
    val current = version
    if (next === incoming && current == shownVersion) return shown
    // Only [version] is a dependency of the list; the leaving rows are read and written here without it.
    return Snapshot.withoutReadObservation { rebuild(next, current, visibleKeys) }
  }

  private fun rebuild(next: List<ChatRow>, current: Int, visibleKeys: () -> Set<Any>): List<ChatRow> {
    val previous = shown
    if (next !== incoming) {
      incoming = next
      val nextKeys = next.mapTo(HashSet()) { it.key }
      val previousKeys = previous.mapTo(HashSet()) { it.key }
      // A row that came back (a refresh that still has it) is not leaving.
      leaving.keys.filter { it in nextKeys }.forEach { leaving.remove(it) }
      val removed = previous.filter { it.key !in nextKeys && !leaving.containsKey(it.key) }
      val added = next.filter { it.key !in previousKeys }
      // A pending message confirmed by the server: its id replaces its nonce, with the same author and text.
      val confirmed = HashSet<String>()
      for (row in removed) {
        if (row !is ChatRow.Message || row.status != "sending") continue
        val sent = added.firstOrNull {
          it is ChatRow.Message && it.key !in confirmed && it.status != "sending" &&
            it.authorName == row.authorName && it.content == row.content
        } ?: continue
        aliases[sent.key] = lazyKey(row.key)
        confirmed += sent.key
        confirmed += row.key
      }
      // A folded group keyed by its oldest message gets a new key when that one goes or older history joins it.
      for (row in removed) {
        if (row !is ChatRow.HiddenGroup) continue
        val held = row.messages.mapTo(HashSet()) { it.key }
        val moved = added.firstOrNull { it is ChatRow.HiddenGroup && it.key !in confirmed && it.messages.any { m -> m.key in held } }
          ?: continue
        aliases[moved.key] = lazyKey(row.key)
        confirmed += moved.key
        confirmed += row.key
      }
      // Arrivals come before the newest row that stays; anything else new but a divider means another window.
      val kept = previous.firstOrNull { it !is ChatRow.Loading && it.key in nextKeys }?.key
      val keptAt = if (kept == null) -1 else next.indexOfFirst { it.key == kept }
      deletedOnly = previous.isNotEmpty() && added.all { row ->
        row is ChatRow.Separator || row.key in confirmed || next.indexOf(row) < keptAt
      }
      if (deletedOnly) {
        val visible = visibleKeys()
        for (row in removed) {
          if (row !is ChatRow.Loading && row.key !in confirmed && lazyKey(row.key) in visible) leaving[row.key] = row
        }
      } else {
        leaving.clear()
      }
    }
    shown = keepLeaving(previous, incoming)
    shownVersion = current
    return shown
  }

  /** [next] with the leaving rows back where they were in [previous]. */
  private fun keepLeaving(previous: List<ChatRow>, next: List<ChatRow>): List<ChatRow> {
    if (leaving.isEmpty()) return next
    val at = HashMap<String, Int>(previous.size * 2)
    previous.forEachIndexed { index, row -> at[row.key] = index }
    val gone = leaving.values.filter { it.key in at }.sortedBy { at.getValue(it.key) }
    val out = ArrayList<ChatRow>(next.size + gone.size)
    var j = 0
    for (row in next) {
      val index = at[row.key]
      if (index != null) while (j < gone.size && at.getValue(gone[j].key) < index) out.add(gone[j++])
      out.add(row)
    }
    while (j < gone.size) out.add(gone[j++])
    return out
  }
}

/**
 * Animates a row in (its height grows from nothing while it fades in) or out (it fades out while its height
 * collapses), then calls [onLeft] for one going out. Changing direction carries on from where it is.
 */
internal data class RowMotion(val leaving: Boolean, val onLeft: () -> Unit) : ModifierNodeElement<RowMotionNode>() {
  override fun create() = RowMotionNode(leaving, onLeft)

  override fun update(node: RowMotionNode) {
    node.onLeft = onLeft
    if (node.leaving != leaving) {
      node.leaving = leaving
      node.start()
    }
  }
}

/**
 * The node behind [RowMotion]. Progress is plain fields, and every frame requests a new measure and placement.
 * The animation runs on the node's scope. A node that goes away first counts as finished, so no row stays clipped.
 */
internal class RowMotionNode(var leaving: Boolean, var onLeft: () -> Unit) : Modifier.Node(), LayoutModifierNode {
  /** Shown fraction of the row's height, and its opacity. */
  private var height = if (leaving) 1f else 0f
  private var opacity = height
  private var job: Job? = null
  private var left = false

  override fun onAttach() = start()

  override fun onDetach() {
    job = null
    settle()
  }

  fun start() {
    job?.cancel()
    val fromHeight = height
    val fromOpacity = opacity
    val target = if (leaving) 0f else 1f
    val heightMs = if (leaving) EXIT_HEIGHT_MS else ENTER_HEIGHT_MS
    val fadeMs = if (leaving) EXIT_FADE_MS else ENTER_FADE_MS
    job = coroutineScope.launch {
      var start = -1L
      while (true) {
        val now = withFrameNanos { it }
        if (start < 0) start = now
        val ms = (now - start) / 1_000_000f
        val grown = (ms / heightMs).coerceAtMost(1f)
        val faded = (ms / fadeMs).coerceAtMost(1f)
        height = fromHeight + (target - fromHeight) * FastOutSlowInEasing.transform(grown)
        opacity = fromOpacity + (target - fromOpacity) * faded
        // The fade outlasts the growth; a measure of an unchanged size would not place the row (and its layer) again.
        invalidateMeasurement()
        invalidatePlacement()
        if (grown >= 1f && faded >= 1f) break
      }
      settle()
    }
  }

  private fun settle() {
    height = if (leaving) 0f else 1f
    opacity = height
    if (leaving && !left) {
      left = true
      onLeft()
    }
  }

  override fun MeasureScope.measure(measurable: Measurable, constraints: Constraints): MeasureResult {
    val placeable = measurable.measure(constraints)
    val shown = height
    val alpha = opacity
    val visibleHeight = if (shown >= 1f) placeable.height else (placeable.height * shown).roundToInt()
    return layout(placeable.width, visibleHeight) {
      placeable.placeWithLayer(0, 0) {
        this.alpha = alpha
        // Only while part of the row is hidden; a whole row may draw outside its bounds.
        clip = shown < 1f
      }
    }
  }
}
