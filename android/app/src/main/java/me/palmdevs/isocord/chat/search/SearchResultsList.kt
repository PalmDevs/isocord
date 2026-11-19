package me.palmdevs.isocord.chat.search

import androidx.compose.foundation.Image
import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.snapshotFlow
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.rememberNestedScrollInteropConnection
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import kotlin.time.Duration.Companion.nanoseconds
import kotlinx.coroutines.flow.filter
import me.palmdevs.isocord.chat.ChatFonts
import me.palmdevs.isocord.chat.ChatRipple
import me.palmdevs.isocord.chat.chatPress
import me.palmdevs.isocord.chat.fadeCut
import me.palmdevs.isocord.chat.list.ChatActions
import me.palmdevs.isocord.chat.list.LoadingRow
import me.palmdevs.isocord.chat.list.LocalChatActions
import me.palmdevs.isocord.chat.list.LocalChatFonts
import me.palmdevs.isocord.chat.list.LocalChatTheme
import me.palmdevs.isocord.chat.list.PAGE_RETRY
import me.palmdevs.isocord.chat.media.AttachmentList
import me.palmdevs.isocord.chat.media.LocalChatScrolling
import me.palmdevs.isocord.chat.media.LocalGifvPool
import me.palmdevs.isocord.chat.media.cachedPainter
import me.palmdevs.isocord.chat.media.rememberChatScrolling
import me.palmdevs.isocord.chat.media.rememberGifvPool
import me.palmdevs.isocord.chat.rows.AVATAR_GAP
import me.palmdevs.isocord.chat.rows.ChatRow
import me.palmdevs.isocord.chat.rows.ChatTheme
import me.palmdevs.isocord.chat.rows.ComponentsView
import me.palmdevs.isocord.chat.rows.EmbedView
import me.palmdevs.isocord.chat.rows.Header
import me.palmdevs.isocord.chat.rows.MessageAvatar
import me.palmdevs.isocord.chat.rows.MessageText
import me.palmdevs.isocord.chat.rows.RichParts
import me.palmdevs.isocord.chat.rows.StickerView
import me.palmdevs.isocord.chat.rows.welcomeIcon
import me.palmdevs.isocord.core.LinkKind
import me.palmdevs.isocord.core.Links

/*
 * The list of a search tab's messages. Each result is a standalone chat message (no grouping, replies or reactions),
 * laid out like the reference's SearchListRow: 16dp sides, 8dp above and below, 48dp avatar, channel header above in servers.
 */

private val ROW_HORIZONTAL = 16.dp
private val ROW_VERTICAL = 8.dp
private val AVATAR = 48.dp

/** The server icon before a notification's channel. */
private val GUILD_ICON = 16.dp

/** The opacity of a read notification's content. */
private const val READ_ALPHA = 0.75f

/** Rows between the last visible row and the end at which the next page is requested. */
private const val END_THRESHOLD = 4

