package me.palmdevs.isocord.chat.rows.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import me.palmdevs.isocord.R
import me.palmdevs.isocord.chat.chatPress
import me.palmdevs.isocord.chat.list.LocalChatActions
import me.palmdevs.isocord.chat.list.LocalChatFonts
import me.palmdevs.isocord.chat.list.LocalChatTheme
import me.palmdevs.isocord.chat.media.cachedPainter
import me.palmdevs.isocord.chat.rows.Component
import me.palmdevs.isocord.chat.rows.SelectedOption

/** message_component_select_view: an input-styled field, 40dp minimum with 8dp padding and corners. */
private val SELECT_SHAPE = RoundedCornerShape(8.dp)
private val SELECT_MIN_HEIGHT = 40.dp
/** message_component_select_pill_view: a picked option of a multiple select. */
private val PILL_SHAPE = RoundedCornerShape(8.dp)
/** SelectComponentView: a disabled select is drawn at 30%. */
private const val DISABLED_ALPHA = 0.3f

/**
 * SelectComponentView: the placeholder, the one option picked with its icon, or pills for several, then a chevron.
 * Dots replace the chevron while its interaction runs.
 */
@Composable
internal fun ComponentSelect(c: Component) {
  val theme = LocalChatTheme.current
  val actions = LocalChatActions.current
  val url = c.url
  Row(
    verticalAlignment = Alignment.CenterVertically,
    modifier = Modifier
      .fillMaxWidth()
      .heightIn(min = SELECT_MIN_HEIGHT)
      .alpha(if (c.disabled) DISABLED_ALPHA else 1f)
      .clip(SELECT_SHAPE)
      .background(theme.inputBackground)
      .border(1.dp, theme.inputBorder, SELECT_SHAPE)
      .then(if (url != null) Modifier.chatPress(onClick = { actions.onLinkPress(url) }) else Modifier)
      .padding(8.dp),
  ) {
    Box(Modifier.weight(1f).padding(end = 8.dp)) {
      if (c.multi && c.selected.isNotEmpty()) SelectPills(c.selected) else SelectText(c)
    }
    Box(contentAlignment = Alignment.Center) {
      Image(
        painter = cachedPainter(R.drawable.component_chevron_small_right),
        contentDescription = null,
        colorFilter = ColorFilter.tint(theme.textSubtle),
        modifier = Modifier.size(20.dp).alpha(if (c.loading) 0f else 1f),
      )
      if (c.loading) LoadingDots()
    }
  }
}

/** The placeholder, or the one option picked after its emoji or avatar. */
@Composable
private fun SelectText(c: Component) {
  val theme = LocalChatTheme.current
  val picked = c.selected.firstOrNull()
  Row(verticalAlignment = Alignment.CenterVertically) {
    picked?.let { OptionIcon(it) }
    BasicText(
      picked?.label ?: c.label.orEmpty(),
      maxLines = 1,
      overflow = TextOverflow.Ellipsis,
      style = TextStyle(
        color = theme.textDefault,
        fontFamily = LocalChatFonts.current.sans,
        fontWeight = FontWeight.Medium,
        fontSize = 16.sp,
        lineHeight = 20.sp,
      ),
    )
  }
}

/** select_component_selection_icon: 20dp before the label, round for a user. */
@Composable
private fun OptionIcon(option: SelectedOption) {
  val modifier = Modifier.padding(end = 8.dp).size(20.dp)
  when {
    option.emojiUrl != null -> AsyncImage(
      model = option.emojiUrl,
      contentDescription = null,
      modifier = if (option.round) modifier.clip(CircleShape) else modifier,
    )
    option.emoji != null -> BasicText(option.emoji, style = TextStyle(fontSize = 17.sp, lineHeight = 20.sp), modifier = modifier)
  }
}

/** setSelectedOptions: each pick on a subtle pill in the strong text colour. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SelectPills(selected: List<SelectedOption>) {
  val theme = LocalChatTheme.current
  val fonts = LocalChatFonts.current
  FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
    selected.forEach {
      BasicText(
        it.label,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        style = TextStyle(color = theme.textStrong, fontFamily = fonts.sans, fontWeight = FontWeight.Medium, fontSize = 14.sp, lineHeight = 18.sp),
        modifier = Modifier.background(theme.cardBackground, PILL_SHAPE).padding(horizontal = 12.dp, vertical = 4.dp),
      )
    }
  }
}
