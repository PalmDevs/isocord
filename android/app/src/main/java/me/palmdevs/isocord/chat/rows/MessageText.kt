package me.palmdevs.isocord.chat.rows

import android.net.Uri
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.InlineTextContent
import androidx.compose.foundation.text.appendInlineContent
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.TileMode
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.Placeholder
import androidx.compose.ui.text.PlaceholderVerticalAlign
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withLink
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.isSpecified
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import me.palmdevs.isocord.R
import me.palmdevs.isocord.chat.ChatFonts
import me.palmdevs.isocord.chat.fadeCut
import me.palmdevs.isocord.chat.holdsLink
import me.palmdevs.isocord.chat.list.LocalChatActions
import me.palmdevs.isocord.chat.list.LocalChatFonts
import me.palmdevs.isocord.chat.list.LocalChatTheme
import me.palmdevs.isocord.chat.media.cachedPainter
import me.palmdevs.isocord.core.LinkKind
import me.palmdevs.isocord.core.Links
import me.palmdevs.isocord.notifications.notify.title

/** A stretch of message content that is laid out as one block. */
private sealed interface Segment {
  /** [list] is the nesting depth of a list item, [bullet] its marker run (null after a nested list). */
  data class Text(
    val spans: List<Span>,
    val quote: Boolean,
    val heading: Int,
    val subtext: Boolean,
    val list: Int,
    val bullet: Span?,
  ) : Segment

  /** One code block: its runs differ only in syntax colour. */
  data class Code(val spans: List<Span>) : Segment
}

/** Splits content at code blocks, headings, list items and the edges of block quotes, which are laid out as blocks. */
private fun segment(spans: List<Span>): List<Segment> {
  val segments = ArrayList<Segment>()
  var run = ArrayList<Span>()
  var runQuote = false
  var runHeading = 0
  var runSubtext = false
  var runList = 0
  var runBullet: Span? = null
  var code = ArrayList<Span>()
  fun flush() {
    if (run.isEmpty()) return
    segments.add(Segment.Text(run, runQuote, runHeading, runSubtext, runList, runBullet))
    run = ArrayList()
    runBullet = null
  }
  fun flushCode() {
    if (code.isNotEmpty()) segments.add(Segment.Code(code))
    code = ArrayList()
  }
  for (span in spans) {
    if (span.block) {
      flush()
      code.add(span)
      continue
    }
    flushCode()
    if (span.bullet) {
      flush()
      runQuote = span.quote
      runList = span.list
      runBullet = span
      continue
    }
    if (span.quote != runQuote || span.heading != runHeading || span.subtext != runSubtext || span.list != runList) flush()
    runQuote = span.quote
    runHeading = span.heading
    runSubtext = span.subtext
    runList = span.list
    run.add(span)
  }
  flush()
  flushCode()
  return segments
}

/** Returns the newlines of the segment at [index] if it only separates two list items, else 0. */
private fun blankLinesBetweenLists(segments: List<Segment>, index: Int): Int {
  val segment = segments[index] as? Segment.Text ?: return 0
  if (segment.list > 0 || segment.quote || segment.heading > 0 || segment.subtext) return 0
  if (!segments.getOrNull(index - 1).isListItem() || !segments.getOrNull(index + 1).isListItem()) return 0
  if (!segment.spans.all { it.text.all { c -> c == '\n' } }) return 0
  return segment.spans.sumOf { it.text.length }
}

private fun Segment?.isListItem() = this is Segment.Text && list > 0

/** Font size and line height of heading levels 1 to 3: heading-xl, heading-lg and heading-md. */
private val HEADING_SIZES = mapOf(1 to (24.sp to 32.sp), 2 to (20.sp to 24.sp), 3 to (16.sp to 20.sp))

/** Subtext is text-sm/normal in the muted colour. */
private val SUBTEXT_SIZE = 14.sp to 18.sp

private const val SPOILER_EMOJI = "spoiler-emoji"

/** The link tag of a hidden spoiler, which a tap reveals. */
private const val SPOILER_TAG = "spoiler"

/** Text sits in the middle of its line box, so lines keep an even rhythm whatever they contain. */
private val CENTERED = LineHeightStyle(LineHeightStyle.Alignment.Center, LineHeightStyle.Trim.None)

