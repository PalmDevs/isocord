package me.palmdevs.isocord.expressions.gifs

import androidx.compose.runtime.Immutable
import kotlinx.serialization.Serializable
import me.palmdevs.isocord.core.decodeEach

/*
 * The `tiles` of `IsocordGifGridView`, the contract shared with src/features/expressions/picker/GifGrid.tsx (GifTile).
 */

/** The `icon` of a category tile, which JS sets (GIFPickerCategoryView's AnalyticsIcon and StarIcon). */
object GifTileIcon {
  const val TRENDING = "trending"
  const val FAVORITES = "favorites"
}

/**
 * A tile: a GIF, laid out at its own aspect ratio, or a category (a fixed-height tile with its name over a dimmed
 * image). An empty [src] draws only the placeholder (the loading list). [badge] is drawn in the bottom corner.
 */
@Immutable
@Serializable
data class GifTile(
  val key: String,
  val src: String = "",
  val width: Int = 0,
  val height: Int = 0,
  val label: String = "",
  val category: Boolean = false,
  val icon: String = "",
  val badge: String = "",
)

/** Parses the `tiles` prop; a malformed tile is logged and skipped. */
fun parseGifTiles(json: String?): List<GifTile> = decodeEach(GifTile.serializer(), json)
