package me.palmdevs.isocord.chat.viewer

import android.annotation.SuppressLint
import android.content.Context
import android.util.Log
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import me.palmdevs.isocord.chat.media.PlayButton
import me.palmdevs.isocord.network.Discord

/**
 * MediaModalYoutube and MediaModalTiktok: the provider's player in a web view over the still, once the play button
 * is pressed, until the page is left. The YouTube page is the reference's iframe API page on discord.com.
 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
internal fun HostedPlayer(source: ViewerSource, active: Boolean) {
  var playing by remember { mutableStateOf(false) }
  LaunchedEffect(active) { if (!active) playing = false }
  // Playback never continues once the app leaves the screen (as rememberMedia does for videos).
  val lifecycle = LocalLifecycleOwner.current.lifecycle
  DisposableEffect(lifecycle) {
    val observer = LifecycleEventObserver { _, event -> if (event == Lifecycle.Event.ON_STOP) playing = false }
    lifecycle.addObserver(observer)
    onDispose { lifecycle.removeObserver(observer) }
  }
  val embedUrl = source.embedUrl ?: return
  if (!playing) {
    Box(Modifier.fillMaxSize()) { PlayButton(Modifier.align(Alignment.Center)) { playing = true } }
    return
  }
  AndroidView(
    factory = { context ->
      WebView(context).apply {
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        overScrollMode = WebView.OVER_SCROLL_NEVER
        setBackgroundColor(android.graphics.Color.BLACK)
        webChromeClient = WebChromeClient()
        if (source.provider == "youtube") {
          youtubePage(context, embedUrl)?.let { loadDataWithBaseURL(Discord.WEB_URL, it, "text/html", "utf-8", null) }
        } else {
          tiktokPage(embedUrl)?.let { loadUrl(it) }
        }
      }
    },
    onRelease = { it.destroy() },
    modifier = Modifier.fillMaxSize(),
  )
}

private const val TAG = "IsocordMediaViewer"

// YOUTUBE_EMBED_PAGE_TYPE.
private const val YOUTUBE_PAGE_TYPE = "2"

private const val YOUTUBE_PAGE_ASSET = "youtube_player.html"

// The start time is digits only: it is written into the page's script unquoted.
private val YOUTUBE_EMBED =
  Regex("""https://www\.youtube\.com/embed/([A-Za-z0-9_-]{11})(\?(?:start=(\d+)|clip=([A-Za-z0-9_-]+)(?:&clipt=([A-Za-z0-9_-]+))?))?""")

private val TIKTOK_EMBED = Regex("""https://www\.tiktok\.com/player/v1/\d+(\?[A-Za-z0-9_=&.%-]*)?""")

/**
 * MediaModalYoutube's page (getYoutubeVideoIdFromURI, getYoutubeClipVideoIdFromURI), playing at once: play was pressed.
 * Null when [embedUrl] is not a YouTube embed, so no part of it reaches the page's script.
 */
private fun youtubePage(context: Context, embedUrl: String): String? {
  val match = YOUTUBE_EMBED.matchEntire(embedUrl)
  if (match == null) {
    Log.w(TAG, "Not a YouTube embed URL: $embedUrl")
    return null
  }
  val (id, start, clip, clipt) = match.destructured
  val extra = when {
    start.isNotEmpty() -> "'start': $start,"
    clip.isNotEmpty() -> "'clip': '$clip', 'clipt': '$clipt',"
    else -> ""
  }
  return context.assets.open(YOUTUBE_PAGE_ASSET).bufferedReader().use { it.readText() }
    .replace("{{VIDEO_ID}}", id)
    .replace("{{PAGE_TYPE}}", YOUTUBE_PAGE_TYPE)
    .replace("{{EXTRA}}", extra)
}

/** MediaModalTiktok's player URL, with the player's own controls (the reference draws its own over a bare player). */
private fun tiktokPage(embedUrl: String): String? {
  if (!TIKTOK_EMBED.matches(embedUrl)) {
    Log.w(TAG, "Not a TikTok embed URL: $embedUrl")
    return null
  }
  val separator = if ('?' in embedUrl) '&' else '?'
  return "$embedUrl${separator}controls=1&autoplay=1&enable_music_info=0&enable_timestamp=0&utm_source=discord.gg"
}
