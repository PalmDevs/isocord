package me.palmdevs.isocord.chat.media

import android.content.Context
import android.os.Build
import androidx.annotation.DrawableRes
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.painter.BitmapPainter
import androidx.compose.ui.graphics.painter.Painter
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.imageResource
import coil3.ImageLoader
import coil3.PlatformContext
import coil3.SingletonImageLoader
import coil3.disk.DiskCache
import coil3.gif.AnimatedImageDecoder
import coil3.gif.GifDecoder
import coil3.map.Mapper
import coil3.memory.MemoryCache
import coil3.network.okhttp.OkHttpNetworkFetcherFactory
import coil3.request.Options
import coil3.request.crossfade
import coil3.size.pxOrElse
import com.facebook.react.modules.network.OkHttpClientProvider
import java.util.concurrent.ConcurrentHashMap
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import me.palmdevs.isocord.chat.rows.Media
import okio.Path.Companion.toOkioPath

/**
 * An image served by Discord's media proxy. Rows carry the plain proxy URL.
 * The loader ([ProxyImageMapper]) asks for just the laid-out tile size, since only native code knows it.
 */
@Immutable
data class ProxyImage(
  val url: String,
  /** The source size, when known; lets the request cover the tile without stretching. 0 when unknown. */
  val width: Int = 0,
  val height: Int = 0,
  /** Keep GIFs animated. A GIF that only serves as a poster for a video asks for a still instead. */
  val animated: Boolean = true,
)

fun Media.proxied(animated: Boolean = true) = ProxyImage(url, width, height, animated)

/** Animated WebP is decoded frame by frame, so GIFs are fetched smaller than stills. */
private const val ANIMATED_MAX_PIXELS = 640

/** Hosts of the media proxy: media.discordapp.net and images-ext-N.discordapp.net. */
private fun isProxy(url: String): Boolean {
  val host = url.substringAfter("://", "").substringBefore('/')
  return host.endsWith(".discordapp.net")
}

/** Turns a [ProxyImage] into the proxy URL for the size Coil resolved from the layout (`options.size`). */
internal class ProxyImageMapper : Mapper<ProxyImage, String> {
  override fun map(data: ProxyImage, options: Options): String {
    val boxWidth = options.size.width.pxOrElse { 0 }
    val boxHeight = options.size.height.pxOrElse { 0 }
    if (boxWidth == 0 || boxHeight == 0 || !isProxy(data.url)) return data.url
    val gif = data.animated && data.url.substringBefore('?').endsWith(".gif", ignoreCase = true)

    val size = if (data.width > 0 && data.height > 0) {
      // The smallest copy that still covers the box (tiles crop), and never an upscale of the source.
      var scale = min(max(boxWidth.toFloat() / data.width, boxHeight.toFloat() / data.height), 1f)
      if (gif) scale = min(scale, ANIMATED_MAX_PIXELS.toFloat() / max(data.width, data.height))
      "width=${(data.width * scale).roundToInt()}&height=${(data.height * scale).roundToInt()}"
    } else {
      // Unknown shape: fix one side and let the proxy keep the aspect ratio.
      "width=${min(max(boxWidth, boxHeight), if (gif) ANIMATED_MAX_PIXELS else Int.MAX_VALUE)}"
    }
    val separator = if ('?' in data.url) '&' else '?'
    return "${data.url}${separator}format=webp&$size${if (gif) "&animated=true" else ""}"
  }
}

private const val DISK_CACHE_BYTES = 256L * 1024 * 1024

/** The app-wide loader: size-aware proxy URLs, animated decoders for APNG, GIF and animated WebP, and explicit caches. */
internal fun buildImageLoader(context: PlatformContext): ImageLoader =
  ImageLoader.Builder(context)
    .components {
      // React Native's client (IsocordNetwork), so images carry the official client's User-Agent and TLS setup.
      add(OkHttpNetworkFetcherFactory(callFactory = { OkHttpClientProvider.getOkHttpClient() }))
      add(ProxyImageMapper())
      add(ApngDecoder.Factory())
      add(if (Build.VERSION.SDK_INT >= 28) AnimatedImageDecoder.Factory() else GifDecoder.Factory())
    }
    .memoryCache { MemoryCache.Builder().maxSizePercent(context, 0.25).build() }
    .diskCache {
      DiskCache.Builder().directory(context.cacheDir.resolve("chat_images").toOkioPath()).maxSizeBytes(DISK_CACHE_BYTES).build()
    }
    // List items pop in; a crossfade would run an animation for every image that scrolls into view.
    .crossfade(false)
    .build()

/**
 * The memory cache entry of the largest loaded copy of [url]. Each tile size is its own entry.
 * The media viewer starts on it while its own copy loads. A smaller view shows it instead of fetching ([ProxyImageView]).
 */
internal fun loadedCopy(context: Context, url: String): MemoryCache.Key? {
  val cache = SingletonImageLoader.get(context).memoryCache ?: return null
  return cache.keys
    .filter { it.key == url || it.key.startsWith("$url?") || it.key.startsWith("$url&") }
    .maxByOrNull { key -> cache[key]?.image?.let { it.width.toLong() * it.height } ?: 0L }
}

/** Raster drawables shown in many rows (mention icons, the add reaction button), decoded once per process. */
private val resourceBitmaps = ConcurrentHashMap<Int, ImageBitmap>()

/**
 * [androidx.compose.ui.res.painterResource] for a PNG, decoded once: painterResource decodes the file again in every
 * new composition, which is every row that scrolls into view.
 */
@Composable
internal fun cachedPainter(@DrawableRes id: Int): Painter {
  val resources = LocalContext.current.resources
  val bitmap = resourceBitmaps.getOrPut(id) { ImageBitmap.imageResource(resources, id) }
  return remember(bitmap) { BitmapPainter(bitmap) }
}