/** Message body: markdown runs, custom emoji, block quotes and code blocks. */
@Composable
fun MessageText(
  content: List<Span>,
  jumbo: Boolean = false,
  edited: String? = null,
  fontSize: TextUnit = 16.sp,
  lineHeight: TextUnit = 22.sp,
  /** Search results: the text is cut after this many lines (each block of text on its own, then the whole). */
  maxLines: Int = Int.MAX_VALUE,
) {
  val theme = LocalChatTheme.current
  val fonts = LocalChatFonts.current
  val segments = remember(content) { segment(content) }
  // Text-md at medium weight, as the official app draws message text; emoji-only messages are drawn at three times the size.
  val base = TextStyle(
    color = theme.textDefault,
    fontFamily = fonts.sans,
    fontWeight = FontWeight.Medium,
    fontSize = if (jumbo) 40.sp else fontSize,
    lineHeight = if (jumbo) 52.sp else lineHeight,
    lineHeightStyle = CENTERED,
  )

  val clamped = maxLines != Int.MAX_VALUE
  val density = LocalDensity.current
  // Headings and their spacers are taller than a line, so the clamp can cut mid-line. It fades like the preview's cut.
  Column(if (clamped) Modifier.fadeCut(with(density) { (lineHeight * maxLines).toDp() }) else Modifier) {
    // The trailing spacer of the previous segment, which collapses with the next one's leading spacer.
    var trailing = 0.dp
    segments.forEachIndexed { index, segment ->
      val heading = (segment as? Segment.Text)?.heading?.takeIf { it in HEADING_SIZES }
      val leading = when {
        heading == null -> 0.dp
        index > 0 -> HEADING_SPACE_BEFORE
        else -> HEADING_SPACE_AFTER
      }
      val gap = maxOf(trailing, leading)
      if (gap > 0.dp) SpacerLine(gap, base)
      when (segment) {
        is Segment.Code -> CodeBlock(segment.spans, base)
        is Segment.Text -> {
          val blank = blankLinesBetweenLists(segments, index)
          // Each newline here is an empty line: the list before it already ended its own.
          if (blank > 0) repeat(blank) { BasicText("", style = base) }
          else TextSegment(segment, base, jumbo, edited.takeIf { index == segments.lastIndex }, maxLines)
        }
      }
      trailing = if (heading != null) HEADING_SPACE_AFTER else 0.dp
    }
    // Not when clamped: a cut blank spacer would fade a heading that is shown whole.
    if (trailing > 0.dp && !clamped) SpacerLine(trailing, base)
    // Text takes the label at its end; after a code block it goes on its own line.
    if (edited != null && segments.lastOrNull() is Segment.Code) {
      BasicText(edited, style = base.copy(color = theme.textMuted, fontSize = 10.sp))
    }
  }
}

/**
 * Spacer lines around a heading (TextUtilsKt.toSpannable, HeadingContentNode): 8dp before one that follows content,
 * 4dp before one that starts the message, 4dp after. Neighbouring spacers keep the larger size
 * (ensureTrailingSpacerNewLineOfSize). Message content leaves shouldOmitTopAndBottomHeadingSpacerNewLine off.
 */
private val HEADING_SPACE_BEFORE = 8.dp
private val HEADING_SPACE_AFTER = 4.dp

/**
 * Draws a spacer line: an empty line whose font size is [size] (VerticalSpacerSpan, an AbsoluteSizeSpan).
 * It is as tall as the font's ascent and descent at that size, so about a third taller than [size].
 */
@Composable
private fun SpacerLine(size: Dp, base: TextStyle) {
  val fontSize = with(LocalDensity.current) { size.toSp() }
  BasicText("", style = base.copy(fontSize = fontSize, lineHeight = TextUnit.Unspecified))
}

