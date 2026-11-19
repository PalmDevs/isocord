@file:UseSerializers(ArgbColorSerializer::class)

package me.palmdevs.isocord.chat.rows

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.serialization.Serializable
import kotlinx.serialization.UseSerializers
import me.palmdevs.isocord.R
import me.palmdevs.isocord.chat.chatPress
import me.palmdevs.isocord.chat.list.LocalChatFonts
import me.palmdevs.isocord.chat.list.LocalChatTheme
import me.palmdevs.isocord.chat.media.TileSpoilerCover
import me.palmdevs.isocord.chat.media.cachedPainter
import me.palmdevs.isocord.chat.rows.components.ComponentButton
import me.palmdevs.isocord.chat.rows.components.ComponentFile
import me.palmdevs.isocord.chat.rows.components.ComponentGallery
import me.palmdevs.isocord.chat.rows.components.ComponentSelect
import me.palmdevs.isocord.chat.rows.components.ComponentThumbnail

/** A select's picked option (`SelectedOptionRow` in rows.ts). */
@Immutable
@Serializable
data class SelectedOption(
  val label: String = "",
  val emoji: String? = null,
  val emojiUrl: String? = null,
  /** A user's avatar: drawn round. */
  val round: Boolean = false,
)

/** One node of a message's components tree (`ComponentRow` in rows.ts). */
@Immutable
@Serializable
data class Component(
  val type: String = "",
  val style: String? = null,
  val label: String? = null,
  val emoji: String? = null,
  val emojiUrl: String? = null,
  val disabled: Boolean = false,
  /** ActionComponentState.LOADING: dots replace the label. */
  val loading: Boolean = false,
  /** The tap: a web page, or an `isocord://component` link. Null: not tappable. */
  val url: String? = null,
  /** Rows and sections: why an interaction inside failed. */
  val errorText: String? = null,
  val selected: List<SelectedOption> = emptyList(),
  /** Selects with more than one pick: the picks are pills. */
  val multi: Boolean = false,
  val spans: List<Span> = emptyList(),
  val color: Color? = null,
  val divider: Boolean = false,
  /** SeparatorSpacingSize: `small` or `large`. */
  val spacing: String = SPACING_SMALL,
  /** Containers: the "SPOILER" label while hidden. */
  val spoiler: String? = null,
  val children: List<Component> = emptyList(),
  /** Section accessory: a `thumbnail` or a `button`. */
  val accessory: Component? = null,
  /** Galleries and thumbnails: the component id their media links name; -1 when none. */
  val mediaId: Int = -1,
  /** Gallery items, and a thumbnail's or file's media. */
  val items: List<Attachment> = emptyList(),
)

private const val SPACING_SMALL = "small"
private const val SPACING_LARGE = "large"

/** The gap between components, in a message and in a container (MessageComponentsView's replaceViews). */
private val COMPONENT_GAP = 8.dp

/** message_media_non_mosaic_radius: a container's corners. */
private val CONTAINER_SHAPE = RoundedCornerShape(8.dp)

/** SectionComponentView: a button that takes more than this share of the width goes under the text. */
private const val INLINE_ACCESSORY_SHARE = 0.35f

/** The message whose components these are: their media opens in the viewer through it. */
internal val LocalComponentsMessage = staticCompositionLocalOf<String?> { null }

@Composable
fun ComponentsView(components: List<Component>, messageId: String) {
  CompositionLocalProvider(LocalComponentsMessage provides messageId) {
    Column(Modifier.padding(top = 4.dp), verticalArrangement = Arrangement.spacedBy(COMPONENT_GAP)) {
      components.forEach { ComponentView(it, inContainer = false) }
    }
  }
}

/** [inContainer]: inside a container component, whose text is smaller (TextDisplayComponentView.configure). */
@Composable
private fun ComponentView(c: Component, inContainer: Boolean) {
  when (c.type) {
    "row" -> ActionRowView(c, inContainer)
    "button" -> ComponentButton(c)
    "select" -> ComponentSelect(c)
    "container" -> ContainerView(c)
    "section" -> SectionView(c, inContainer)
    "text" -> if (inContainer) MessageText(c.spans, fontSize = 14.sp, lineHeight = 18.sp) else MessageText(c.spans)
    "thumbnail" -> ComponentThumbnail(c)
    "gallery" -> ComponentGallery(c)
    "separator" -> SeparatorView(c)
    "file" -> ComponentFile(c)
  }
}

