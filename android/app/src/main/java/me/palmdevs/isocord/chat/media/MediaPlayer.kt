package me.palmdevs.isocord.chat.media

import android.view.TextureView
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import kotlinx.coroutines.delay

/**
 * Inline playback of user-started videos and audio, on media3 ExoPlayer.
 * A player exists only while wanted: disposed rows release it, and starting a clip releases the previous one.
 * GIF-style loops: see Gifv.kt.
 */
object PlaybackCoordinator {
  /** The id of the video or audio clip that currently owns playback. */
  var active by mutableStateOf<String?>(null)
}

class MediaState(val id: String) {
  var player by mutableStateOf<ExoPlayer?>(null)
  var playing by mutableStateOf(false)
  var positionMs by mutableLongStateOf(0L)
  var durationMs by mutableLongStateOf(0L)
  var speed by mutableFloatStateOf(1f)

  fun setPlaybackSpeed(newSpeed: Float) {
    speed = newSpeed
    player?.setPlaybackSpeed(newSpeed)
  }

  /** The user asked for playback; a player is created and kept (even when paused) until another clip takes over. */
  var requested by mutableStateOf(false)

  fun toggle() {
    val p = player
    PlaybackCoordinator.active = id
    when {
      p == null -> requested = true
      playing -> p.pause()
      else -> p.play()
    }
  }

  fun seek(fraction: Float) {
    val p = player
    if (p == null) {
      requested = true
      return
    }
    if (durationMs > 0) {
      p.seekTo((durationMs * fraction.coerceIn(0f, 1f)).toLong())
      positionMs = p.currentPosition
    }
  }
}

@Composable
fun rememberMedia(id: String, url: String): MediaState {
  val context = LocalContext.current
  val state = remember(id) { MediaState(id) }
  val active = PlaybackCoordinator.active
  LaunchedEffect(active) {
    if (active != id) state.requested = false
  }

  val lifecycle = LocalLifecycleOwner.current.lifecycle
  DisposableEffect(state.requested, url) {
    if (!state.requested) return@DisposableEffect onDispose {}
    val player = ExoPlayer.Builder(context).build().apply {
      setAudioAttributes(
        AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MOVIE).build(),
        true,
      )
      setMediaItem(MediaItem.fromUri(url))
      setPlaybackSpeed(state.speed)
      playWhenReady = true
      prepare()
    }
    val listener = object : Player.Listener {
      override fun onIsPlayingChanged(isPlaying: Boolean) {
        state.playing = isPlaying
      }

      override fun onPlaybackStateChanged(playbackState: Int) {
        if (playbackState == Player.STATE_READY) state.durationMs = player.duration.coerceAtLeast(0L)
        if (playbackState == Player.STATE_ENDED) {
          // Back to the start, paused, so the play button returns.
          player.seekTo(0)
          player.pause()
          state.positionMs = 0
        }
      }
    }
    player.addListener(listener)
    // Playback never continues once the app leaves the screen.
    val observer = LifecycleEventObserver { _, event ->
      if (event == Lifecycle.Event.ON_STOP) player.pause()
    }
    lifecycle.addObserver(observer)
    state.player = player
    onDispose {
      lifecycle.removeObserver(observer)
      state.player = null
      state.playing = false
      player.release()
    }
  }

  val player = state.player
  LaunchedEffect(player, state.playing) {
    if (player == null) return@LaunchedEffect
    while (state.playing) {
      state.positionMs = player.currentPosition
      delay(200)
    }
    state.positionMs = player.currentPosition
  }
  LaunchedEffect(player, state.speed) {
    player?.setPlaybackSpeed(state.speed)
  }
  return state
}

/**
 * Video drawn to cover its box (centre-crop). A TextureView, not a SurfaceView, so it scrolls with the list
 * and clips to rounded corners.
 */
@Composable
fun VideoSurface(player: ExoPlayer, aspect: Float, modifier: Modifier = Modifier) {
  BoxWithConstraints(modifier.clipToBounds()) {
    val boxAspect = maxWidth / maxHeight
    val width = if (aspect > boxAspect) maxHeight * aspect else maxWidth
    val height = if (aspect > boxAspect) maxHeight else maxWidth / aspect
    AndroidView(
      factory = { TextureView(it) },
      update = { view -> player.setVideoTextureView(view) },
      // Pooled players outlive the tile; do not leave them drawing into a dead view.
      onRelease = { view -> player.clearVideoTextureView(view) },
      modifier = Modifier.requiredSize(width, height).align(Alignment.Center),
    )
  }
}

@Composable
fun PlayIcon(color: Color, modifier: Modifier = Modifier) {
  Canvas(modifier) {
    val path = Path().apply {
      moveTo(size.width * 0.2f, 0f)
      lineTo(size.width, size.height / 2)
      lineTo(size.width * 0.2f, size.height)
      close()
    }
    drawPath(path, color)
  }
}

@Composable
fun PauseIcon(color: Color, modifier: Modifier = Modifier) {
  Canvas(modifier) {
    val bar = size.width * 0.3f
    drawRect(color, Offset(size.width * 0.1f, 0f), Size(bar, size.height))
    drawRect(color, Offset(size.width * 0.6f, 0f), Size(bar, size.height))
  }
}

internal fun formatDuration(millis: Long): String {
  val seconds = (millis / 1000).toInt()
  return "${seconds / 60}:${(seconds % 60).toString().padStart(2, '0')}"
}
