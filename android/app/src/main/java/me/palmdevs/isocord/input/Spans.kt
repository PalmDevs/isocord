package me.palmdevs.isocord.input

import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.drawable.Drawable
import android.text.TextPaint
import android.text.style.MetricAffectingSpan
import android.text.style.ReplacementSpan
import kotlin.math.roundToInt
import me.palmdevs.isocord.chat.rows.mentionIconWidth

/**
 * Draws a mention over a rounded background: user, role and channel mentions.
 * [runs] are drawn in place of the text, as the message list draws the mention. [icon] loads a run's icon.
 */
class PillSpan(
  private val runs: List<MentionRun>?,
  private val foreground: Int?,
  private val background: Int,
  private val radius: Float,
  private val horizontalPadding: Float,
  private val icon: (String) -> Drawable?,
) : ReplacementSpan() {
  private val rect = RectF()

  override fun getSize(paint: Paint, text: CharSequence, start: Int, end: Int, fm: Paint.FontMetricsInt?): Int =
    (width(paint, text, start, end) + 2 * horizontalPadding).roundToInt()

  /** Icons are as tall as the text, as in the message list. */
  private fun runWidth(paint: Paint, run: MentionRun): Float =
    if (run.icon != null && icon(run.icon) != null) paint.textSize * mentionIconWidth(run.icon) else paint.measureText(run.text)

  private fun width(paint: Paint, text: CharSequence, start: Int, end: Int) =
    runs?.sumOf { runWidth(paint, it).toDouble() }?.toFloat() ?: paint.measureText(text, start, end)

  override fun draw(canvas: Canvas, text: CharSequence, start: Int, end: Int, x: Float, top: Int, y: Int, bottom: Int, paint: Paint) {
    val metrics = paint.fontMetrics
    rect.set(x, y + metrics.ascent - 1f, x + width(paint, text, start, end) + 2 * horizontalPadding, y + metrics.descent + 1f)
    val previousColor = paint.color
    paint.color = background
    canvas.drawRoundRect(rect, radius, radius, paint)
    val color = foreground ?: previousColor
    paint.color = color
    if (runs == null) {
      canvas.drawText(text, start, end, x + horizontalPadding, y.toFloat(), paint)
    } else {
      var left = x + horizontalPadding
      val size = paint.textSize
      val iconTop = (y + (metrics.ascent + metrics.descent) / 2 - size / 2).roundToInt()
      for (run in runs) {
        val drawable = run.icon?.let(icon)
        if (drawable != null) {
          drawable.setBounds(left.roundToInt(), iconTop, (left + size).roundToInt(), iconTop + size.roundToInt())
          drawable.setTint(color)
          drawable.draw(canvas)
        } else {
          canvas.drawText(run.text, left, y.toFloat(), paint)
        }
        left += runWidth(paint, run)
      }
    }
    paint.color = previousColor
  }
}

/** A custom emoji drawn in place of its `<:name:id>` text. The image arrives later through [drawable]. */
class InlineImageSpan(val url: String, private val size: Int, var drawable: Drawable?) : ReplacementSpan() {
  override fun getSize(paint: Paint, text: CharSequence, start: Int, end: Int, fm: Paint.FontMetricsInt?): Int = size

  override fun draw(canvas: Canvas, text: CharSequence, start: Int, end: Int, x: Float, top: Int, y: Int, bottom: Int, paint: Paint) {
    val image = drawable ?: return
    val bottomEdge = y + paint.fontMetrics.descent
    val left = x.roundToInt()
    val topEdge = (bottomEdge - size).roundToInt()
    image.setBounds(left, topEdge, left + size, topEdge + size)
    image.draw(canvas)
  }
}

/** Swaps the typeface for one of Discord's font files (bold, italic and monospace use their own files, not synthesized ones). */
class FontSpan(private val typeface: Typeface) : MetricAffectingSpan() {
  override fun updateDrawState(paint: TextPaint) = apply(paint)

  override fun updateMeasureState(paint: TextPaint) = apply(paint)

  private fun apply(paint: TextPaint) {
    paint.typeface = typeface
  }
}