/** A run of text laid out as one block: plain, a heading, subtext, a list item, inside a block quote or not. */
@Composable
private fun TextSegment(segment: Segment.Text, base: TextStyle, jumbo: Boolean, edited: String?, maxLines: Int) {
  val theme = LocalChatTheme.current
  val heading = HEADING_SIZES[segment.heading]
  val style = when {
    heading != null -> base.copy(color = theme.textStrong, fontSize = heading.first, lineHeight = heading.second)
    segment.subtext -> base.copy(color = theme.textMuted, fontSize = SUBTEXT_SIZE.first, lineHeight = SUBTEXT_SIZE.second)
    else -> base
  }
  val text = @Composable {
    if (segment.list > 0) {
      ListItem(segment, style) { StyledText(segment.spans, style, jumbo, edited, maxLines) }
    } else {
      StyledText(segment.spans, style, jumbo, edited, maxLines)
    }
  }
  if (!segment.quote) return text()
  Box(
    Modifier
      .drawBehind {
        drawRoundRect(theme.quoteBar, size = Size(4.dp.toPx(), size.height), cornerRadius = CornerRadius(2.dp.toPx()))
      }
      .padding(start = 16.dp),
  ) { text() }
}

/** Indent of each list nesting level (appendBulletPoint's LeadingMarginSpan.Standard). */
private val LIST_LEVEL_INDENT = 16.dp

/** Space above and below a list item (appendBulletPoint's VerticalPaddingSpan). */
private val LIST_ITEM_PADDING = 2.dp

/** Space between a list marker and the item's text (appendBulletPoint's gap and trailing margin). */
private val LIST_MARKER_GAP = 8.dp

/** BulletSpan's radius, drawn 1.2 times larger on hardware canvases, and its ring's stroke in pixels. */
private val BULLET_RADIUS = 2.dp
private const val BULLET_HARDWARE_SCALE = 1.2f
private const val BULLET_STROKE_PX = 4f

/** A list item: indented by its depth, its marker hanging in the margin before the text. */
@Composable
private fun ListItem(segment: Segment.Text, style: TextStyle, content: @Composable () -> Unit) {
  Row(Modifier.padding(start = LIST_LEVEL_INDENT * (segment.list - 1), top = LIST_ITEM_PADDING, bottom = LIST_ITEM_PADDING)) {
    segment.bullet?.let { ListMarker(it, style) }
    content()
  }
}

/**
 * A list item's marker. Bullets are BulletSpan: a dot filled at the top level and a ring below it.
 * Numbers are OrderedListBulletSpan: tabular figures right-aligned to the list's largest number.
 */
@Composable
private fun ListMarker(bullet: Span, style: TextStyle) {
  val number = bullet.number
  if (number != null) {
    val figures = style.copy(fontFeatureSettings = "tnum")
    Box(Modifier.padding(end = LIST_MARKER_GAP), contentAlignment = Alignment.TopEnd) {
      BasicText("${bullet.lastNumber ?: number}.", style = figures.copy(color = Color.Transparent))
      BasicText("$number.", style = figures)
    }
    return
  }
  val color = LocalChatTheme.current.listBullet
  val lineHeight = with(LocalDensity.current) { style.lineHeight.toDp() }
  Canvas(Modifier.size(BULLET_RADIUS * 2 + LIST_MARKER_GAP, lineHeight)) {
    val radius = BULLET_RADIUS.toPx() * BULLET_HARDWARE_SCALE
    drawCircle(
      color,
      radius,
      center = Offset(radius, size.height / 2),
      style = if (bullet.list > 1) Stroke(BULLET_STROKE_PX) else Fill,
    )
  }
}

/** Code block text relative to the surrounding text (CodeStyle.renderCodeBlock's RelativeSizeSpan). */
private const val CODE_BLOCK_SCALE = 0.85f

