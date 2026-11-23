package me.palmdevs.isocord.chat

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.dp
import kotlin.math.floor
import kotlin.math.sin
import me.palmdevs.isocord.chat.list.LocalChatTheme
import me.palmdevs.isocord.chat.rows.AVATAR_SIZE

/** The single skeleton primitive: a flat block in the placeholder colour. Pulsing is done by the container. */
@Composable
internal fun SkeletonBlock(modifier: Modifier, shape: Shape = RoundedCornerShape(8.dp), color: Color = LocalChatTheme.current.placeholder) {
  Box(modifier.background(color, shape))
}

// Chat placeholder (modules/chat/native/placeholder): 0.3 to 0.7 to 0.3 opacity over 2 x 1300ms, one transition for all rows.
private const val PULSE_MS = 1300
private val ROW_TOP = 24.dp
private val LINE = 16.dp
private val LINE_GAP = 12.dp
private const val ROWS = 12

/** Deterministic stand-in for the reference's Math.random(): a fraction in [0, 1) from a seed. */
internal fun fraction(seed: Int): Float {
  val x = 10000.0 * sin(seed.toDouble())
  return (x - floor(x)).toFloat()
}

/** Skeleton messages filling a (reversed) chat list's height, newest at the bottom, like ChatPlaceholder in the reference. */
@Composable
internal fun ChatPlaceholder(modifier: Modifier) {
  val pulse by rememberInfiniteTransition(label = "skeleton").animateFloat(
    initialValue = 0.3f,
    targetValue = 0.7f,
    animationSpec = infiniteRepeatable(tween(PULSE_MS, easing = FastOutSlowInEasing), RepeatMode.Reverse),
    label = "pulse",
  )
  Column(
    verticalArrangement = Arrangement.Bottom,
    modifier = modifier.fillMaxWidth().clipToBounds().graphicsLayer { alpha = pulse },
  ) {
    // The first row is the newest and sits at the bottom, so the column is filled bottom-up.
    for (i in ROWS - 1 downTo 0) {
      val lines = 1 + (fraction(i * 7 + 1) * 3).toInt()
      Row(Modifier.fillMaxWidth().padding(start = 12.dp, top = ROW_TOP)) {
        SkeletonBlock(Modifier.size(AVATAR_SIZE), CircleShape)
        Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
          SkeletonBlock(Modifier.fillMaxWidth(0.1f + fraction(i * 3 + 2) * 0.5f).height(LINE))
          for (line in 0 until lines) {
            SkeletonBlock(Modifier.padding(top = LINE_GAP).fillMaxWidth(0.6f + fraction(i + line + 5) * 0.4f).height(LINE))
          }
        }
      }
    }
  }
}
