package me.palmdevs.isocord.chat.list

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyItemScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.layout
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import me.palmdevs.isocord.chat.ChatFonts
import me.palmdevs.isocord.chat.ChatPlaceholder
import me.palmdevs.isocord.chat.ChatRipple
import me.palmdevs.isocord.chat.HeldLink
import me.palmdevs.isocord.chat.LocalHeldLink
import me.palmdevs.isocord.chat.media.LocalChatScrolling
import me.palmdevs.isocord.chat.media.LocalGifvPool
import me.palmdevs.isocord.chat.media.rememberChatScrolling
import me.palmdevs.isocord.chat.media.rememberGifvPool
import me.palmdevs.isocord.chat.rows.ChatRow
import me.palmdevs.isocord.chat.rows.ChatTheme
import me.palmdevs.isocord.chat.rows.HiddenGroupRow
import me.palmdevs.isocord.chat.rows.MessageRow
import me.palmdevs.isocord.chat.rows.PostActionsBar
import me.palmdevs.isocord.chat.rows.PostActionsRow
import me.palmdevs.isocord.chat.rows.SystemRow
import me.palmdevs.isocord.chat.rows.WelcomeRow
import me.palmdevs.isocord.expressions.ExpressionFlightRegistry
import me.palmdevs.isocord.expressions.LocalChatFlightKey

val LocalChatTheme = staticCompositionLocalOf { ChatTheme() }

val LocalChatFonts = staticCompositionLocalOf<ChatFonts> { error("ChatFonts not provided") }

/** Callbacks rows use to report user actions back to JS. */
class ChatActions(
  val onLinkPress: (String) -> Unit,
  val onMessageLongPress: (String) -> Unit,
  /** A message was swiped: its id and `reply` or `edit` ([SwipeAction.wire]). */
  val onMessageSwipe: (String, String) -> Unit = { _, _ -> },
  /**
   * A part of a message was held: the message id and the part's link. A media tile reports its link without its
   * origin (`isocord://media/<messageId>/<index>`), so the long press sheet offers that media's actions
   * (selectedMedia). Files, embed text, the author's name and links in text report theirs; JS decides what each does.
   */
  val onMediaLongPress: (String, String) -> Unit = { id, _ -> onMessageLongPress(id) },
)

val LocalChatActions = staticCompositionLocalOf { ChatActions({}, {}) }

/**
 * The spring of the room the typing indicator takes, which JS slides the indicator with (SPRING_STANDARD in the
 * reference). Compose can't clamp overshoot, so the list is critically damped at the same stiffness per unit mass.
 */
object TypingInsetSpring {
  const val MASS = 0.35f
  const val DAMPING = 13f
  const val STIFFNESS = 250f
  val spec = spring<Dp>(Spring.DampingRatioNoBouncy, STIFFNESS / MASS)
}

private val SCROLL_MARGIN = 16.dp

/** Rows scrolled past the newest one before the jump-to-present button shows. */
private const val JUMP_BUTTON_THRESHOLD = 3

/**
 * The message list. `rows` is newest first, laid out bottom-up so index 0 sits at the bottom.
 * One view serves every chat: a new `scrollKey` resets the state and restores the saved position.
 */
