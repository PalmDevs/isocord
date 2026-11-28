package me.palmdevs.isocord.voice.rtc

import android.util.Log
import me.palmdevs.isocord.voice.LocalVideo
import me.palmdevs.isocord.voice.MAX_FRAMERATE
import me.palmdevs.isocord.voice.MAX_HEIGHT
import me.palmdevs.isocord.voice.MAX_WIDTH
import me.palmdevs.isocord.voice.StreamType
import me.palmdevs.isocord.voice.stream.GO_LIVE_BITRATE_MAX
import me.palmdevs.isocord.voice.stream.StreamQuality
import me.palmdevs.isocord.voice.stream.StreamResolution
import me.palmdevs.isocord.voice.stream.StreamResolutionType
import org.json.JSONArray
import org.json.JSONObject
import org.webrtc.RtpSender
import org.webrtc.VideoTrack

/** Without READY streams, video takes the SSRC after the audio one, its RTX the next (`_handleReady`). */
private const val VIDEO_SSRC_OFFSET = 1L
private const val RTX_SSRC_OFFSET = 2L

/** One simulcast layer we send. Its SSRCs come from READY, and 0 means the server gave it none. */
class VideoLayer(val rid: String, val quality: Int) {
  var ssrc = 0L
  var rtxSsrc = 0L
  /** The sender that carries it. Layers are separate senders: Discord's answer has no RID header extension. */
  var sender: RtpSender? = null
  /** The last target set on the sender, so unchanged ones skip a `setParameters`. */
  var applied: LayerTarget? = null
}

/**
 * The video layers of one connection: the camera's high and low layer, or the one Go Live layer, none for a
 * viewer. Announced in Identify, given SSRCs by READY, then tuned to the server's wants.
 */
