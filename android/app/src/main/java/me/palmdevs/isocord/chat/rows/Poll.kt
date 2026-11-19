package me.palmdevs.isocord.chat.rows

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.layout.layout
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import kotlinx.serialization.Serializable
import me.palmdevs.isocord.R
import me.palmdevs.isocord.chat.chatPress
import me.palmdevs.isocord.chat.list.LocalChatActions
import me.palmdevs.isocord.chat.list.LocalChatFonts
import me.palmdevs.isocord.chat.list.LocalChatTheme
import me.palmdevs.isocord.chat.media.cachedPainter

@Immutable
@Serializable
data class PollAnswer(
  val text: String = "",
  val emoji: String? = null,
  val emojiUrl: String? = null,
  /** "3 votes". */
  val votes: String = "",
  val percent: Int = 0,
  /** PollStyles' style set (`PollAnswerStyle` in rows.ts). */
  val style: String = NORMAL_VOTE,
  /** Picks the answer, or lists its voters. Null: not tappable. */
  val url: String? = null,
)

/** A poll's action (PollAction): `button`, `secondaryButton`, `textButton` or `text`. No url: disabled or plain. */
@Immutable
@Serializable
data class PollAction(val label: String = "", val presentation: String = TEXT, val url: String? = null)

@Immutable
@Serializable
data class Poll(
  val question: String = "",
  val hint: String? = null,
  val answers: List<PollAnswer> = emptyList(),
  /** PollChatAnswerInteractionType: `list`, `radio` or `checkbox`; checkboxes get squarer markers. */
  val interaction: String = "list",
  /** canShowVoteCounts: bars, percentages and counts are drawn. */
  val showResults: Boolean = false,
  val primary: PollAction? = null,
  val secondary: PollAction? = null,
  val tertiary: PollAction? = null,
)

private const val NORMAL_VOTE = "normalVote"
private const val TEXT = "text"
private const val CHECKBOX = "checkbox"

/** PollRadioStyle: how an answer's marker is drawn. */
private enum class Marker { NONE, HOLLOW, FILLED, CHECKMARK }

/** One of PollStyles' style sets: the border (none when null), the result bar and the marker. */
private data class AnswerLook(val border: Color?, val bar: Color, val marker: Marker, val markerBackground: Color, val markerForeground: Color)

/** PollStyles.pollStyleSets, by style name. */
private fun answerLook(style: String, theme: ChatTheme): AnswerLook = when (style) {
  "selected" -> AnswerLook(theme.pollBorderSelected, theme.pollBar, Marker.FILLED, theme.pollRadioSelected, theme.pollRadioMark)
  "voted" -> AnswerLook(theme.pollBorderSelected, theme.pollBarVoted, Marker.CHECKMARK, theme.pollRadioSelected, theme.pollRadioMark)
  "notVoted" -> AnswerLook(null, theme.pollBarNotVoted, Marker.NONE, theme.pollRadio, theme.pollRadioMark)
  "victorNotSelected" -> AnswerLook(theme.pollBorderVictor, theme.pollBarVictor, Marker.NONE, theme.pollRadio, theme.pollRadioMark)
  "victorSelected" -> AnswerLook(theme.pollBorderVictor, theme.pollBarVictor, Marker.CHECKMARK, theme.pollBorderVictor, theme.pollRadioMark)
  "loserSelected" -> AnswerLook(null, theme.pollBarNotVoted, Marker.CHECKMARK, theme.pollRadio, theme.pollRadioLoserMark)
  else -> AnswerLook(null, theme.pollBar, Marker.HOLLOW, theme.pollRadio, theme.pollRadioMark)
}

private val CARD_SHAPE = RoundedCornerShape(8.dp)
private val ANSWER_SHAPE = RoundedCornerShape(8.dp)
/** PollCheckboxView: a 24dp marker, round (12dp corners) or with 8dp corners for checkboxes. */
private val MARKER_SIZE = 24.dp

/** A poll card (PollTextAndImageView): question and prompt, the answers, and the votes line with the actions. */
@Composable
fun PollView(poll: Poll) {
  val theme = LocalChatTheme.current
  val fonts = LocalChatFonts.current
  val muted = TextStyle(color = theme.textMuted, fontFamily = fonts.sans, fontSize = 12.sp, lineHeight = 16.sp)
  Column(
    Modifier
      .padding(top = 4.dp)
      .fillMaxWidth()
      .background(theme.pollBackground, CARD_SHAPE)
      .border(1.dp, theme.codeBorder, CARD_SHAPE)
      .padding(12.dp),
  ) {
    BasicText(
      poll.question,
      style = TextStyle(color = theme.textStrong, fontFamily = fonts.sans, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, lineHeight = 20.sp),
    )
    poll.hint?.let { BasicText(it, style = muted, modifier = Modifier.padding(top = 2.dp)) }
    Spacer(Modifier.size(8.dp))
    poll.answers.forEach { PollAnswerView(it, poll) }
    PollFooter(poll)
  }
}

