package me.palmdevs.isocord.input

import kotlinx.serialization.Serializable
import me.palmdevs.isocord.core.decodeEach

/**
 * One styled range of the composer text, sent by JS (src/features/chat/composer/parsing/parse.ts) after parsing.
 * Follows the reference's ChatInputParser nodes (`location`, `length`, `type`, `deleteNodeOnBackspace`, `editDisabled`)
 * with the resolved style flattened in. Colours are ARGB integers.
 */
@Serializable
data class StyleBlock(
  val location: Int = 0,
  val length: Int = 0,
  /** A [NodeType]. Informational; styling is all in the fields. */
  val type: Int = NodeType.MARKDOWN,
  val color: Int? = null,
  val backgroundColor: Int? = null,
  /** dp. A background with a radius is drawn as a rounded pill; without one as a plain highlight. */
  val cornerRadius: Float = 0f,
  val bold: Boolean = false,
  val italic: Boolean = false,
  val strikethrough: Boolean = false,
  val underline: Boolean = false,
  val monospace: Boolean = false,
  /** Drawn in place of the text (custom emoji). */
  val imageUrl: String? = null,
  /** Drawn in a pill in place of the text: the mention as the message list shows it. */
  val runs: List<MentionRun>? = null,
  val deleteNodeOnBackspace: Boolean = false,
  val editDisabled: Boolean = false,
) {
  val end get() = location + length
}

/** One run of a pill: text, or a mention icon (MessageText.kt `mentionIcon`) drawn in place of it. */
@Serializable
data class MentionRun(val text: String, val icon: String? = null)

/** ChatInputNodeType of the reference (modules/chat_input/native/ChatInputParser.tsx), plus our markdown. */
object NodeType {
  const val EMOJI_HIGHLIGHT = 2
  const val USER_HIGHLIGHT = 3
  const val ROLE_HIGHLIGHT = 4
  const val CHANNEL_HIGHLIGHT = 5
  const val SILENT_HIGHLIGHT = 6
  const val MARKDOWN = 11
}

/** Parses the blocks JSON; bad blocks and empty ones are skipped. */
fun parseStyleBlocks(json: String?): List<StyleBlock> =
  decodeEach(StyleBlock.serializer(), json).filter { it.length > 0 }
