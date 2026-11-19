package me.palmdevs.isocord.expressions

import androidx.compose.runtime.Immutable
import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.intOrNull
import me.palmdevs.isocord.core.decodeEach
import me.palmdevs.isocord.notifications.notify.title

/*
 * The `sections` of `IsocordExpressionGridView`, the contract shared with
 * src/features/expressions/picker/ExpressionGrid.tsx (GridSection, GridItem).
 */

/** An item: its key (sent back on a press), its image, flags and the name read out. JSON: `[key, url, flags, label]`. */
@Immutable
@Serializable(with = GridItemSerializer::class)
data class GridItem(val key: String, val url: String, val animated: Boolean, val locked: Boolean, val label: String)

/** A section: its header (empty for none) and items. */
@Immutable
@Serializable
data class GridSection(val key: String = "", val title: String = "", val items: List<GridItem> = emptyList())

/** The flag bits of a grid item's `flags`, which JS sets (src/features/expressions/picker/ExpressionGrid.tsx). */
object GridItemFlag {
  /** It moves, and plays while the grid is still. */
  const val ANIMATED = 1
  /** It can't be used here: lock overlay. */
  const val LOCKED = 2
}

/** Reads and writes a [GridItem] as its `[key, url, flags, label]` array. */
private object GridItemSerializer : KSerializer<GridItem> {
  private val fields = ListSerializer(JsonPrimitive.serializer())
  override val descriptor = fields.descriptor

  override fun deserialize(decoder: Decoder): GridItem {
    val values = decoder.decodeSerializableValue(fields)
    if (values.size < 2) throw SerializationException("A grid item needs a key and a url")
    val flags = values.getOrNull(2)?.intOrNull ?: 0
    val label = values.getOrNull(3)?.content.orEmpty()
    return GridItem(values[0].content, values[1].content, flags and GridItemFlag.ANIMATED != 0, flags and GridItemFlag.LOCKED != 0, label)
  }

  override fun serialize(encoder: Encoder, value: GridItem) {
    val flags = (if (value.animated) GridItemFlag.ANIMATED else 0) or (if (value.locked) GridItemFlag.LOCKED else 0)
    encoder.encodeSerializableValue(
      fields,
      listOf(JsonPrimitive(value.key), JsonPrimitive(value.url), JsonPrimitive(flags), JsonPrimitive(value.label)),
    )
  }
}

/** Parses the `sections` prop; a malformed section is logged and skipped. */
fun parseGridSections(json: String): List<GridSection> = decodeEach(GridSection.serializer(), json)
