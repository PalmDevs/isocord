package me.palmdevs.isocord.core

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.os.Build
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.PixelUtil.dpToPx
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewGroupManager
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.viewmanagers.IsocordCutoutViewManagerDelegate
import com.facebook.react.viewmanagers.IsocordCutoutViewManagerInterface
import com.facebook.react.views.view.ReactViewGroup

private const val STATUS_PADDING_DP = 3f
private const val PHONE_HEIGHT_SCALE = 1.4f
private const val PHONE_RADIUS_RATIO = 0.1875f

/**
 * Clips the status cutout out of the wrapped avatar and draws the status shape with transparent holes,
 * so translucent and gradient backgrounds show through without software-rendered SVG bitmaps.
 */
class CutoutView(context: Context) : ReactViewGroup(context) {
  private val cutoutPath = Path()
  private val shapePath = Path()
  private val holePath = Path()
  private val playPath = Path()
  private val statusPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.TRANSPARENT }
  private val playPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }
  private val clearPaint =
    Paint(Paint.ANTI_ALIAS_FLAG).apply { xfermode = PorterDuffXfermode(PorterDuff.Mode.CLEAR) }

  private var status: String? = null
  private var statusSize = 0f
  private var mobile = false

  init {
    clipChildren = false
    clipToPadding = false
  }

  fun setStatus(value: String?) {
    if (status == value) return
    status = value
    invalidate()
  }

  fun setStatusSize(value: Float) {
    if (statusSize == value) return
    statusSize = value
    invalidate()
  }

  fun setMobile(value: Boolean) {
    if (mobile == value) return
    mobile = value
    invalidate()
  }

  fun setStatusColor(color: Int?) {
    val next = color ?: Color.TRANSPARENT
    if (statusPaint.color == next) return
    statusPaint.color = next
    invalidate()
  }

  fun setPlayColor(color: Int?) {
    val next = color ?: Color.WHITE
    if (playPaint.color == next) return
    playPaint.color = next
    invalidate()
  }

  override fun dispatchDraw(canvas: Canvas) {
    val kind = status
    if (kind == null || statusSize <= 0f) {
      super.dispatchDraw(canvas)
      return
    }

    val pad = STATUS_PADDING_DP.dpToPx()
    val s = statusSize.dpToPx()
    val phone = mobile && kind != "streaming"
    val side = s + 2f * pad
    val boxW = side
    val boxH = if (phone) side * PHONE_HEIGHT_SCALE else side
    val boxR = if (phone) side / 4f else side / 2f
    val paddingY = (STATUS_PADDING_DP + if (phone) 1f else 0f).dpToPx()
    val right = width + pad
    val bottom = height + pad
    val left = right - boxW
    val top = bottom - boxH

    cutoutPath.reset()
    cutoutPath.addRoundRect(left, top, right, bottom, boxR, boxR, Path.Direction.CW)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val saved = canvas.save()
      canvas.clipOutPath(cutoutPath)
      super.dispatchDraw(canvas)
      canvas.restoreToCount(saved)
    } else {
      val saved = canvas.saveLayer(0f, 0f, width.toFloat(), height.toFloat(), null)
      super.dispatchDraw(canvas)
      canvas.drawPath(cutoutPath, clearPaint)
      canvas.restoreToCount(saved)
    }

    drawStatus(canvas, kind, phone, s, left + pad, top + paddingY, if (phone) boxH - 2f * paddingY else s)
  }

  private fun drawStatus(
    canvas: Canvas,
    kind: String,
    phone: Boolean,
    s: Float,
    shapeLeft: Float,
    shapeTop: Float,
    shapeH: Float,
  ) {
    val shapeR = if (phone) s * PHONE_RADIUS_RATIO else s / 2f
    shapePath.reset()
    shapePath.addRoundRect(
      shapeLeft,
      shapeTop,
      shapeLeft + s,
      shapeTop + shapeH,
      shapeR,
      shapeR,
      Path.Direction.CW,
    )

    holePath.reset()
    if (phone) {
      holePath.addRoundRect(
        shapeLeft + s * 0.125f,
        shapeTop + shapeH * (2f / 12f),
        shapeLeft + s * 0.875f,
        shapeTop + shapeH * (9f / 12f),
        s * 0.0625f,
        s * 0.0625f,
        Path.Direction.CW,
      )
    } else {
      when (kind) {
        "idle" ->
          holePath.addRoundRect(
            shapeLeft - s * 0.125f,
            shapeTop - s * 0.125f,
            shapeLeft + s * 0.625f,
            shapeTop + s * 0.625f,
            s * 0.375f,
            s * 0.375f,
            Path.Direction.CW,
          )
        "dnd" ->
          holePath.addRoundRect(
            shapeLeft + s * 0.125f,
            shapeTop + s * 0.375f,
            shapeLeft + s * 0.875f,
            shapeTop + s * 0.625f,
            s * 0.125f,
            s * 0.125f,
            Path.Direction.CW,
          )
        "offline" ->
          holePath.addRoundRect(
            shapeLeft + s * 0.25f,
            shapeTop + s * 0.25f,
            shapeLeft + s * 0.75f,
            shapeTop + s * 0.75f,
            s * 0.25f,
            s * 0.25f,
            Path.Direction.CW,
          )
      }
    }

    if (!holePath.isEmpty) shapePath.op(holePath, Path.Op.DIFFERENCE)
    canvas.drawPath(shapePath, statusPaint)

    if (kind == "streaming") {
      playPath.reset()
      playPath.moveTo(shapeLeft + s * 0.38f, shapeTop + s * 0.28f)
      playPath.lineTo(shapeLeft + s * 0.76f, shapeTop + s * 0.50f)
      playPath.lineTo(shapeLeft + s * 0.38f, shapeTop + s * 0.72f)
      playPath.close()
      canvas.drawPath(playPath, playPaint)
    }
  }
}

@ReactModule(name = CutoutViewManager.NAME)
class CutoutViewManager :
  ViewGroupManager<CutoutView>(),
  IsocordCutoutViewManagerInterface<CutoutView> {
  private val delegate = IsocordCutoutViewManagerDelegate(this)

  override fun getDelegate(): ViewManagerDelegate<CutoutView> = delegate

  override fun getName(): String = NAME

  override fun createViewInstance(context: ThemedReactContext): CutoutView = CutoutView(context)

  override fun setStatus(view: CutoutView, value: String?) = view.setStatus(value)

  override fun setStatusSize(view: CutoutView, value: Float) = view.setStatusSize(value)

  override fun setMobile(view: CutoutView, value: Boolean) = view.setMobile(value)

  override fun setStatusColor(view: CutoutView, value: Int?) = view.setStatusColor(value)

  override fun setPlayColor(view: CutoutView, value: Int?) = view.setPlayColor(value)

  companion object {
    const val NAME = "IsocordCutoutView"
  }
}