class VideoLayers(
  private val tag: String,
  private val type: String,
  /** Channel `video_quality_mode` is full: never scale down for bandwidth. */
  private val full: Boolean,
  private val layers: List<VideoLayer>,
) {
  /** Layers we announce, assigned or not. */
  val size get() = layers.size

  /** Layers the server assigned SSRCs to. */
  val assigned get() = layers.filter { it.ssrc != 0L }

  /** The Identify `streams` we announce (RTCControlSocket.tsx `identify`, `getVideoStreamParameters`). */
  fun announce(): JSONArray = JSONArray().also { streams ->
    layers.forEach { streams.put(JSONObject().put("type", type).put("rid", it.rid).put("quality", it.quality)) }
  }

  /** Takes the SSRCs from READY `streams`. Without them the first layer uses the ones next to the audio SSRC. */
  fun assign(ready: JSONArray?, audioSsrc: Long) {
    val streams = List(ready?.length() ?: 0) { ready!!.getJSONObject(it) }
    layers.forEachIndexed { index, layer ->
      val stream = streams.firstOrNull { it.optString("rid") == layer.rid && it.optLong("ssrc") != 0L }
      when {
        stream != null -> {
          layer.ssrc = stream.getLong("ssrc")
          layer.rtxSsrc = stream.optLong("rtx_ssrc").takeIf { it != 0L } ?: (layer.ssrc + 1)
        }
        index == 0 -> {
          layer.ssrc = audioSsrc + VIDEO_SSRC_OFFSET
          layer.rtxSsrc = audioSsrc + RTX_SSRC_OFFSET
        }
        else -> layer.ssrc = 0L
      }
    }
    Log.i(tag, "video layers: ${assigned.map { "${it.rid}=${it.ssrc}/${it.rtxSsrc}" }}")
  }

  /** Pairs the layers with their senders, in order. */
  fun bind(senders: List<RtpSender>) {
    layers.forEachIndexed { index, layer ->
      layer.sender = senders.getOrNull(index)
      layer.applied = null
    }
  }

  /** Sends [track] on every assigned layer, or stops them with null. */
  fun setTrack(track: VideoTrack?) = assigned.forEach { it.sender?.setTrack(track, false) }

  /**
   * Sets each layer's encoding for the server's wants. A layer nobody wants is inactive, so it sends nothing
   * while the camera stays on.
   */
  fun apply(video: LocalVideo?, wants: IncomingWants) {
    for (layer in assigned) {
      val sender = layer.sender ?: continue
      val target = target(layer, video, wants)
      if (target == layer.applied) continue
      val parameters = sender.parameters
      val encoding = parameters.encodings.firstOrNull()
      if (encoding == null) {
        Log.w(tag, "layer ${layer.rid} has no encoding")
        continue
      }
      encoding.active = target.active
      if (target.active && video != null) {
        encoding.maxBitrateBps = target.maxBitrate
        encoding.maxFramerate = video.framerate
        encoding.scaleResolutionDownBy = target.scaleDownBy(video.height)
      }
      if (sender.setParameters(parameters)) layer.applied = target else Log.w(tag, "layer ${layer.rid} refused $target")
    }
  }

  /**
   * Returns the `streams` of Video (op 12): every assigned layer, active while a source runs (`video`). Go Live
   * announces its preset's box, not the capture size (native Connection.tsx `setDesktopEncodingOptions`).
   */
  fun toJson(video: LocalVideo?): JSONArray = JSONArray().also { streams ->
    val quality = if (type == StreamType.SCREEN) video?.quality ?: StreamQuality.DEFAULT else null
    assigned.forEach { layer ->
      val camera = if (quality == null) cameraTarget(layer.quality, WANT_ALL, full) else null
      val resolution = camera?.let { fixedResolution(it.height * MAX_WIDTH / MAX_HEIGHT, it.height) }
        ?: maxResolution(quality!!)
      streams.put(
        JSONObject()
          .put("type", video?.type ?: type)
          .put("rid", layer.rid)
          .put("ssrc", layer.ssrc)
          .put("rtx_ssrc", layer.rtxSsrc)
          .put("active", video != null)
          .put("quality", layer.quality)
          .put("max_bitrate", camera?.maxBitrate ?: GO_LIVE_BITRATE_MAX)
          .put("max_framerate", quality?.framerate ?: MAX_FRAMERATE)
          .put("max_resolution", resolution),
      )
    }
  }

  private fun target(layer: VideoLayer, video: LocalVideo?, wants: IncomingWants): LayerTarget {
    val want = wants.quality(layer.ssrc)
    return when {
      video == null -> LayerTarget.OFF
      video.type == StreamType.SCREEN ->
        screenTarget(want, wants.pixelCount(layer.ssrc), video.width, video.height, video.framerate)
      else -> cameraTarget(layer.quality, want, full)
    }
  }

  companion object {
    /** Camera: a high and a low layer. Go Live: one. A viewer sends no video. */
    fun create(tag: String, stream: Boolean, viewer: Boolean, full: Boolean): VideoLayers {
      val high = VideoLayer("$QUALITY_HIGH", QUALITY_HIGH)
      val layers = when {
        viewer -> emptyList()
        stream -> listOf(high)
        else -> listOf(high, VideoLayer("$QUALITY_LOW", QUALITY_LOW))
      }
      return VideoLayers(tag, if (stream) StreamType.SCREEN else StreamType.VIDEO, full, layers)
    }
  }
}

/** A `max_resolution` of a fixed size (docs.discord.food, Stream Resolution). */
private fun fixedResolution(width: Int, height: Int): JSONObject =
  JSONObject().put("type", StreamResolutionType.FIXED).put("width", width).put("height", height)

/** Returns a Go Live `max_resolution`: the preset's box, or the source size as 0 by 0. */
private fun maxResolution(quality: StreamQuality): JSONObject =
  if (quality.resolution == StreamResolution.SOURCE) {
    JSONObject().put("type", StreamResolutionType.SOURCE).put("width", 0).put("height", 0)
  } else {
    fixedResolution(quality.boxWidth, quality.resolution)
  }
