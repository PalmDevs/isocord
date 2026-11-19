package me.palmdevs.isocord.chat.search

import androidx.compose.runtime.Immutable
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import me.palmdevs.isocord.chat.rows.ChatRow
import me.palmdevs.isocord.core.decodeEach

/*
 * The rows of `IsocordSearchResultsView`, shared with src/features/search/messages/MessageResults.tsx.
 * A result's message is a chat message row, decoded as [ChatRow.Message] and drawn by the chat's composables.
 */
@Serializable
sealed interface SearchRow {
  val key: String

  /** A message the search found, with the channel it is in when that is a server channel. */
  @Immutable
  @Serializable
  @SerialName("result")
  data class Result(
    override val key: String,
    val channelId: String,
    val messageId: String,
    /** Server channel results show "<icon> <name>" above the message. */
    val channelName: String? = null,
    /** The channel's icon name: `text`, `thread` or `post` (see [welcomeIcon]). */
    val channelIcon: String? = null,
    /** The channel's server, after its name (the Notifications tab, whose results come from every server). */
    val guildName: String? = null,
    /** The server's icon at the start of the channel line; its acronym's first letter without one. */
    val guildIconUrl: String? = null,
    val guildAcronym: String? = null,
    /** Drawn at a lower opacity: a notification that has been read. */
    val read: Boolean = false,
    val message: ChatRow.Message,
  ) : SearchRow

  /** A boxed note above the results (the historical indexing header). */
  @Immutable
  @Serializable
  @SerialName("notice")
  data class Notice(override val key: String, val lines: List<String> = emptyList()) : SearchRow

  /** The spinner that ends the list while more pages exist; the list asks for the next page while it is last. */
  @Immutable
  @Serializable
  @SerialName("loading")
  data class Loading(override val key: String) : SearchRow
}

/** Parses the `rows` prop. Bad rows, and rows of an unknown type, are logged and skipped. */
fun parseSearchRows(json: String?): List<SearchRow> = decodeEach(SearchRow.serializer(), json)