@Composable
fun SearchResultsList(
  rows: List<SearchRow>,
  theme: ChatTheme,
  fonts: ChatFonts,
  /** Lines of text a result shows (4 for messages, 10 for pins). */
  lineClamp: Int,
  /** Results take taps only as a whole: links, mentions, spoilers and the author line inside them do nothing. */
  inertContent: Boolean,
  /** A result's body (text, media, embeds) past this is cut with a fade; 0 for no limit. */
  maxContentHeight: Dp,
  topPadding: Dp,
  bottomPadding: Dp,
  onLinkPress: (String) -> Unit,
  /** A result was held: its row key. Null when results take no long press. */
  onResultLongPress: ((String) -> Unit)?,
  onEndReached: () -> Unit,
  onScrollDrag: () -> Unit,
  /** The list is at its very top, or no longer is. Gates the pull to refresh around the view. */
  onAtTopChange: (Boolean) -> Unit,
) {
  val state = rememberLazyListState()
  val actions = remember(onLinkPress) { ChatActions(onLinkPress, {}) }
  val gifvPool = rememberGifvPool()
  val scrolling = rememberChatScrolling(state)

  // Rows that arrive above the first one (a first page in place of the loading row, newer items on a refresh) would
  // be kept off screen by the key-based scroll position. In the pass that composes them, a list at its top stays there.
  val firstKey = rows.firstOrNull()?.key
  val shownFirstKey = remember { arrayOfNulls<String>(1) }
  if (shownFirstKey[0] != firstKey) {
    shownFirstKey[0] = firstKey
    if (Snapshot.withoutReadObservation { state.firstVisibleItemIndex == 0 }) state.requestScrollToItem(0)
  }

  CompositionLocalProvider(
    LocalChatTheme provides theme,
    LocalChatFonts provides fonts,
    LocalChatActions provides actions,
    LocalGifvPool provides gifvPool,
    LocalChatScrolling provides scrolling,
    LocalIndication provides remember(theme.ripple) { ChatRipple(theme.ripple) },
  ) {
    LazyColumn(
      state = state,
      contentPadding = PaddingValues(top = topPadding, bottom = bottomPadding),
      // Hands overscroll at the top to the pull to refresh around the view.
      modifier = Modifier.fillMaxSize().nestedScroll(rememberNestedScrollInteropConnection()).background(theme.background),
    ) {
      items(rows, key = { it.key }, contentType = { it::class }) { row ->
        when (row) {
          is SearchRow.Result -> ResultRow(row, lineClamp, inertContent, maxContentHeight, onResultLongPress)
          is SearchRow.Notice -> NoticeRow(row)
          is SearchRow.Loading -> LoadingRow()
        }
      }
    }
  }

  // Asks for the next page while a loading row ends the list and the last visible row is near it. JS keeps one
  // request in flight and drops the loading row when there is no more.
  val more by rememberUpdatedState(rows.lastOrNull() is SearchRow.Loading)
  val reached by rememberUpdatedState(onEndReached)
  LaunchedEffect(state) {
    var requestedTotal = -1
    var requestedAt = 0L
    snapshotFlow {
      val info = state.layoutInfo
      info.totalItemsCount to (info.visibleItemsInfo.lastOrNull()?.index ?: 0)
    }.collect { (total, lastVisible) ->
      if (!more || total == 0 || lastVisible < total - 1 - END_THRESHOLD) return@collect
      val now = System.nanoTime()
      if (total != requestedTotal || (now - requestedAt).nanoseconds > PAGE_RETRY) {
        requestedTotal = total
        requestedAt = now
        reached()
      }
    }
  }

  // The keyboard of the search field goes away when the results are scrolled.
  val drag by rememberUpdatedState(onScrollDrag)
  LaunchedEffect(state) {
    snapshotFlow { state.isScrollInProgress }.filter { it }.collect { drag() }
  }
  val atTop by rememberUpdatedState(onAtTopChange)
  LaunchedEffect(state) {
    snapshotFlow { state.firstVisibleItemIndex == 0 && state.firstVisibleItemScrollOffset == 0 }.collect { atTop(it) }
  }
}

@Composable
private fun ResultRow(
  row: SearchRow.Result,
  lineClamp: Int,
  inert: Boolean,
  maxContentHeight: Dp,
  onLongPress: ((String) -> Unit)?,
) {
  val actions = LocalChatActions.current
  val press = Modifier.chatPress(
    onClick = { actions.onLinkPress("${Links.SCHEME}${LinkKind.RESULT}/${row.channelId}/${row.messageId}") },
    onLongClick = onLongPress?.let { { it(row.key) } },
  )
  if (!inert) {
    ResultContent(row, lineClamp, maxContentHeight, press)
    return
  }
  // The press covers the content: the topmost sibling that is hit takes the touch, so nothing inside sees it.
  Box(Modifier.fillMaxWidth()) {
    ResultContent(row, lineClamp, maxContentHeight, Modifier)
    Box(Modifier.matchParentSize().then(press))
  }
}