@Composable
fun ChatList(
  /** Identifies the chat whose scroll position is remembered; empty to remember nothing. */
  scrollKey: String,
  /** A scroll to a message requested by JS; see [ScrollTarget]. */
  scrollTarget: ScrollTarget?,
  /**
   * A message the jump button leads back to instead of the present: shown while that message is off screen,
   * pointing toward it.
   */
  jumpTarget: String?,
  /** The message the composer replies to, lit until the reply is sent or cancelled. */
  composerTarget: String?,
  rows: List<ChatRow>,
  theme: ChatTheme,
  fonts: ChatFonts,
  /** Room kept free at the bottom for the chat input that floats over the list. */
  bottomInset: Dp,
  /** Room the typing indicator takes above the chat input; the list moves to make it, smoothly. */
  typingInset: Dp,
  onLoadOlder: () -> Unit,
  onLoadNewer: () -> Unit,
  onJumpToPresent: () -> Unit,
  onLinkPress: (String) -> Unit,
  /** A held message: its id, and the held part's link ([ChatActions.onMediaLongPress]) or "". */
  onMessageLongPress: (String, String) -> Unit,
  onMessageSwipe: (String, String) -> Unit,
  onRowsDrawn: (String) -> Unit,
  /** Whether the list rests at (within [AT_BOTTOM_BUFFER] of) the newest message, with the chat's `scrollKey`. */
  onAtBottomChange: (String, Boolean) -> Unit,
  /** dp at the top of the list occupied by a pinned header, with the chat's `scrollKey`. */
  onTopInsetChange: (String, Double) -> Unit = { _, _ -> },
  /** The height in px of the composer floating over the list, read while the list is measured; null without one. */
  composerHeight: () -> Int? = { null },
) {
  val typing by animateDpAsState(typingInset, TypingInsetSpring.spec, label = "typingInset")
  key(scrollKey) {
    ChatListContent(
      scrollKey, scrollTarget, jumpTarget, composerTarget, rows, theme, fonts, bottomInset + typing, maxOf(typing, typingInset),
      onLoadOlder, onLoadNewer, onJumpToPresent, onLinkPress, onMessageLongPress, onMessageSwipe, onRowsDrawn, onAtBottomChange, onTopInsetChange, composerHeight,
    )
  }
}

