@file:UseSerializers(ArgbColorSerializer::class)

package me.palmdevs.isocord.chat.rows

import kotlinx.serialization.UseSerializers
import kotlinx.serialization.builtins.ListSerializer
import me.palmdevs.isocord.core.decodeEach
import me.palmdevs.isocord.core.decodeOrNull

/** Parses a prop holding one message row; null when it is missing or bad. */
fun parseMessage(json: String?): ChatRow.Message? =
  if (json.isNullOrEmpty()) null else decodeOrNull(ChatRow.Message.serializer(), json)

/** Parses a prop holding a message's reaction chips (`ReactionRow[]`); empty when it is missing or bad. */
fun parseReactions(json: String?): List<Reaction> =
  if (json.isNullOrEmpty()) emptyList() else decodeOrNull(ListSerializer(Reaction.serializer()), json) ?: emptyList()

/**
 * Parses the `rows` prop, a JSON array with one row per line (`serializeRows` in rows.ts).
 * A line from the previous update is not parsed again: [previous] maps lines to rows, and the next map is returned.
 * Unchanged rows keep their instance, so a page or one new message costs only the changed rows.
 * A bad or unknown row is logged and skipped.
 */
fun parseRows(json: String?, previous: Map<String, ChatRow>, checkActive: () -> Unit): Pair<List<ChatRow>, Map<String, ChatRow>> {
  if (json.isNullOrEmpty()) return emptyList<ChatRow>() to emptyMap()
  // An array on one line: fewer than two rows, or a writer that does not break lines.
  if ('\n' !in json) return decodeEach(ChatRow.serializer(), json) to emptyMap()
  val rows = ArrayList<ChatRow>()
  val lines = HashMap<String, ChatRow>()
  var start = 0
  while (start < json.length) {
    checkActive()
    var end = json.indexOf('\n', start)
    if (end < 0) end = json.length
    // Each line is one row object, with the array's `[` before the first and `,` or `]` after each.
    val from = if (json[start] == '[') start + 1 else start
    val to = if (end > from && (json[end - 1] == ',' || json[end - 1] == ']')) end - 1 else end
    if (to > from) {
      val line = json.substring(from, to)
      val row = previous[line] ?: decodeOrNull(ChatRow.serializer(), line)
      if (row != null) {
        rows.add(row)
        lines[line] = row
      }
    }
    start = end + 1
  }
  return rows to lines
}
