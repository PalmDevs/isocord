package me.palmdevs.isocord.voice.stream

import android.graphics.ImageFormat
import android.graphics.Rect
import android.graphics.YuvImage
import android.os.SystemClock
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import kotlin.math.min
import kotlin.math.roundToInt
import org.webrtc.VideoFrame
import org.webrtc.VideoSink

/** Box a preview fits in (VoiceEngineStreamingManager.tsx `setBroadcastThumbnailCallback`, 512 by 288). */
private const val PREVIEW_MAX_WIDTH = 512
private const val PREVIEW_MAX_HEIGHT = 288

/** How often the kept frame is replaced. A screen that doesn't change sends no frames, so one is always kept. */
private const val PREVIEW_REFRESH_MS = 5_000L

/** JPEG quality. The reference's native encoder setting isn't visible, so this is ours. */
private const val PREVIEW_JPEG_QUALITY = 80

/**
 * Keeps a small copy of our screen track for the stream preview JS uploads (`POST /streams/{key}/preview`).
 * Frames arrive on the capture thread. [jpeg] is safe from any thread.
 */
class StreamPreview : VideoSink {
  private val lock = Any()
  // Guarded by lock.
  private var latest: VideoFrame.I420Buffer? = null
  private var refreshedAt = 0L
  private var released = false

  override fun onFrame(frame: VideoFrame) {
    val now = SystemClock.elapsedRealtime()
    synchronized(lock) {
      if (released || (latest != null && now - refreshedAt < PREVIEW_REFRESH_MS)) return
      refreshedAt = now
    }
    val small = scaled(frame.buffer) ?: return
    synchronized(lock) {
      if (released) return small.release()
      latest?.release()
      latest = small
    }
  }

  /** Returns the latest kept frame as a JPEG, or null before the first frame. */
  fun jpeg(): ByteArray? {
    val buffer = synchronized(lock) { latest?.also { it.retain() } } ?: return null
    return try {
      val image = YuvImage(nv21(buffer), ImageFormat.NV21, buffer.width, buffer.height, null)
      ByteArrayOutputStream().also {
        image.compressToJpeg(Rect(0, 0, buffer.width, buffer.height), PREVIEW_JPEG_QUALITY, it)
      }.toByteArray()
    } finally {
      buffer.release()
    }
  }

  fun release() = synchronized(lock) {
    released = true
    latest?.release()
    latest = null
  }

  /** Scales a frame into the preview box, keeping its aspect (the reference's `min(512 / w, 288 / h)`). */
  private fun scaled(buffer: VideoFrame.Buffer): VideoFrame.I420Buffer? {
    val scale = min(PREVIEW_MAX_WIDTH.toFloat() / buffer.width, PREVIEW_MAX_HEIGHT.toFloat() / buffer.height)
    val width = even((buffer.width * scale).roundToInt())
    val height = even((buffer.height * scale).roundToInt())
    val resized = buffer.cropAndScale(0, 0, buffer.width, buffer.height, width, height)
    return try {
      resized.toI420()
    } finally {
      resized.release()
    }
  }
}

/** Rounds down to an even size of at least 2, as I420 chroma planes need. */
private fun even(size: Int) = maxOf(2, size and 1.inv())

/** Returns the planes as NV21: the Y plane, then V and U interleaved. Strides are dropped. */
private fun nv21(buffer: VideoFrame.I420Buffer): ByteArray {
  val width = buffer.width
  val height = buffer.height
  val chromaWidth = (width + 1) / 2
  val chromaHeight = (height + 1) / 2
  val out = ByteArray(width * height + 2 * chromaWidth * chromaHeight)
  copyPlane(buffer.dataY, buffer.strideY, width, height, out)
  var index = width * height
  val u = buffer.dataU
  val v = buffer.dataV
  for (row in 0 until chromaHeight) {
    for (column in 0 until chromaWidth) {
      out[index++] = v.get(row * buffer.strideV + column)
      out[index++] = u.get(row * buffer.strideU + column)
    }
  }
  return out
}

private fun copyPlane(plane: ByteBuffer, stride: Int, width: Int, height: Int, out: ByteArray) {
  val source = plane.duplicate()
  for (row in 0 until height) {
    source.position(row * stride)
    source.get(out, row * width, width)
  }
}