@Composable
private fun ChatListContent(
  scrollKey: String,
  scrollTarget: ScrollTarget?,
  jumpTarget: String?,
  composerTarget: String?,
  incoming: List<ChatRow>,
  theme: ChatTheme,
  fonts: ChatFonts,
  bottomInset: Dp,
  typingInset: Dp,
  onLoadOlder: () -> Unit,
  onLoadNewer: () -> Unit,
  onJumpToPresent: () -> Unit,
  onLinkPress: (String) -> Unit,
  onMessageLongPress: (String, String) -> Unit,
  onMessageSwipe: (String, String) -> Unit,
  onRowsDrawn: (String) -> Unit,
  onAtBottomChange: (String, Boolean) -> Unit,
  onTopInsetChange: (String, Double) -> Unit,
  composerHeight: () -> Int?,
) {
  val state = rememberLazyListState()
  val scope = rememberCoroutineScope()
  // The rows shown: JS's, plus rows deleted on screen until they have left. Every index below is into these.
  val changes = remember { ChatRowChanges() }
  // A post's action bar without its first message is only drawn pinned, not in the list.
  val postActions = incoming.firstNotNullOfOrNull { it as? ChatRow.PostActions }
  val listed = remember(incoming) { if (postActions?.pinnedOnly == true) incoming - postActions else incoming }
  val rows = changes.update(listed) {
    Snapshot.withoutReadObservation { state.layoutInfo.visibleItemsInfo.mapTo(HashSet<Any>()) { it.key } }
  }
  // A message held on a link in its text reports the link (onLongPressLink).
  val held = remember { HeldLink() }
  val actions = remember(onLinkPress, onMessageLongPress, onMessageSwipe) {
    ChatActions(onLinkPress, { id -> onMessageLongPress(id, held.take().orEmpty()) }, onMessageSwipe, onMessageLongPress)
  }
  val scrolledAway by remember { derivedStateOf { state.firstVisibleItemIndex >= JUMP_BUTTON_THRESHOLD } }
  // A detached window (JS jumped to an old message) ends in a loading row at the newest end: the present is not loaded.
  val hasNewer = (rows.firstOrNull() as? ChatRow.Loading)?.placeholder == false
  val targetSide = jumpTargetSide(state, rows, changes, jumpTarget)
  val showJump = if (jumpTarget != null) targetSide != 0 else scrolledAway || hasNewer
  // The side the target was last on, so the arrow does not turn while the button fades out.
  val targetAbove = remember { BooleanArray(1) }
  if (targetSide != 0) targetAbove[0] = targetSide == 1
  val highlight = remember { ChatHighlight() }
  // A state the rows read while drawing, so a new reply redraws two rows and rebuilds none.
  SideEffect { highlight.composerTarget = composerTarget }
  val scrollMargin = with(LocalDensity.current) { SCROLL_MARGIN.toPx() }
  val atBottomBuffer = with(LocalDensity.current) { AT_BOTTOM_BUFFER.toPx() }
  val typingInsetPx = with(LocalDensity.current) { typingInset.toPx() }
  val gifvPool = rememberGifvPool()
  val scrolling = rememberChatScrolling(state)
  val hasContent = rows.any { it !is ChatRow.Loading }
  val postActionsPinned = postActionsPinned(state, rows, changes, postActions)
  var pinnedBarHeightPx by remember { mutableIntStateOf(0) }
  val pinnedBarHeightDp = if (postActions != null && postActionsPinned) {
    with(LocalDensity.current) { pinnedBarHeightPx.toDp().value.toDouble() }
  } else {
    0.0
  }
  LaunchedEffect(scrollKey, pinnedBarHeightDp) { onTopInsetChange(scrollKey, pinnedBarHeightDp) }

  RestoreScrollOnFirstRows(state, rows, changes, scrollKey, hasContent)
  val newerAnchorPending = rememberLoadNewerAnchor(state, rows, changes)
  val arrivals = rememberArrivals(state, rows, changes, atBottomBuffer, typingInsetPx)

  CompositionLocalProvider(
    LocalChatTheme provides theme,
    LocalChatFonts provides fonts,
    LocalChatActions provides actions,
    LocalHeldLink provides held,
    LocalGifvPool provides gifvPool,
    LocalChatScrolling provides scrolling,
    LocalChatHighlight provides highlight,
    // Every press in the list ripples in the theme's colour, instead of foundation's default dark overlay.
    LocalIndication provides remember(theme.ripple) { ChatRipple(theme.ripple) },
  ) {
    Box(Modifier.fillMaxSize().background(theme.background)) {
      val contentPadding = PaddingValues(top = 8.dp, bottom = 8.dp + bottomInset)
      val keepStill = Modifier.fillMaxSize().keepStillUnderComposer(state, remember { ComposerSize() }, composerHeight, atBottomBuffer)
      LazyColumn(state = state, reverseLayout = true, contentPadding = contentPadding, modifier = keepStill) {
        items(rows, key = { changes.lazyKey(it.key) }, contentType = { it::class }) { row -> AnimatedRow(row, changes, arrivals) }
      }
      if (postActions != null && postActionsPinned) {
        PinnedPostActions(postActions, Modifier.onSizeChanged { pinnedBarHeightPx = it.height })
      }
      AnimatedVisibility(
        visible = showJump,
        enter = fadeIn(),
        exit = fadeOut(),
        modifier = Modifier.align(Alignment.BottomEnd).padding(end = JUMP_RIGHT, bottom = JUMP_BOTTOM + bottomInset),
      ) {
        JumpToPresentButton(up = targetAbove[0]) {
          when {
            jumpTarget != null -> scope.launch {
              val index = rows.indexOfFirst { it.key == jumpTarget }
              if (index < 0) return@launch
              state.scrollToRow(index, center = true, margin = scrollMargin)
              highlight.flash(jumpTarget)
            }
            // A detached window has to load the newest page first; JS then asks for the scroll itself.
            hasNewer -> onJumpToPresent()
            else -> scope.launch { state.scrollToRow(0, center = false, margin = scrollMargin) }
          }
        }
      }
    }
  }

  val positioned = NewestRowsEffect(state, rows, changes, scrollKey)
  AtBottomEffect(state, scrollKey, atBottomBuffer, onAtBottomChange)
  ScrollMemoryEffect(state, scrollKey, positioned)
  RowsDrawnEffect(hasContent, scrollKey, onRowsDrawn)
  ScrollRequestEffect(state, rows, scrollKey, scrollTarget, scrollMargin, highlight, scope)
  if (hasNewer) LoadNewerEffect(state, newerAnchorPending, onLoadNewer)
  LoadOlderEffect(state, rows, onLoadOlder)
}

