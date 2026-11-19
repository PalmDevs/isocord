package me.palmdevs.isocord.expressions.gifs

import android.content.Context
import android.graphics.drawable.Animatable
import android.graphics.drawable.Drawable
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import androidx.compose.runtime.RememberObserver
import androidx.compose.runtime.mutableIntStateOf
import coil3.ImageLoader
import coil3.asDrawable
import coil3.request.Disposable
import coil3.request.ImageRequest
import coil3.size.Precision

/*
 * A tile's image, kept like the expression grid's (GridImages): one drawable drawn by the tile's own draw call.
 * No painter per tile, and an animation that holds still while the grid scrolls.
 */

/**
 * The image of one tile, remembered by it. [load] asks Coil for it at the tile's size. The tile's draw reads
 * [version], which changes when it arrives and on every animation frame.
 */
class GifImage(
  private val context: Context,
  private val loader: ImageLoader,
  private val src: String,
) : RememberObserver, Drawable.Callback {
  var drawable: Drawable? = null
    private set
  /** Uptime (ms) the image arrived, for its fade in. */
  var arrivedAt = 0L
    private set
  val version = mutableIntStateOf(0)
  private var request: Disposable? = null
  private var playing = false

  /** Loads the image at [width] x [height] px. Does nothing once loaded or loading. */
  fun load(width: Int, height: Int) {
    if (src.isEmpty() || drawable != null || request != null || width <= 0 || height <= 0) return
    val built = ImageRequest.Builder(context)
      .data(src)
      .size(width, height)
      .precision(Precision.INEXACT)
      .target(onSuccess = { image ->
        request = null
        val arrived = image.asDrawable(context.resources)
        arrived.callback = this
        drawable = arrived
        arrivedAt = SystemClock.uptimeMillis()
        if (playing) (arrived as? Animatable)?.start()
        version.intValue++
      })
      .build()
    request = loader.enqueue(built)
  }

  fun setPlaying(play: Boolean) {
    playing = play
    val animation = drawable as? Animatable ?: return
    if (play) animation.start() else animation.stop()
  }

  fun redraw() {
    version.intValue++
  }

  override fun onRemembered() = Unit

  override fun onForgotten() = release()

  override fun onAbandoned() = release()

  private fun release() {
    request?.dispose()
    request = null
    (drawable as? Animatable)?.stop()
    drawable?.callback = null
  }

  override fun invalidateDrawable(who: Drawable) = redraw()

  override fun scheduleDrawable(who: Drawable, what: Runnable, `when`: Long) {
    handler.postAtTime(what, who, `when`)
  }

  override fun unscheduleDrawable(who: Drawable, what: Runnable) {
    handler.removeCallbacks(what, who)
  }

  private companion object {
    val handler = Handler(Looper.getMainLooper())
  }
}
