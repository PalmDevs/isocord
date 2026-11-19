package me.palmdevs.isocord.chat.viewer

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import me.palmdevs.isocord.R
import me.palmdevs.isocord.chat.chatPress
import me.palmdevs.isocord.chat.list.LocalChatFonts
import me.palmdevs.isocord.chat.media.MediaState
import me.palmdevs.isocord.chat.media.PauseIcon
import me.palmdevs.isocord.chat.media.PlayIcon
import me.palmdevs.isocord.chat.media.formatDuration

/**
 * MediaSlider: play or pause, the time played, the timeline and the length, in white; then the mute toggle
 * (MediaPlayerMuteManager), which the reference keeps in the header.
 */
@Composable
internal fun VideoControls(state: MediaState) {
  val fonts = LocalChatFonts.current
  val time = TextStyle(color = Color.White, fontFamily = fonts.sans, fontWeight = FontWeight.Medium, fontSize = 12.sp, lineHeight = 16.sp)
  Row(
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.spacedBy(12.dp),
    modifier = Modifier.fillMaxWidth().padding(start = 12.dp, end = 8.dp, bottom = 8.dp),
  ) {
    Box(Modifier.size(40.dp).clip(CircleShape).chatPress(onClick = { state.toggle() }), contentAlignment = Alignment.Center) {
      if (state.playing) PauseIcon(Color.White, Modifier.size(20.dp)) else PlayIcon(Color.White, Modifier.size(20.dp))
    }
    BasicText(formatDuration(state.positionMs), style = time)
    Timeline(state, Modifier.weight(1f))
    BasicText(formatDuration(state.durationMs), style = time)
    Box(Modifier.size(40.dp).clip(CircleShape).chatPress(onClick = { ViewerMute.muted = !ViewerMute.muted }), contentAlignment = Alignment.Center) {
      Image(
        painter = painterResource(if (ViewerMute.muted) R.drawable.ic_voice_x else R.drawable.ic_voice_normal),
        contentDescription = null,
        colorFilter = ColorFilter.tint(Color.White),
        modifier = Modifier.size(24.dp),
      )
    }
  }
}

/** The timeline: white at 10% for the rest, white for what has played; tap or drag to seek. */
@Composable
private fun Timeline(state: MediaState, modifier: Modifier) {
  val fraction = if (state.durationMs > 0) (state.positionMs.toFloat() / state.durationMs).coerceIn(0f, 1f) else 0f
  Box(
    modifier
      .height(32.dp)
      .pointerInput(state) { detectTapGestures { state.seek(it.x / size.width) } }
      .pointerInput(state) { detectHorizontalDragGestures { change, _ -> state.seek(change.position.x / size.width) } },
    contentAlignment = Alignment.CenterStart,
  ) {
    Box(Modifier.fillMaxWidth().height(4.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.1f)))
    Box(Modifier.fillMaxWidth(fraction).height(4.dp).clip(CircleShape).background(Color.White))
  }
}
