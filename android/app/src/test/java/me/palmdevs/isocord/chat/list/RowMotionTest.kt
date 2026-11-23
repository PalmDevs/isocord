package me.palmdevs.isocord.chat.list

import androidx.compose.ui.graphics.GraphicsLayerScope
import androidx.compose.ui.layout.AlignmentLine
import androidx.compose.ui.layout.Measurable
import androidx.compose.ui.layout.MeasureScope
import androidx.compose.ui.layout.Placeable
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.LayoutDirection
import org.junit.Assert.assertEquals
import org.junit.Test

class RowMotionTest {
  @Test
  fun reusedNodeStartsTheNextArrivalCollapsed() {
    val node = RowMotion("first", leaving = true, onLeft = {}).create()
    // Visible row before it starts leaving, then restored to its settled enter state.
    RowMotion("first", leaving = false, onLeft = {}).update(node)
    assertEquals(ROW_SIZE, heightOf(node))
    node.onReset()
    node.onDetach()

    RowMotion("next", leaving = false, onLeft = {}).update(node)
    assertEquals(0, heightOf(node))
  }

  private fun heightOf(node: RowMotionNode): Int =
    with(node) { Measure.measure(Row, Constraints()).height }

  private object Measure : MeasureScope {
    override val density = 1f
    override val fontScale = 1f
    override val layoutDirection = LayoutDirection.Ltr
  }

  private object Row : Measurable {
    override val parentData: Any? = null
    override fun minIntrinsicWidth(height: Int) = ROW_SIZE
    override fun maxIntrinsicWidth(height: Int) = ROW_SIZE
    override fun minIntrinsicHeight(width: Int) = ROW_SIZE
    override fun maxIntrinsicHeight(width: Int) = ROW_SIZE
    override fun measure(constraints: Constraints) = object : Placeable() {
      init {
        measuredSize = IntSize(ROW_SIZE, ROW_SIZE)
      }

      override fun get(alignmentLine: AlignmentLine) = AlignmentLine.Unspecified
      override fun placeAt(position: IntOffset, zIndex: Float, layerBlock: (GraphicsLayerScope.() -> Unit)?) = Unit
    }
  }

  private companion object {
    const val ROW_SIZE = 40
  }
}