/** ActionRowComponentView: its buttons wrap 8dp apart; a select takes the whole line. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ActionRowView(c: Component, inContainer: Boolean) {
  Column {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(COMPONENT_GAP), verticalArrangement = Arrangement.spacedBy(COMPONENT_GAP)) {
      c.children.forEach { ComponentView(it, inContainer) }
    }
    c.errorText?.let { FailedLabel(it) }
  }
}

/** component_failed_label_view: CircleErrorIcon and the reason, in the critical feedback colour. */
@Composable
private fun FailedLabel(text: String) {
  val theme = LocalChatTheme.current
  Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 8.dp)) {
    Image(
      painter = cachedPainter(R.drawable.system_circle_error),
      contentDescription = null,
      colorFilter = ColorFilter.tint(theme.feedbackCritical),
      modifier = Modifier.size(12.dp),
    )
    BasicText(
      text,
      style = TextStyle(color = theme.feedbackCritical, fontFamily = LocalChatFonts.current.sans, fontSize = 14.sp, lineHeight = 18.sp),
      modifier = Modifier.padding(start = 8.dp),
    )
  }
}

/**
 * ContainerComponentView: the embed background with a subtle border, a 4dp accent bar when it has a colour, and
 * 16dp padding. A spoiler covers it until tapped.
 */
@Composable
private fun ContainerView(c: Component) {
  val theme = LocalChatTheme.current
  var revealed by remember(c) { mutableStateOf(false) }
  Box(
    Modifier
      .fillMaxWidth()
      .clip(CONTAINER_SHAPE)
      .background(theme.embedBackground)
      .border(1.dp, theme.codeBorder, CONTAINER_SHAPE),
  ) {
    Column(
      Modifier
        .fillMaxWidth()
        .drawBehind { c.color?.let { drawRect(it, size = Size(4.dp.toPx(), size.height)) } }
        .padding(16.dp),
      verticalArrangement = Arrangement.spacedBy(COMPONENT_GAP),
    ) { c.children.forEach { ComponentView(it, inContainer = true) } }
    if (c.spoiler != null && !revealed) {
      Box(Modifier.matchParentSize().chatPress(onClick = { revealed = true })) { TileSpoilerCover(c.spoiler, 1f) }
    }
  }
}

/**
 * SectionComponentView: its texts 4dp apart with the accessory beside them. A thumbnail always sits at the end. A
 * button does too unless it takes over 35% of the width, then it goes under the texts.
 */
@Composable
private fun SectionView(c: Component, inContainer: Boolean) {
  val accessory = c.accessory ?: return
  val gap = with(LocalDensity.current) { 12.dp.roundToPx() }
  val rowGap = with(LocalDensity.current) { COMPONENT_GAP.roundToPx() }
  val thumbnail = accessory.type == "thumbnail"
  Column {
    Layout(
      content = {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) { c.children.forEach { ComponentView(it, inContainer) } }
        ComponentView(accessory, inContainer)
      },
    ) { measurables, constraints ->
      val loose = constraints.copy(minWidth = 0, minHeight = 0)
      val side = measurables[1].measure(loose)
      val inline = thumbnail || side.width <= constraints.maxWidth * INLINE_ACCESSORY_SHARE
      val textWidth = if (inline) (constraints.maxWidth - side.width - gap).coerceAtLeast(0) else constraints.maxWidth
      val text = measurables[0].measure(Constraints(maxWidth = textWidth))
      if (inline) {
        val height = maxOf(text.height, side.height)
        layout(constraints.maxWidth, height) {
          text.place(0, 0)
          // A thumbnail keeps to the top. A button is centred on the text.
          side.place(constraints.maxWidth - side.width, if (thumbnail) 0 else (height - side.height) / 2)
        }
      } else {
        layout(constraints.maxWidth, text.height + rowGap + side.height) {
          text.place(0, 0)
          side.place(0, text.height + rowGap)
        }
      }
    }
    c.errorText?.let { FailedLabel(it) }
  }
}

/** SeparatorDisplayComponentView: a 1px line in the muted text colour, with 8dp more space around it when large. */
@Composable
private fun SeparatorView(c: Component) {
  val theme = LocalChatTheme.current
  val line = with(LocalDensity.current) { 1.toDp() }
  Box(
    Modifier
      .padding(vertical = if (c.spacing == SPACING_LARGE) COMPONENT_GAP else 0.dp)
      .fillMaxWidth()
      .height(if (c.divider) line else 0.dp)
      .background(if (c.divider) theme.textMuted else Color.Transparent),
  )
}