@Composable
private fun CodeBlock(spans: List<Span>, base: TextStyle) {
  val theme = LocalChatTheme.current
  val density = LocalDensity.current
  // Scaled in px like the reference's span, so it keeps the ratio at any zoom level.
  val fontSize = with(density) { (base.fontSize.toPx() * CODE_BLOCK_SCALE).toSp() }
  val lineHeight = with(density) { (base.lineHeight.toPx() * CODE_BLOCK_SCALE).toSp() }
  val shape = RoundedCornerShape(4.dp)
  var revealed by remember(spans) { mutableStateOf(false) }
  val hidden = !revealed && spans.any { it.spoiler }
  val text = remember(spans, theme, hidden) {
    buildAnnotatedString {
      spans.forEachIndexed { index, span ->
        val color = when {
          hidden -> Color.Transparent
          else -> when (span.token) {
            "keyword" -> theme.syntaxKeyword
            "string" -> theme.syntaxString
            "number" -> theme.syntaxNumber
            "comment" -> theme.syntaxComment
            "title" -> theme.syntaxTitle
            "meta" -> theme.syntaxMeta
            else -> Color.Unspecified
          }
        }
        withStyle(SpanStyle(color = color)) { append(if (index == spans.lastIndex) span.text.trimEnd('\n') else span.text) }
      }
    }
  }
  BasicText(
    text = text,
    style = TextStyle(
      color = theme.textDefault,
      fontFamily = LocalChatFonts.current.mono,
      fontSize = fontSize,
      lineHeight = lineHeight,
      lineHeightStyle = CENTERED,
    ),
    modifier = Modifier
      .padding(vertical = 4.dp)
      .fillMaxWidth()
      .background(if (hidden) theme.spoilerBackground else theme.codeBackground, shape)
      .border(1.dp, theme.codeBorder, shape)
      .then(if (hidden) Modifier.clickable(interactionSource = null, indication = null) { revealed = true } else Modifier)
      .padding(8.dp),
  )
}

@Composable
private fun StyledText(spans: List<Span>, base: TextStyle, jumbo: Boolean, edited: String?, maxLines: Int) {
  val theme = LocalChatTheme.current
  val fonts = LocalChatFonts.current
  val actions = LocalChatActions.current
  val density = LocalDensity.current
  var spoilersRevealed by remember(spans) { mutableStateOf(false) }

  val text = remember(spans, theme, edited, spoilersRevealed, density) {
    buildSpanText(
      spans, theme, fonts, base.fontSize, edited, spoilersRevealed,
      density,
      onLink = { actions.onLinkPress(it) },
      onSpoiler = { spoilersRevealed = true },
    )
  }
  if (text.isEmpty()) return

  // Slightly taller than the letters, but never taller than the line, which would push lines apart.
  val emojiSize = if (jumbo) 48.sp else base.fontSize * 1.25f
  val inline = remember(spans, emojiSize, theme, base.lineHeight) { spanInlineContent(spans, emojiSize, theme, base.lineHeight) }
  val layout = remember { arrayOfNulls<TextLayoutResult>(1) }
  BasicText(
    text = text,
    style = base,
    inlineContent = inline,
    maxLines = maxLines,
    overflow = if (maxLines == Int.MAX_VALUE) TextOverflow.Clip else TextOverflow.Ellipsis,
    onTextLayout = { layout[0] = it },
    modifier = Modifier.holdsLink { position ->
      layout[0]?.let { heldLinkAt(text, it, position, with(density) { HELD_LINK_SLOP.toPx() }) }
    },
  )
}

/** Returns the `inline-code` link of a code span's text. */
private fun inlineCodeLink(code: String) = "${Links.SCHEME}${LinkKind.INLINE_CODE}/${Uri.encode(code)}"

/**
 * Returns the link under [position], or null off the text and on spoilers and inline code, which a long press
 * leaves to the message.
 */
private fun heldLinkAt(text: AnnotatedString, layout: TextLayoutResult, position: Offset, slop: Float): String? {
  // getOffsetForPosition returns the text length past the last character, which getBoundingBox rejects.
  val length = layout.layoutInput.text.length
  if (length == 0) return null
  val offset = layout.getOffsetForPosition(position).coerceAtMost(length - 1)
  if (!layout.getBoundingBox(offset).inflate(slop).contains(position)) return null
  val tag = text.getLinkAnnotations(offset, offset + 1).firstNotNullOfOrNull { (it.item as? LinkAnnotation.Clickable)?.tag }
  return tag?.takeUnless { it == SPOILER_TAG || it.startsWith("${Links.SCHEME}${LinkKind.INLINE_CODE}/") }
}

/** How far around a character a finger still holds it. */
private val HELD_LINK_SLOP = 8.dp

/**
 * The spans of a message as styled text: mentions, spoilers, links, emoji placeholders, inline markup.
 * Shared by the message body and the reply preview.
 * Links and hidden spoilers are tappable via `onLink` and `onSpoiler`, unless null. Then the owner takes the taps.
 */