/** ImageAndTextAnswerHolder: emoji, label, then the percentage and votes once results show, then the marker. */
@Composable
private fun PollAnswerView(answer: PollAnswer, poll: Poll) {
  val theme = LocalChatTheme.current
  val fonts = LocalChatFonts.current
  val actions = LocalChatActions.current
  val look = answerLook(answer.style, theme)
  val label = TextStyle(color = theme.headingPrimary, fontFamily = fonts.sans, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, lineHeight = 18.sp)
  val url = answer.url
  Box(
    Modifier
      .padding(bottom = 6.dp)
      .fillMaxWidth()
      .clip(ANSWER_SHAPE)
      .background(theme.pollAnswerBackground)
      .then(if (look.border != null) Modifier.border(1.dp, look.border, ANSWER_SHAPE) else Modifier)
      .then(if (url != null) Modifier.chatPress(onClick = { actions.onLinkPress(url) }) else Modifier),
  ) {
    if (poll.showResults) ResultBar(answer.percent, look.bar)
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp)) {
      if (answer.emojiUrl != null) {
        AsyncImage(model = answer.emojiUrl, contentDescription = answer.emoji, modifier = Modifier.padding(end = 8.dp).size(20.dp))
      } else if (answer.emoji != null) {
        BasicText(answer.emoji, style = TextStyle(fontSize = 17.sp, lineHeight = 20.sp), modifier = Modifier.padding(end = 8.dp))
      }
      BasicText(answer.text, style = label, modifier = Modifier.weight(1f))
      if (poll.showResults) {
        BasicText("${answer.percent}%", style = label.copy(fontWeight = FontWeight.Bold), modifier = Modifier.padding(start = 8.dp))
        BasicText(answer.votes, style = label.copy(fontWeight = FontWeight.Medium), modifier = Modifier.padding(start = 8.dp))
      }
      AnswerMarker(look, if (poll.interaction == CHECKBOX) 8.dp else MARKER_SIZE / 2, Modifier.padding(start = 8.dp))
    }
  }
}

/** The percentage bar from the leading edge, behind the answer's row. */
@Composable
private fun ResultBar(percent: Int, color: Color) {
  Box(
    Modifier
      .fillMaxHeight()
      .layout { measurable, constraints ->
        val width = (constraints.maxWidth * percent / 100f).toInt()
        val p = measurable.measure(constraints.copy(minWidth = width, maxWidth = width))
        layout(p.width, p.height) { p.place(0, 0) }
      }
      .background(color),
  )
}

/** PollCheckboxView.configure. NONE keeps the space empty (INVISIBLE). */
@Composable
private fun AnswerMarker(look: AnswerLook, corner: Dp, modifier: Modifier) {
  val shape = RoundedCornerShape(corner)
  val base = modifier.size(MARKER_SIZE)
  when (look.marker) {
    Marker.NONE -> Spacer(base)
    // A 2dp ring.
    Marker.HOLLOW -> Box(base.border(2.dp, look.markerBackground, shape))
    // The mark colour inside a 6dp ring; a checkbox draws the checkmark instead.
    Marker.FILLED -> if (corner == MARKER_SIZE / 2) {
      Box(base.background(look.markerForeground, shape).border(6.dp, look.markerBackground, shape))
    } else {
      Checkmark(look, shape, base)
    }
    Marker.CHECKMARK -> Checkmark(look, shape, base)
  }
}

/** The checkmark icon tinted with the mark colour on the marker's fill. */
@Composable
private fun Checkmark(look: AnswerLook, shape: RoundedCornerShape, modifier: Modifier) {
  Box(modifier.background(look.markerBackground, shape), contentAlignment = Alignment.Center) {
    Image(
      painter = cachedPainter(R.drawable.ic_checkmark),
      contentDescription = null,
      colorFilter = ColorFilter.tint(look.markerForeground),
      modifier = Modifier.size(16.dp),
    )
  }
}

/** The votes line and Show results at the start, the primary button at the end. */
@Composable
private fun PollFooter(poll: Poll) {
  Row(
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.spacedBy(8.dp),
    modifier = Modifier.padding(top = 2.dp).fillMaxWidth(),
  ) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.weight(1f)) {
      poll.secondary?.let { PollActionView(it) }
      poll.tertiary?.let { PollActionView(it) }
    }
    poll.primary?.let { PollActionView(it) }
  }
}

/**
 * PollActionButton: plain text (text-subtle, medium), a text button (text-brand, semibold), or a filled button
 * (8dp corners) in the primary or secondary control colours. A button without a link is drawn disabled.
 */
@Composable
private fun PollActionView(action: PollAction) {
  val theme = LocalChatTheme.current
  val fonts = LocalChatFonts.current
  val actions = LocalChatActions.current
  val url = action.url
  val press = if (url != null) Modifier.chatPress(onClick = { actions.onLinkPress(url) }) else Modifier
  val text = TextStyle(fontFamily = fonts.sans, fontSize = 14.sp, lineHeight = 18.sp)
  when (action.presentation) {
    "button", "secondaryButton" -> {
      val primary = action.presentation == "button"
      BasicText(
        action.label,
        maxLines = 1,
        style = text.copy(color = if (primary) theme.controlPrimaryText else theme.controlSecondaryText, fontWeight = FontWeight.Medium),
        modifier = Modifier
          .alpha(if (url == null) 0.5f else 1f)
          .heightIn(min = 32.dp)
          .clip(CARD_SHAPE)
          .background(if (primary) theme.controlPrimary else theme.controlSecondary)
          .then(press)
          .padding(horizontal = 12.dp, vertical = 7.dp),
      )
    }
    "textButton" -> BasicText(
      action.label,
      maxLines = 1,
      style = text.copy(color = theme.pollTextButton, fontWeight = FontWeight.SemiBold),
      modifier = Modifier.clip(RoundedCornerShape(4.dp)).then(press),
    )
    else -> BasicText(
      action.label,
      style = text.copy(color = theme.pollText, fontWeight = FontWeight.Medium),
      modifier = Modifier.clip(RoundedCornerShape(4.dp)).then(press),
    )
  }
}