private val NOOP_LEFT: () -> Unit = {}

/** One row with its enter or leave motion. */
@Composable
private fun LazyItemScope.AnimatedRow(row: ChatRow, changes: ChatRowChanges, arrivals: ChatArrivals) {
  // Only rows that just arrived animate in, and only the first time they are composed: loading, paging,
  // jumps and rows that scroll back into view are put in place at once. Rows deleted on screen animate out.
  // The motion is a modifier of a box every row has, so the row's content never moves in the tree.
  val enter = remember { arrivals.consume(row.key) }
  val flightKey = changes.lazyKey(row.key)
  // Read once when the row enters, so the registry's map doesn't recompose every visible row.
  val hasFlight = remember(flightKey) {
    Snapshot.withoutReadObservation { ExpressionFlightRegistry.activeFor(flightKey) != null }
  }
  val motion = when {
    changes.isLeaving(row.key) -> RowMotion(flightKey, leaving = true, onLeft = { changes.finish(row.key) })
    enter -> RowMotion(flightKey, leaving = false, onLeft = NOOP_LEFT, fade = !hasFlight)
    else -> Modifier
  }
  Box(motion) {
    CompositionLocalProvider(LocalChatFlightKey provides flightKey) {
      RowContent(row)
    }
  }
}

@Composable
private fun LazyItemScope.RowContent(row: ChatRow) {
  when (row) {
    is ChatRow.Message -> MessageRow(row)
    is ChatRow.HiddenGroup -> HiddenGroupRow(row)
    is ChatRow.System -> SystemRow(row)
    is ChatRow.Separator -> SeparatorRow(row)
    is ChatRow.Welcome -> WelcomeRow(row)
    is ChatRow.PostActions -> PostActionsRow(row)
    is ChatRow.Loading -> if (row.placeholder) ChatPlaceholder(Modifier.fillParentMaxHeight()) else LoadingRow()
  }
}

/** The forum post action bar pinned over the top of the list. Its touches stay off the rows under it. */
@Composable
private fun PinnedPostActions(row: ChatRow.PostActions, modifier: Modifier = Modifier) {
  PostActionsBar(
    row,
    modifier.pointerInput(Unit) { awaitEachGesture { awaitFirstDown(requireUnconsumed = false) } },
    gradient = LocalChatTheme.current.postActionsGradient,
  )
}

@Composable
private fun SeparatorRow(row: ChatRow.Separator) {
  val theme = LocalChatTheme.current
  val line = if (row.unread) theme.unreadBorder else theme.separator
  val rule = Dp.Hairline + 0.5.dp
  // 12sp text between two 1px rules with 8dp of space around the text (res/layout/separator_view.xml).
  Row(
    verticalAlignment = Alignment.CenterVertically,
    modifier = Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 16.dp),
  ) {
    Box(Modifier.weight(1f).height(rule).background(line))
    BasicText(
      text = row.text,
      style = TextStyle(
        color = if (row.unread) theme.unreadText else theme.textMuted,
        fontFamily = LocalChatFonts.current.sans,
        fontWeight = FontWeight.SemiBold,
        fontSize = 12.sp,
        lineHeight = 16.sp,
      ),
      modifier = Modifier.padding(horizontal = 8.dp),
    )
    Box(Modifier.weight(1f).height(rule).background(line))
  }
}

@Composable
internal fun LoadingRow() {
  val color = LocalChatTheme.current.textMuted
  val angle by rememberInfiniteTransition(label = "spinner").animateFloat(
    initialValue = 0f,
    targetValue = 360f,
    animationSpec = infiniteRepeatable(tween(900, easing = LinearEasing)),
    label = "angle",
  )
  Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxWidth().padding(vertical = 24.dp)) {
    Canvas(Modifier.size(24.dp)) {
      drawArc(
        color = color,
        startAngle = angle,
        sweepAngle = 270f,
        useCenter = false,
        style = Stroke(width = 3.dp.toPx(), cap = StrokeCap.Round),
      )
    }
  }
}
