package me.palmdevs.isocord.chat.list

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.unit.dp

/** Jump-to-present button metrics (modules.mobile JUMP_TO_PRESENT_* tokens). */
private val JUMP_SIZE = 40.dp

private val JUMP_ICON = 20.dp

internal val JUMP_RIGHT = 16.dp

internal val JUMP_BOTTOM = 8.dp

/**
 * The round-cornered "↓" button shown while scrolled away from the newest messages, or from a jump target ("↑" when
 * the target is above).
 */
@Composable
internal fun JumpToPresentButton(up: Boolean = false, onClick: () -> Unit) {
  val theme = LocalChatTheme.current
  val shape = RoundedCornerShape(8.dp)
  Box(
    contentAlignment = Alignment.Center,
    modifier = Modifier
      .size(JUMP_SIZE)
      .clip(shape)
      .background(theme.jumpBackground, shape)
      .border(1.dp, theme.jumpBorder, shape)
      .clickable(onClick = onClick),
  ) {
    Canvas(Modifier.size(JUMP_ICON).rotate(if (up) 180f else 0f)) {
      val width = 2.dp.toPx()
      val w = size.width
      val h = size.height
      val x = w / 2
      drawLine(theme.jumpIcon, Offset(x, h * 0.15f), Offset(x, h * 0.85f), width, StrokeCap.Round)
      drawLine(theme.jumpIcon, Offset(x - w * 0.3f, h * 0.55f), Offset(x, h * 0.85f), width, StrokeCap.Round)
      drawLine(theme.jumpIcon, Offset(x + w * 0.3f, h * 0.55f), Offset(x, h * 0.85f), width, StrokeCap.Round)
    }
  }
}
