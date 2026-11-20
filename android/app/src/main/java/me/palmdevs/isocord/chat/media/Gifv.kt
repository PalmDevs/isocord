package me.palmdevs.isocord.chat.media

import android.content.Context
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.State
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.snapshotFlow
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.findRootCoordinates
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.database.StandaloneDatabaseProvider
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.datasource.cache.LeastRecentlyUsedCacheEvictor
import androidx.media3.datasource.cache.SimpleCache
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit

/*
 * GIF-style videos (Tenor, Giphy, "gifv" embeds): muted, looping, autoplaying.
 * Building and releasing an ExoPlayer is expensive, and a chat holds dozens.
 * They play only while visible and after the list stops moving, on a few pooled players.
 */

/** Players running at once; GIFs further down wait for a slot and keep their poster until one frees up. */
private const val GIFV_MAX_PLAYERS = 3

/** How long the list must be still before a GIF that scrolled into view starts. */
private const val GIFV_SETTLE_MS = 150L

private const val GIFV_CACHE_BYTES = 64L * 1024 * 1024

/** The pool of the chat list on screen. */
val LocalGifvPool = staticCompositionLocalOf<GifvPool> { error("GifvPool not provided") }

/** True while the list is being dragged or flung. */
val LocalChatScrolling = staticCompositionLocalOf<State<Boolean>> { mutableStateOf(false) }

/** One `SimpleCache` per process: a second instance on the same directory throws. Loops and revisits skip the network. */
@UnstableApi
private object GifvCache {
  private var cache: SimpleCache? = null

  @Synchronized
  fun get(context: Context): SimpleCache = cache ?: SimpleCache(
    context.applicationContext.cacheDir.resolve("gifv"),
    LeastRecentlyUsedCacheEvictor(GIFV_CACHE_BYTES),
    StandaloneDatabaseProvider(context.applicationContext),
  ).also { cache = it }
}

@UnstableApi
class GifvPool(private val context: Context) {
  private val idle = ArrayDeque<ExoPlayer>()
  private val slots = Semaphore(GIFV_MAX_PLAYERS)
  private var closed = false

  private fun build(): ExoPlayer {
    val data = CacheDataSource.Factory()
      .setCache(GifvCache.get(context))
      .setUpstreamDataSourceFactory(DefaultHttpDataSource.Factory())
      .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR)
    // GIFs are short and small: a couple of seconds of buffer is plenty, the default asks for fifty.
    val load = DefaultLoadControl.Builder().setBufferDurationsMs(1_000, 2_000, 250, 500).build()
    return ExoPlayer.Builder(context)
      .setMediaSourceFactory(DefaultMediaSourceFactory(data))
      .setLoadControl(load)
      .build()
      .apply {
        repeatMode = Player.REPEAT_MODE_ALL
        volume = 0f
        // They are silent anyway; no audio renderer or decoder needed.
        trackSelectionParameters = trackSelectionParameters.buildUpon().setTrackTypeDisabled(C.TRACK_TYPE_AUDIO, true).build()
      }
  }

  /** Plays [url] on a pooled player while [block] runs, after waiting for a free slot. The player is reset and kept afterwards. */
  suspend fun lease(url: String, block: suspend (ExoPlayer) -> Unit) = slots.withPermit {
    val player = idle.removeLastOrNull() ?: build()
    player.setMediaItem(MediaItem.fromUri(url))
    player.playWhenReady = true
    player.prepare()
    try {
      block(player)
    } finally {
      player.stop()
      player.clearMediaItems()
      player.clearVideoSurface()
      if (closed) player.release() else idle.addLast(player)
    }
  }

  /** Releases the idle players; ones still leased are released as they come back. */
  fun release() {
    closed = true
    idle.forEach { it.release() }
    idle.clear()
  }
}

/** The pool for one chat list, released when the list leaves the screen. */
@Composable
fun rememberGifvPool(): GifvPool {
  val context = LocalContext.current
  val pool = remember { GifvPool(context) }
  DisposableEffect(pool) { onDispose { pool.release() } }
  return pool
}

@Composable
fun rememberChatScrolling(list: LazyListState): State<Boolean> = remember(list) { derivedStateOf { list.isScrollInProgress } }

/**
 * Sets [visible] while at least half of the element is inside the chat view. A row the lazy list only
 * prefetched is never placed, so it stays false. Used on a handful of GIF tiles, not on every row.
 */
fun Modifier.trackVisible(visible: MutableState<Boolean>): Modifier = onGloballyPositioned { coordinates ->
  val bounds = coordinates.boundsInRoot()
  val shown = minOf(bounds.bottom, coordinates.findRootCoordinates().size.height.toFloat()) - maxOf(bounds.top, 0f)
  val now = coordinates.isAttached && shown >= bounds.height / 2
  if (visible.value != now) visible.value = now
}

/**
 * The player for a GIF-style video, or null while it should show its poster: not visible yet, the list is
 * still moving, no pool slot is free, or the app is in the background.
 */
@Composable
fun rememberGifvPlayer(url: String?, visible: State<Boolean>): State<ExoPlayer?> {
  val pool = LocalGifvPool.current
  val scrolling = LocalChatScrolling.current
  val lifecycle = LocalLifecycleOwner.current.lifecycle
  val player = remember { mutableStateOf<ExoPlayer?>(null) }
  LaunchedEffect(url) {
    if (url == null) return@LaunchedEffect
    lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
      snapshotFlow { visible.value }.collectLatest { shown ->
        if (!shown) return@collectLatest
        snapshotFlow { scrolling.value }.first { !it }
        delay(GIFV_SETTLE_MS)
        // Cancelled (and the player returned to the pool) when the tile is no longer visible.
        pool.lease(url) {
          player.value = it
          try {
            awaitCancellation()
          } finally {
            player.value = null
          }
        }
      }
    }
  }
  return player
}