internal fun buildSpanText(
  spans: List<Span>,
  theme: ChatTheme,
  fonts: ChatFonts,
  baseSize: TextUnit,
  edited: String?,
  spoilersRevealed: Boolean,
  density: Density,
  onLink: ((String) -> Unit)?,
  onSpoiler: (() -> Unit)?,
): AnnotatedString = buildAnnotatedString {
  // A trailing line break (left by headings and quotes) would add an empty line.
  spans.forEachIndexed { index, span ->
    val hidden = span.spoiler && !spoilersRevealed
    if (span.emoji != null) {
      // A hidden spoiler covers emoji with a plain block; tapping it reveals the whole message part.
      if (hidden) {
        if (onSpoiler != null) {
          withLink(LinkAnnotation.Clickable(SPOILER_TAG) { onSpoiler() }) { appendInlineContent(SPOILER_EMOJI, span.text) }
        } else {
          appendInlineContent(SPOILER_EMOJI, span.text)
        }
      } else if (span.link != null && onLink != null) {
        // A tapped emoji opens its info sheet (MessageEmojiActionSheet), or the link it is part of.
        val url = span.link
        withLink(LinkAnnotation.Clickable(url) { onLink(url) }) { appendInlineContent(span.emoji, span.text) }
      } else {
        appendInlineContent(span.emoji, span.text)
      }
      return@forEachIndexed
    }
    // Enhanced role colours: the mention's text takes the gradient, the pill keeps the primary colour.
    val gradient = span.mention && !hidden && span.colors.size >= 2
    val style = SpanStyle(
      color = when {
        hidden -> Color.Transparent
        gradient -> Color.Unspecified
        span.mention -> span.color ?: theme.mentionForeground
        span.timestamp -> Color.Unspecified
        span.link != null -> theme.textLink
        span.highlight -> theme.textStrong
        else -> Color.Unspecified
      },
      background = when {
        span.spoiler -> if (hidden) theme.spoilerBackground else theme.cardBackground
        span.highlight -> theme.searchHighlight
        // The reference tints a role mention with its colour at 10%.
        span.mention -> span.color?.copy(alpha = 0.1f) ?: theme.mentionBackground
        span.timestamp -> theme.separator
        span.code -> theme.codeBackground
        else -> Color.Unspecified
      },
      // The body is a step heavier than text-md/normal to match the official app; links keep the normal weight.
      fontWeight = when {
        span.bold -> FontWeight.Bold
        span.mention -> FontWeight.SemiBold
        span.timestamp -> null
        span.link != null -> FontWeight.Normal
        else -> null
      },
      fontStyle = if (span.italic) FontStyle.Italic else null,
      fontFamily = if (span.code) fonts.mono else null,
      fontSize = if (span.code) baseSize * 0.875f else TextUnit.Unspecified,
      textDecoration = TextDecoration.combine(
        listOfNotNull(
          TextDecoration.Underline.takeIf { span.underline },
          TextDecoration.LineThrough.takeIf { span.strike },
        ),
      ),
    ).let { if (gradient) it.merge(SpanStyle(brush = gradientBrush(span, baseSize, density))) else it }
    val body = if (index == spans.lastIndex) span.text.trimEnd('\n') else span.text
    // A mention icon is an inline placeholder (a hidden spoiler covers it with a plain block).
    val icon = span.icon?.takeIf { mentionIcon(it) != null }
    val emit: AnnotatedString.Builder.() -> Unit = when {
      icon == null -> {{ append(body) }}
      hidden -> {{ appendInlineContent(SPOILER_EMOJI, span.text) }}
      else -> {{ appendInlineContent("$ICON_PREFIX$icon", span.text) }}
    }
    when {
      hidden && onSpoiler != null -> withLink(LinkAnnotation.Clickable(SPOILER_TAG, TextLinkStyles(style)) { onSpoiler() }) { emit() }
      span.link != null && onLink != null -> {
        val url = span.link
        withLink(LinkAnnotation.Clickable(url, TextLinkStyles(style)) { onLink(url) }) { emit() }
      }
      // A tap on inline code copies it (onTapInlineCode).
      span.code && !hidden && onLink != null -> {
        val url = inlineCodeLink(span.text)
        withLink(LinkAnnotation.Clickable(url, TextLinkStyles(style)) { onLink(url) }) { emit() }
      }
      else -> withStyle(style) { emit() }
    }
  }
  if (edited != null) {
    withStyle(SpanStyle(color = theme.textMuted, fontSize = 10.sp)) { append(" $edited") }
  }
}

