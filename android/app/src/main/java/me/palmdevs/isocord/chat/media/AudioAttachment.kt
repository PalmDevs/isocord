package me.palmdevs.isocord.chat.media

import android.util.Base64
import android.util.Log
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import me.palmdevs.isocord.chat.chatPress
import me.palmdevs.isocord.chat.list.LocalChatFonts
import me.palmdevs.isocord.chat.list.LocalChatTheme
import me.palmdevs.isocord.chat.rows.Attachment

private const val TAG = "IsocordAttachments"

@Composable
private fun AudioToggleButton(state: MediaState) {
  val theme = LocalChatTheme.current
  Box(
    Modifier.size(40.dp).clip(CircleShape).background(theme.botTagBackground).clickable { state.toggle() },
    contentAlignment = Alignment.Center,
  ) {
    if (state.playing) PauseIcon(Color.White, Modifier.size(16.dp)) else PlayIcon(Color.White, Modifier.size(16.dp))
  }
}

@Composable
internal fun AudioAttachment(id: String, a: Attachment, onHold: () -> Unit) {
  val theme = LocalChatTheme.current
  val fonts = LocalChatFonts.current
  val state = rememberMedia(id, a.url)
  val total = if (state.durationMs > 0) state.durationMs else (a.durationSecs * 1000).toLong()
  // A hold adds the file's rows to the long press sheet (onLongPressAttachmentLink); the card itself has no tap.
  Column(cardModifier().chatPress(onLongClick = onHold).padding(12.dp)) {
    Row(verticalAlignment = Alignment.CenterVertically) {
      AudioToggleButton(state)
      Column(Modifier.weight(1f).padding(start = 12.dp)) {
        BasicText(
          text = a.filename,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis,
          style = TextStyle(color = theme.textLink, fontFamily = fonts.sans, fontSize = 16.sp, lineHeight = 20.sp),
        )
        BasicText(
          text = "${formatDuration(state.positionMs)} / ${formatDuration(total)}  •  ${a.size}",
          style = TextStyle(color = theme.textMuted, fontFamily = fonts.sans, fontSize = 12.sp, lineHeight = 16.sp),
        )
      }
    }
    // Progress; tap to seek.
    val fraction = if (total > 0) (state.positionMs.toFloat() / total).coerceIn(0f, 1f) else 0f
    Canvas(
      Modifier
        .padding(top = 12.dp)
        .fillMaxWidth()
        .height(4.dp)
        .pointerInput(Unit) { detectTapGestures { state.seek(it.x / size.width) } },
    ) {
      drawRoundRect(theme.quoteBar, size = size, cornerRadius = CornerRadius(2.dp.toPx()))
      drawRoundRect(theme.botTagBackground, size = Size(size.width * fraction, size.height), cornerRadius = CornerRadius(2.dp.toPx()))
    }
  }
}

@Composable
internal fun VoiceMessage(id: String, a: Attachment) {
  val theme = LocalChatTheme.current
  val fonts = LocalChatFonts.current
  val state = rememberMedia(id, a.url)
  val total = if (state.durationMs > 0) state.durationMs else (a.durationSecs * 1000).toLong()
  val samples = remember(a.waveform) {
    try {
      Base64.decode(a.waveform, Base64.DEFAULT)
    } catch (e: IllegalArgumentException) {
      Log.w(TAG, "bad waveform: ${e.javaClass.simpleName}")
      ByteArray(0)
    }
  }
  val fraction = if (total > 0) (state.positionMs.toFloat() / total).coerceIn(0f, 1f) else 0f
  Row(cardModifier().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
    AudioToggleButton(state)
    Canvas(
      Modifier
        .weight(1f)
        .padding(horizontal = 12.dp)
        .height(32.dp)
        .pointerInput(Unit) { detectTapGestures { state.seek(it.x / size.width) } },
    ) {
      val step = 4.dp.toPx()
      val bars = maxOf(1, (size.width / step).toInt())
      for (bar in 0 until bars) {
        // Resample the (up to 256) amplitudes to the bars that fit.
        val level = if (samples.isEmpty()) 0.2f else (samples[bar * samples.size / bars].toInt() and 0xFF) / 255f
        val barHeight = maxOf(3.dp.toPx(), level * size.height)
        drawLine(
          color = if (bar.toFloat() / bars < fraction) theme.botTagBackground else theme.quoteBar,
          start = Offset(bar * step + 1.dp.toPx(), (size.height - barHeight) / 2),
          end = Offset(bar * step + 1.dp.toPx(), (size.height + barHeight) / 2),
          strokeWidth = 2.dp.toPx(),
          cap = StrokeCap.Round,
        )
      }
    }
    BasicText(
      text = formatDuration(if (state.playing || state.positionMs > 0) state.positionMs else total),
      style = TextStyle(color = theme.textMuted, fontFamily = fonts.sans, fontSize = 12.sp, lineHeight = 16.sp),
    )
  }
}

/** The round play button over a video or hosted player; [onPress] is null when the parent handles the tap. */
@Composable
internal fun PlayButton(modifier: Modifier, onPress: (() -> Unit)? = null) {
  val theme = LocalChatTheme.current
  Box(
    contentAlignment = Alignment.Center,
    modifier = modifier
      .size(48.dp)
      .clip(CircleShape)
      .then(if (onPress != null) Modifier.chatPress(onClick = onPress) else Modifier)
      .background(theme.overlayButton, CircleShape),
  ) {
    PlayIcon(Color.White, Modifier.size(20.dp))
  }
}
