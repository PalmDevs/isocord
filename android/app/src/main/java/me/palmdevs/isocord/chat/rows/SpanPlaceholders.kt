package me.palmdevs.isocord.chat.rows

import android.content.res.Resources
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.text.InlineTextContent
import androidx.compose.foundation.text.appendInlineContent
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.Placeholder
import androidx.compose.ui.text.PlaceholderVerticalAlign
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.isSpecified
import coil3.compose.AsyncImage
import kotlin.math.roundToInt
import me.palmdevs.isocord.chat.media.resourceBitmap

/** The placeholder id of a hidden spoiler's emoji or mention icon. */
internal const val SPOILER_EMOJI = "spoiler-emoji"

/** The placeholder id prefix of a mention icon. Custom emoji use their URL. */
internal const val ICON_PREFIX = "icon:"

/** Our own tag on each placeholder, since Compose keeps the inline content tag internal. */
private const val PLACEHOLDER_TAG = "isocord.placeholder"

/** Appends an inline placeholder, tagged so [spanPlaceholderRanges] finds it outside a [BasicText]. */
internal fun AnnotatedString.Builder.appendPlaceholder(id: String, alternateText: String) {
  pushStringAnnotation(PLACEHOLDER_TAG, id)
  appendInlineContent(id, alternateText)
  pop()
}

/** Returns the placeholders of [buildSpanText] in [text], in order, each with its id. */
internal fun spanPlaceholderRanges(text: AnnotatedString): List<AnnotatedString.Range<String>> =
  text.getStringAnnotations(PLACEHOLDER_TAG, 0, text.length)

/** Returns the size of each emoji, mention icon and spoiler placeholder of [buildSpanText], by id. */
internal fun spanPlaceholders(spans: List<Span>, emojiSize: TextUnit): Map<String, Placeholder> {
  // The icons are as tall as the text. Emoji are a quarter taller.
  val iconSize = emojiSize * 0.8f
  val icons = spans.mapNotNull { it.icon }.distinct().filter { mentionIcon(it) != null }.associate { name ->
    "$ICON_PREFIX$name" to Placeholder(iconSize * mentionIconWidth(name), iconSize, PlaceholderVerticalAlign.TextCenter)
  }
  val emoji = Placeholder(emojiSize, emojiSize, PlaceholderVerticalAlign.TextCenter)
  return icons + spans.mapNotNull { it.emoji }.associateWith { emoji } + (SPOILER_EMOJI to emoji)
}

/** Returns whether a placeholder is a custom emoji, which the caller loads and draws itself. */
internal fun isEmojiPlaceholder(id: String) = id != SPOILER_EMOJI && !id.startsWith(ICON_PREFIX)

/**
 * Draws a mention icon or spoiler placeholder over this scope's size.
 * A placeholder gets no span background, so a mention icon draws its pill over [lineHeight], or its own height if unspecified.
 */
internal fun DrawScope.drawSpanPlaceholder(id: String, theme: ChatTheme, resources: Resources, lineHeight: TextUnit) {
  if (id == SPOILER_EMOJI) {
    drawRoundRect(theme.spoilerBackground, cornerRadius = CornerRadius(4.dp.toPx()))
    return
  }
  val resource = id.removePrefix(ICON_PREFIX).takeIf { it != id }?.let(::mentionIcon) ?: return
  // Icons only lead channel, message and route mentions, which never take a role colour.
  val pill = if (lineHeight.isSpecified) lineHeight.toPx() else size.height
  drawRect(theme.mentionBackground, Offset(0f, (size.height - pill) / 2), Size(size.width, pill))
  val side = size.height.roundToInt()
  drawImage(
    resourceBitmap(resources, resource),
    dstSize = IntSize(side, side),
    colorFilter = ColorFilter.tint(theme.mentionForeground),
  )
}

/** The images behind the placeholders of [buildSpanText], for a [BasicText]. */
internal fun spanInlineContent(
  spans: List<Span>,
  emojiSize: TextUnit,
  theme: ChatTheme,
  lineHeight: TextUnit = TextUnit.Unspecified,
): Map<String, InlineTextContent> = spanPlaceholders(spans, emojiSize).mapValues { (id, placeholder) ->
  InlineTextContent(placeholder) { name ->
    if (isEmojiPlaceholder(id)) {
      AsyncImage(model = id, contentDescription = name, modifier = Modifier.fillMaxSize())
    } else {
      val resources = LocalContext.current.resources
      Box(Modifier.fillMaxSize().drawBehind { drawSpanPlaceholder(id, theme, resources, lineHeight) })
    }
  }
}
