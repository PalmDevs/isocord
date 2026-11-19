package me.palmdevs.isocord.chat

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.IndicationNodeFactory
import androidx.compose.foundation.interaction.InteractionSource
import androidx.compose.foundation.interaction.PressInteraction
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.lerp
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.ContentDrawScope
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.node.DelegatableNode
import androidx.compose.ui.node.DrawModifierNode
import androidx.compose.ui.unit.dp
import androidx.compose.ui.util.lerp
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlin.math.hypot

// Timings and sizes of Compose material's RippleAnimation.
private const val FADE_IN_MS = 75
private const val GROW_MS = 225
private const val FADE_OUT_MS = 150
private const val START_RADIUS_FRACTION = 0.3f
private val EXTRA_RADIUS = 10.dp

/**
 * Draws a bounded ripple in one colour: the theme's MOBILE_ANDROID_BUTTON_BACKGROUND_RIPPLE, whose alpha
 * is the ripple's strength. Departs from the platform ripple (an Android Pressable's `android_ripple`):
 * its first press on each of Compose's 5 ripple hosts froze in screens pushed on the native stack.
 */
class ChatRipple(private val color: Color) : IndicationNodeFactory {
  override fun create(interactionSource: InteractionSource): DelegatableNode = RippleNode(interactionSource, color)

  override fun equals(other: Any?) = other is ChatRipple && other.color == color
  override fun hashCode() = color.hashCode()
}

/** One press: grows from the touch towards the centre, fades out once released and grown. */
private class Ripple(val origin: Offset) {
  val grow = Animatable(0f)
  val fade = Animatable(0f)
  val released = CompletableDeferred<Unit>()
}

private class RippleNode(private val source: InteractionSource, private val color: Color) :
  Modifier.Node(), DrawModifierNode {
  private val ripples = mutableStateListOf<Ripple>()
  private val pressed = mutableMapOf<PressInteraction.Press, Ripple>()

  override fun onAttach() {
    coroutineScope.launch {
      source.interactions.collect { interaction ->
        when (interaction) {
          is PressInteraction.Press -> start(interaction)
          is PressInteraction.Release -> pressed.remove(interaction.press)?.released?.complete(Unit)
          is PressInteraction.Cancel -> pressed.remove(interaction.press)?.released?.complete(Unit)
        }
      }
    }
  }

  override fun onDetach() {
    ripples.clear()
    pressed.clear()
  }

  private fun start(press: PressInteraction.Press) {
    val ripple = Ripple(press.pressPosition)
    pressed[press] = ripple
    ripples += ripple
    coroutineScope.launch {
      coroutineScope {
        launch { ripple.fade.animateTo(1f, tween(FADE_IN_MS, easing = LinearEasing)) }
        launch { ripple.grow.animateTo(1f, tween(GROW_MS, easing = FastOutSlowInEasing)) }
      }
      ripple.released.await()
      ripple.fade.animateTo(0f, tween(FADE_OUT_MS, easing = LinearEasing))
      ripples -= ripple
    }
  }

  override fun ContentDrawScope.draw() {
    drawContent()
    if (ripples.isEmpty()) return
    val startRadius = size.maxDimension * START_RADIUS_FRACTION
    val endRadius = hypot(size.width, size.height) / 2 + EXTRA_RADIUS.toPx()
    clipRect {
      for (ripple in ripples) {
        val grown = ripple.grow.value
        drawCircle(
          color = color.copy(alpha = color.alpha * ripple.fade.value),
          radius = lerp(startRadius, endRadius, grown),
          center = lerp(ripple.origin, center, grown),
        )
      }
    }
  }
}