private const val ICON_PREFIX = "icon:"

/**
 * The gradient of a role mention. A span's brush is laid over the whole paragraph, so it is mirrored over the width
 * the mention's text is estimated to take (about 0.55 em a letter) to show the colours across the mention itself.
 */
private fun gradientBrush(span: Span, baseSize: TextUnit, density: Density): Brush {
  val width = with(density) { baseSize.toPx() } * 0.55f * span.text.length
  return Brush.horizontalGradient(span.colors, startX = 0f, endX = width.coerceAtLeast(1f), tileMode = TileMode.Mirror)
}

/** The drawable of a mention icon: the reference's channel type icons, the message bubble and the route icons. */
internal fun mentionIcon(name: String): Int? = when (name) {
  "text" -> R.drawable.mention_text
  "announcement" -> R.drawable.mention_announcement
  "forum" -> R.drawable.mention_forum
  "media" -> R.drawable.mention_media
  "thread" -> R.drawable.mention_thread
  "post", "message" -> R.drawable.mention_message
  "voice" -> R.drawable.mention_voice
  "stage" -> R.drawable.mention_stage
  "home", "guide" -> R.drawable.mention_home
  "browse", "customize" -> R.drawable.mention_browse
  "linked-roles" -> R.drawable.mention_linked_roles
  "caret" -> R.drawable.mention_caret
  else -> null
}

/** Returns a mention icon's width over its height: the reference pads it by 2 after (none after # and the caret). */
internal fun mentionIconWidth(name: String): Float = when (name) {
  "text" -> 1f
  "caret" -> 0.75f
  else -> 1.125f
}

/**
 * The images behind the emoji and mention icon placeholders of [buildSpanText].
 * A placeholder gets no span background, so a mention icon draws its pill over [lineHeight], or its own height if unspecified.
 */
internal fun spanInlineContent(
  spans: List<Span>,
  emojiSize: TextUnit,
  theme: ChatTheme,
  lineHeight: TextUnit = TextUnit.Unspecified,
): Map<String, InlineTextContent> {
  // The icons are as tall as the text; emoji are a quarter taller.
  val iconSize = emojiSize * 0.8f
  val icons = spans.mapNotNull { it.icon }.distinct().mapNotNull { name ->
    val resource = mentionIcon(name) ?: return@mapNotNull null
    val width = iconSize * mentionIconWidth(name)
    "$ICON_PREFIX$name" to InlineTextContent(Placeholder(width, iconSize, PlaceholderVerticalAlign.TextCenter)) {
      Box(
        Modifier.fillMaxSize().drawBehind {
          // Icons only lead channel, message and route mentions, which never take a role colour.
          val height = if (lineHeight.isSpecified) lineHeight.toPx() else size.height
          drawRect(theme.mentionBackground, Offset(0f, (size.height - height) / 2), Size(size.width, height))
        },
      ) {
        Image(
          painter = cachedPainter(resource),
          contentDescription = null,
          colorFilter = ColorFilter.tint(theme.mentionForeground),
          modifier = Modifier.fillMaxHeight().aspectRatio(1f),
        )
      }
    }
  }.toMap()
  val images = spans.mapNotNull { it.emoji }.distinct().associateWith { url ->
    InlineTextContent(Placeholder(emojiSize, emojiSize, PlaceholderVerticalAlign.TextCenter)) { name ->
      AsyncImage(model = url, contentDescription = name, modifier = Modifier.fillMaxSize())
    }
  }
  return icons + images + (SPOILER_EMOJI to InlineTextContent(Placeholder(emojiSize, emojiSize, PlaceholderVerticalAlign.TextCenter)) {
    Box(Modifier.fillMaxSize().background(theme.spoilerBackground, RoundedCornerShape(4.dp)))
  })
}
