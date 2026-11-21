package me.palmdevs.isocord.chat.viewer

import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Immutable
import androidx.compose.ui.unit.dp
import kotlinx.serialization.Serializable
import me.palmdevs.isocord.core.decodeEach

/** The viewer's own link actions, `isocord://viewer/<action>/<index>`. */
object ViewerAction {
  const val OPTIONS = "options"
  const val ALT = "alt"
  const val SPEED = "speed"
}

/** One picture or video in the viewer, as `ViewerSource` in src/features/mediaViewer/sources.ts sends it. */
@Immutable
@Serializable
data class ViewerSource(
  /** The picture, or the still of a video. */
  val url: String = "",
  /** Source size in pixels; 0 when unknown. */
  val width: Int = 0,
  val height: Int = 0,
  /** A video file played over the still. */
  val videoUrl: String? = null,
  /** The video stands in for a GIF: it loops, muted, while shown. */
  val gifv: Boolean = false,
  /** A hosted player drawn in a web view: its page, and `youtube` or `tiktok`. */
  val embedUrl: String? = null,
  val provider: String? = null,
  /** Alt text: the ALT button shows when there is some. */
  val description: String? = null,
  /** The "SPOILER" label when the media starts hidden. */
  val spoiler: String? = null,
)

internal fun parseViewerSources(json: String?): List<ViewerSource> = decodeEach(ViewerSource.serializer(), json)

/** Where the viewer grows from: the tapped tile in the window, in dp (openMediaModal's originLayout, cover mode). */
@Immutable
data class ViewerOrigin(val x: Float, val y: Float, val width: Float, val height: Float)

/** The callbacks the viewer reports to JS. */
class ViewerActions(
  val onIndexChange: (Int) -> Unit,
  /** Whether the header and footer show: not hidden by a tap, no drag under way, not closing. */
  val onOverlayChange: (Boolean) -> Unit,
  val onClosing: () -> Unit,
  /** The close animation finished; JS unmounts the viewer. */
  val onClosed: () -> Unit,
  /**
   * Links in the footer (reactions, mentions...), and the viewer's own: `isocord://viewer/options/<index>` (a long
   * press on the media) and `isocord://viewer/alt/<index>` (the ALT button).
   */
  val onLinkPress: (String) -> Unit,
)

/** Labels the footer draws. */
@Immutable
data class ViewerLabels(val react: String = "", val alt: String = "")
