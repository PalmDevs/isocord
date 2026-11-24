package me.palmdevs.isocord.chat.rows

import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.style.TextOverflow
import me.palmdevs.isocord.chat.list.LocalChatFonts
import me.palmdevs.isocord.chat.list.LocalChatTheme

/** Inline emoji over the font size: slightly taller than the letters. */
internal const val INLINE_EMOJI_SCALE = 1.25f

/**
 * Inline markup spans (mentions, emoji, links) as one [BasicText], optionally after a [prefix].
 * Links and spoilers only react when [onLink] is given.
 */
@Composable
fun SpanText(
  spans: List<Span>,
  style: TextStyle,
  maxLines: Int = Int.MAX_VALUE,
  prefix: AnnotatedString? = null,
  onLink: ((String) -> Unit)? = null,
  modifier: Modifier = Modifier,
  onTextLayout: (TextLayoutResult) -> Unit = {},
) {
  val theme = LocalChatTheme.current
  val fonts = LocalChatFonts.current
  val density = LocalDensity.current
  var spoilersRevealed by remember(spans) { mutableStateOf(false) }
  val text = remember(spans, prefix, theme, style.fontSize, spoilersRevealed, density) {
    val body = buildSpanText(
      spans, theme, fonts, style.fontSize, null, spoilersRevealed, density,
      onLink = onLink,
      onSpoiler = if (onLink != null) ({ spoilersRevealed = true }) else null,
    )
    if (prefix == null) body else buildAnnotatedString { append(prefix); append(body) }
  }
  val inline = remember(spans, style.fontSize, theme) { spanInlineContent(spans, style.fontSize * INLINE_EMOJI_SCALE, theme) }
  BasicText(
    text = text,
    inlineContent = inline,
    maxLines = maxLines,
    overflow = TextOverflow.Ellipsis,
    style = style,
    modifier = modifier,
    onTextLayout = onTextLayout,
  )
}