@Composable
private fun ResultContent(row: SearchRow.Result, lineClamp: Int, maxContentHeight: Dp, press: Modifier) {
  val theme = LocalChatTheme.current
  val fonts = LocalChatFonts.current
  val message = row.message
  Column(
    Modifier
      .fillMaxWidth()
      // Unread notifications are tinted with a bar down their leading edge, like a chat message that mentions the user.
      .drawBehind {
        if (message.mentioned) {
          drawRect(theme.mentionedBackground)
          drawRect(theme.mentionedBar, size = Size(2.dp.toPx(), size.height))
        }
      }
      .then(press)
      .padding(horizontal = ROW_HORIZONTAL, vertical = ROW_VERTICAL)
      .then(if (row.read) Modifier.alpha(READ_ALPHA) else Modifier),
  ) {
    if (row.channelName != null) {
      // GuildChannelMessageRowHeader: the channel's icon and name, 12dp above the message.
      Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(end = 16.dp, bottom = 12.dp)) {
        // Our own addition with the server's name below: its icon (a rounded square, as GuildIcon), as results span
        // every server. The reference's ForYouItemImage shows only the author.
        if (row.guildIconUrl != null || row.guildAcronym != null) {
          GuildIconSmall(row.guildIconUrl, row.guildAcronym.orEmpty())
          Spacer(Modifier.width(6.dp))
        }
        welcomeIcon(row.channelIcon)?.let { icon ->
          Image(
            painter = cachedPainter(icon),
            contentDescription = null,
            colorFilter = ColorFilter.tint(theme.textMuted),
            modifier = Modifier.size(16.dp),
          )
        }
        Spacer(Modifier.width(5.dp))
        val style = TextStyle(color = theme.textMuted, fontFamily = fonts.sans, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, lineHeight = 18.sp)
        BasicText(
          text = row.channelName,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis,
          style = style,
          modifier = Modifier.weight(1f, fill = false),
        )
        // Our own addition: "<channel> • <server>", as the results of the Notifications tab span every server.
        if (row.guildName != null) {
          BasicText(
            text = " • ${row.guildName}",
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            style = style,
            modifier = Modifier.weight(1f, fill = false),
          )
        }
      }
    }
    Row {
      MessageAvatar(message, AVATAR)
      Spacer(Modifier.width(AVATAR_GAP))
      Column(Modifier.weight(1f)) {
        Header(message)
        Column(Modifier.fadeCut(maxContentHeight)) { MessageBody(message, lineClamp) }
      }
    }
  }
}

/** A server's icon at [GUILD_ICON] in a rounded square, or the first letter of its acronym on a plain one. */
@Composable
private fun GuildIconSmall(url: String?, acronym: String) {
  val theme = LocalChatTheme.current
  val fonts = LocalChatFonts.current
  val shape = RoundedCornerShape(GUILD_ICON * 0.3f)
  if (url != null) {
    AsyncImage(
      model = url,
      contentDescription = null,
      contentScale = ContentScale.Crop,
      modifier = Modifier.size(GUILD_ICON).clip(shape).background(theme.placeholder),
    )
  } else {
    Box(Modifier.size(GUILD_ICON).clip(shape).background(theme.placeholder), contentAlignment = Alignment.Center) {
      BasicText(
        text = acronym,
        maxLines = 1,
        style = TextStyle(color = theme.textDefault, fontFamily = fonts.sans, fontWeight = FontWeight.SemiBold, fontSize = 10.sp, lineHeight = 12.sp),
      )
    }
  }
}

/**
 * What a standalone message shows under its author line: the text cut after [lineClamp] lines, then its rich parts,
 * attachments, embeds, components and stickers, in the chat's order. Shared by search results and the in-app
 * notification preview.
 */
@Composable
fun MessageBody(message: ChatRow.Message, lineClamp: Int) {
  MessageText(message.content, jumbo = false, edited = message.edited, maxLines = lineClamp)
  message.rich?.let { RichParts(it) }
  AttachmentList(message.id, message.attachments)
  message.embeds.forEachIndexed { index, embed -> EmbedView(embed, message.id, index) }
  message.rich?.components?.takeIf { it.isNotEmpty() }?.let { ComponentsView(it, message.id) }
  message.stickers.forEach { StickerView(it) }
}

/** SearchHistoricalIndexingHeader: a bordered card of text above the results. */
@Composable
private fun NoticeRow(row: SearchRow.Notice) {
  val theme = LocalChatTheme.current
  val shape = RoundedCornerShape(8.dp)
  Column(
    verticalArrangement = Arrangement.spacedBy(2.dp),
    modifier = Modifier
      .fillMaxWidth()
      .padding(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 16.dp)
      .background(theme.cardBackground, shape)
      .border(1.dp, theme.separator, shape)
      .padding(16.dp),
  ) {
    row.lines.forEach { line ->
      BasicText(
        text = line,
        style = TextStyle(color = theme.textDefault, fontFamily = LocalChatFonts.current.sans, fontSize = 14.sp, lineHeight = 18.sp),
      )
    }
  }
}
