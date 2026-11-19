package me.palmdevs.isocord.expressions

import android.content.Context
import android.graphics.drawable.Animatable
import android.graphics.drawable.Drawable
import android.os.Handler
import android.os.Looper
import android.util.LruCache
import androidx.compose.runtime.RememberObserver
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import coil3.BitmapImage
import coil3.Image
import coil3.ImageLoader
import coil3.asDrawable
import coil3.decode.BitmapFactoryDecoder
import coil3.request.CachePolicy
import coil3.request.Disposable
import coil3.request.ImageRequest
import coil3.request.allowHardware
import coil3.request.target
import kotlinx.coroutines.channels.Channel

/*
 * The grid's images, kept like Telegram's ImageReceiver rather than one Compose painter per item.
 * A row holds its items' images. A decoded still is drawn at once from our own cache.
 * The others go to Coil, off the main thread, a frame's budget at a time.
 */

/** Time a frame may spend starting loads, in ns: at least one row starts each frame however long it takes. */
private const val LOAD_BUDGET_NS = 4_000_000L
/** Decoded still images kept for the grids (33dp emojis are ~30KB each). */
private const val STILL_CACHE_BYTES = 24 * 1024 * 1024

/** Still images by size and url, shared by every grid. */
private val stills = object : LruCache<String, ImageBitmap>(STILL_CACHE_BYTES) {
  override fun sizeOf(key: String, value: ImageBitmap) = value.width * value.height * 4
}

/** An item's image: a still one, or a moving one (an animated emoji), and when it arrived (it fades in). */
class ItemImage(val item: GridItem) {
  var still: ImageBitmap? = null
  var moving: Drawable? = null
  /** Uptime (ms) the image arrived from a load; 0 for one that came from the cache, which shows at once. */
  var arrivedAt = 0L
  var request: Disposable? = null

  val loaded get() = still != null || moving != null
}

/**
 * The images of a row, remembered by its composable. Cached ones are filled in at creation.
 * The rest load when [GridImages] reaches the row. Its draw reads [version], which changes on arrival or animation.
 */
class RowImages(items: List<GridItem>, private val grid: GridImages, private val animate: Boolean) :
  RememberObserver, Drawable.Callback {
  val images = items.map { ItemImage(it) }
  val version = mutableIntStateOf(0)

  override fun onRemembered() {
    var missing = false
    for (image in images) {
      val cached = if (moves(image.item)) null else grid.cached(image.item.url)
      if (cached != null) image.still = cached else missing = true
    }
    grid.attach(this, missing)
  }

  override fun onForgotten() = release()

  override fun onAbandoned() = release()

  private fun release() {
    grid.detach(this)
    for (image in images) {
      image.request?.dispose()
      image.request = null
      (image.moving as? Animatable)?.stop()
      image.moving?.callback = null
    }
  }

  private fun moves(item: GridItem) = item.animated && animate

  /** Asks for the images not loaded yet. */
  fun load() {
    for (image in images) {
      if (image.loaded || image.request != null) continue
      image.request = grid.load(image.item, moves(image.item)) { still, moving ->
        image.request = null
        image.still = still
        image.moving = moving
        image.arrivedAt = android.os.SystemClock.uptimeMillis()
        if (moving != null) {
          moving.callback = this
          if (grid.playing) (moving as? Animatable)?.start()
        }
        version.intValue++
      }
    }
  }

  fun setPlaying(playing: Boolean) {
    for (image in images) {
      val animation = image.moving as? Animatable ?: continue
      if (playing) animation.start() else animation.stop()
    }
  }

  fun redraw() {
    version.intValue++
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

/**
 * The images of one grid: rows on screen (and composed ahead), and rows waiting for loads.
 * [run] starts loads in frame callbacks, [LOAD_BUDGET_NS] a frame, none during a fast fling.
 */
class GridImages(private val context: Context, private val loader: ImageLoader, private val size: Int, private val fast: () -> Boolean) {
  private val rows = LinkedHashSet<RowImages>()
  private val pending = ArrayDeque<RowImages>()
  private val signal = Channel<Unit>(Channel.CONFLATED)

  /** Whether animated images play: not while the grid scrolls. */
  var playing = true
    set(value) {
      if (field == value) return
      field = value
      for (row in rows) row.setPlaying(value)
    }

  fun cached(url: String): ImageBitmap? = stills.get(cacheKey(url))

  private fun cacheKey(url: String) = "$size|$url"

  fun attach(row: RowImages, missing: Boolean) {
    rows += row
    if (missing) {
      pending += row
      signal.trySend(Unit)
    }
  }

  fun detach(row: RowImages) {
    rows -= row
    pending.remove(row)
  }

  /** Loads an image at the grid's size: a plain bitmap (not a hardware one: a fling goes through hundreds). */
  fun load(item: GridItem, moving: Boolean, done: (still: ImageBitmap?, moving: Drawable?) -> Unit): Disposable {
    val request = ImageRequest.Builder(context)
      .data(item.url)
      .size(size)
      .allowHardware(false)
      // The grid keeps its own decoded images.
      .memoryCachePolicy(CachePolicy.DISABLED)
      .apply { if (!moving) decoderFactory(BitmapFactoryDecoder.Factory()) }
      .target(onSuccess = { image -> deliver(item, image, moving, done) })
      .build()
    return loader.enqueue(request)
  }

  private fun deliver(item: GridItem, image: Image, moving: Boolean, done: (ImageBitmap?, Drawable?) -> Unit) {
    if (moving) {
      val drawable = image.asDrawable(context.resources)
      if (drawable is Animatable) return done(null, drawable)
    }
    val bitmap = (image as? BitmapImage)?.bitmap?.asImageBitmap() ?: return
    if (!moving) stills.put(cacheKey(item.url), bitmap)
    done(bitmap, null)
  }

  /** Starts the waiting rows' loads, a frame's budget at a time. Runs for as long as the grid is shown. */
  suspend fun run() {
    while (true) {
      signal.receive()
      while (pending.isNotEmpty()) {
        withFrameNanos { }
        if (fast()) continue
        val start = System.nanoTime()
        while (pending.isNotEmpty() && System.nanoTime() - start < LOAD_BUDGET_NS) pending.removeFirst().load()
      }
    }
  }
}
