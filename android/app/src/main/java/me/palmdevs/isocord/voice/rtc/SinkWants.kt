package me.palmdevs.isocord.voice.rtc

import kotlinx.serialization.Serializable
import org.json.JSONObject

/** Keys of a Media Sink Wants payload that aren't SSRCs (docs.discord.food, Media Sink Wants). */
private const val ANY = "any"
private const val PIXEL_COUNTS = "pixelCounts"

/** What the server wants us to send (op 15 received): a quality per SSRC of ours, and a default. */
class IncomingWants private constructor(
  private val bySsrc: Map<Long, Int>,
  private val any: Int,
  private val pixelCounts: Map<Long, Long>,
) {
  /** Returns the quality for one of our streams. An entry counts even at 0, which turns the stream off. */
  fun quality(ssrc: Long): Int = bySsrc[ssrc] ?: any

  /** Returns the pixel count a viewer shows our stream at, or 0 when unknown. */
  fun pixelCount(ssrc: Long): Long = pixelCounts[ssrc] ?: 0L

  companion object {
    /** Everything at full quality until the server says otherwise (BaseConnection.tsx `remoteVideoSinkWants`). */
    val ALL = IncomingWants(emptyMap(), WANT_ALL, emptyMap())

    fun parse(d: JSONObject): IncomingWants {
      val bySsrc = mutableMapOf<Long, Int>()
      d.keys().forEach { key -> key.toLongOrNull()?.let { bySsrc[it] = d.getInt(key) } }
      val counts = d.optJSONObject(PIXEL_COUNTS)
      val pixelCounts = counts?.keys()?.asSequence()?.mapNotNull { key ->
        key.toLongOrNull()?.let { it to counts.getLong(key) }
      }?.toMap().orEmpty()
      return IncomingWants(bySsrc, d.optInt(ANY, WANT_ALL), pixelCounts)
    }
  }
}

/** A video stream of a remote user: one simulcast layer (op 12 `streams`). */
data class RemoteLayer(val ssrc: Long, val quality: Int)

/**
 * `setSinkWants` JSON (voiceTypes.ts `SinkWants`): what we want to receive. Native turns users into SSRCs.
 * [any] covers streams of users not in [users]. Qualities run from 0 to 100.
 */
@Serializable
data class SinkWants(
  val any: Int = WANT_ALL,
  val users: Map<String, Int> = emptyMap(),
  val pixelCounts: Map<String, Long> = emptyMap(),
) {
  /**
   * Returns the op 15 payload (RTCMediaSinkWantsManager.tsx `update`): a quality per video SSRC and pixel counts per
   * SSRC. A user with several layers gets their best one at a high quality, else their lowest, and 0 on the rest.
   * The payload's `any` stays full, as the reference's `getDefaultWants` does: it also covers audio SSRCs, so 0
   * there silences everyone. [any] applies per video layer instead.
   */
  fun toPayload(streams: Map<String, List<RemoteLayer>>): JSONObject {
    val payload = JSONObject().put(ANY, WANT_ALL)
    val counts = JSONObject()
    for ((userId, layers) in streams) {
      val quality = users[userId] ?: any
      val chosen = chosen(layers, quality)
      for (layer in layers) {
        payload.put("${layer.ssrc}", if (layer == chosen) quality else WANT_NONE)
        if (layer == chosen) pixelCounts[userId]?.let { counts.put("${layer.ssrc}", it) }
      }
    }
    if (counts.length() > 0) payload.put(PIXEL_COUNTS, counts)
    return payload
  }

  private fun chosen(layers: List<RemoteLayer>, quality: Int): RemoteLayer? =
    if (quality <= WANT_NONE) null
    else if (quality > QUALITY_LOW) layers.maxByOrNull { it.quality }
    else layers.minByOrNull { it.quality }
}
