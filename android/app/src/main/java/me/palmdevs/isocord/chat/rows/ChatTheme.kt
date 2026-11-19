@file:UseSerializers(ArgbColorSerializer::class)

package me.palmdevs.isocord.chat.rows

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color
import kotlinx.serialization.Serializable
import kotlinx.serialization.UseSerializers
import me.palmdevs.isocord.core.decodeOrNull

/** The colours of the native chat (`chatTheme` in theme.ts). */
@Immutable
@Serializable
data class ChatTheme(
  val background: Color = Color.Black,
  val textDefault: Color = Color.White,
  val textStrong: Color = Color.White,
  val textMuted: Color = Color.Gray,
  val textLink: Color = Color.Cyan,
  val mentionBackground: Color = Color.Transparent,
  val mentionForeground: Color = Color.White,
  val codeBackground: Color = Color.Transparent,
  val codeBorder: Color = Color.Transparent,
  val spoilerBackground: Color = Color.Gray,
  val quoteBar: Color = Color.Gray,
  val listBullet: Color = Color.Gray,
  val separator: Color = Color.Gray,
  val mentionedBackground: Color = Color.Transparent,
  val mentionedBar: Color = Color.Yellow,
  val highlight: Color = Color(0x295865F2),
  val reactionBackground: Color = Color.Transparent,
  val reactionBorder: Color = Color.Transparent,
  val reactionText: Color = Color.White,
  val reactionReactedBackground: Color = Color.Transparent,
  val reactionReactedBorder: Color = Color.Blue,
  val reactionReactedText: Color = Color.White,
  val reactionAddIcon: Color = Color.White,
  val botTagBackground: Color = Color.Blue,
  val tagBackground: Color = Color.DarkGray,
  val cardBackground: Color = Color.Transparent,
  val embedBackground: Color = Color.DarkGray,
  val ripple: Color = Color(0x12FFFFFF),
  val spine: Color = Color.Gray,
  val unreadText: Color = Color.Red,
  val unreadBorder: Color = Color.Red,
  /** SystemMessageView's icon colours (see [systemTint]). */
  val systemIconPositive: Color = Color.Green,
  val systemIconDanger: Color = Color.Red,
  val systemIconWarning: Color = Color.Yellow,
  val systemIconBoost: Color = Color.Magenta,
  val systemIconNormal: Color = Color.White,
  /** CallSystemMessageView's icon: an ongoing call, a missed one. */
  val callConnected: Color = Color.Green,
  val callDisconnected: Color = Color.Red,
  /** ThreadEmbedView's card and its thread name. */
  val threadEmbedBackground: Color = Color.DarkGray,
  val headingPrimary: Color = Color.White,
  val placeholder: Color = Color.DarkGray,
  val jumpBackground: Color = Color.DarkGray,
  val jumpBorder: Color = Color.Transparent,
  val jumpIcon: Color = Color.White,
  val swipeBackground: Color = Color.Transparent,
  val swipeCircle: Color = Color.DarkGray,
  val swipeCircleActive: Color = Color.Blue,
  val swipeEditCircle: Color = Color.Gray,
  val swipeIcon: Color = Color.White,
  val syntaxKeyword: Color = Color.Unspecified,
  val syntaxString: Color = Color.Unspecified,
  val syntaxNumber: Color = Color.Unspecified,
  val syntaxComment: Color = Color.Unspecified,
  val syntaxTitle: Color = Color.Unspecified,
  val syntaxMeta: Color = Color.Unspecified,
  /** Background of the words of the query in search results. */
  val searchHighlight: Color = Color(0x4DF0B232),
  /** The media viewer's buttons over the media (the ALT button, MediaModalOverlayAltText). */
  val overlayButton: Color = Color(0x99000000),
  val spoilerLabelBackground: Color = Color.Gray,
  val mediaBorder: Color = Color.Gray,
  val mediaBadgeBackground: Color = Color.Gray,
  val fileIconDocument: Color = Color.Gray,
  val fileIconArchive: Color = Color.Gray,
  val fileIconCode: Color = Color.Gray,
  val fileIconInstaller: Color = Color.Gray,
  val fileIconOther: Color = Color.Gray,
  val fileIconFold: Color = Color.Gray,
  /** A dark theme: super reactions take their dark palette (ReactionView, ThemeManager.isThemeDark). */
  val dark: Boolean = true,
  /** MessageTagView's text, and AutoMod's shield, on [botTagBackground]. */
  val botTagText: Color = Color.White,
  /** The forum post OP tag (resolveMessageContentColors). */
  val opTagText: Color = Color.Blue,
  val opTagBackground: Color = Color.White,
  /** Polls: the card, an answer, its result bar by state, borders and the answer marker (PollStyles). */
  val pollBackground: Color = Color.DarkGray,
  val pollAnswerBackground: Color = Color.Transparent,
  val pollBar: Color = Color.Gray,
  val pollBarNotVoted: Color = Color.Gray,
  val pollBarVoted: Color = Color.Blue,
  val pollBarVictor: Color = Color.Green,
  val pollBorderSelected: Color = Color.Blue,
  val pollBorderVictor: Color = Color.Green,
  val pollRadio: Color = Color.White,
  val pollRadioSelected: Color = Color.Blue,
  val pollRadioMark: Color = Color.White,
  val pollRadioLoserMark: Color = Color.Black,
  /** PollActionButton: plain text, a text button, and the filled buttons. */
  val pollText: Color = Color.Gray,
  val pollTextButton: Color = Color.Blue,
  val controlPrimary: Color = Color.Blue,
  val controlPrimaryText: Color = Color.White,
  val controlSecondary: Color = Color.Gray,
  val controlSecondaryText: Color = Color.White,
  /** Message components: button borders and fills by style, the select's input look, the failed label. */
  val controlPrimaryBorder: Color = Color.Transparent,
  val controlSecondaryBorder: Color = Color.Transparent,
  val controlCritical: Color = Color.Red,
  val controlCriticalBorder: Color = Color.Transparent,
  val controlCriticalText: Color = Color.White,
  val controlConnected: Color = Color.Green,
  val controlConnectedBorder: Color = Color.Transparent,
  val controlConnectedText: Color = Color.White,
  val inputBackground: Color = Color.DarkGray,
  val inputBorder: Color = Color.Gray,
  val textSubtle: Color = Color.Gray,
  val feedbackCritical: Color = Color.Red,
  /** ForumPostActionBarView's footer divider under the forum post action bar. */
  val postActionsDivider: Color = Color.DarkGray,
)

/** Parses the `theme` prop; the defaults when it is missing or bad. */
fun parseTheme(json: String?): ChatTheme =
  if (json.isNullOrEmpty()) ChatTheme() else decodeOrNull(ChatTheme.serializer(), json) ?: ChatTheme()
