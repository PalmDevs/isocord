package me.palmdevs.isocord.voice.rtc

import kotlin.coroutines.resume
import kotlin.time.Duration.Companion.milliseconds
import kotlin.time.TimeSource
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import org.webrtc.PeerConnection
import org.webrtc.RTCStats
import org.webrtc.RTCStatsReport

/** How often received audio is counted. */
private val POLL_INTERVAL = 200.milliseconds

/** A user stops speaking after this long without an audio packet: two polls. */
private val SILENCE_TIMEOUT = POLL_INTERVAL * 2

/** A peer being disposed may never answer `getStats`. */
private val STATS_TIMEOUT = POLL_INTERVAL

/** W3C `RTCStats` names (webrtc-stats). */
private const val STATS_INBOUND_RTP = "inbound-rtp"
private const val STATS_KIND = "kind"
private const val STATS_AUDIO = "audio"
private const val STATS_SSRC = "ssrc"
private const val STATS_PACKETS_RECEIVED = "packetsReceived"

/**
 * Remote users' speaking, from received audio. Reference: the native engine's `user-speaking` callback (media-engine
 * Connection.tsx `handleSpeakingNative`). Op 5 only maps a user's SSRC there (RTCConnection `_handleSpeaking`), and
 * Discord sends none when a burst ends. Senders send no audio between bursts, so a user speaks while packets arrive
 * on their SSRC. On the connection's dispatcher.
 */
internal class RemoteSpeaking(
  private val scope: CoroutineScope,
  private val peer: () -> PeerConnection?,
  private val userFor: (ssrc: Long) -> String?,
  private val onChange: (userId: String, speaking: Boolean) -> Unit,
) {
  /** Packets received so far per SSRC. */
  private val packets = mutableMapOf<Long, Long>()
  /** Speaking users, and when audio from them arrived last. */
  private val heard = mutableMapOf<String, TimeSource.Monotonic.ValueTimeMark>()

  fun start() {
    scope.launch {
      while (isActive) {
        delay(POLL_INTERVAL)
        poll()
      }
    }
  }

  /** Op 5 for a user: speaking starts now, or stops. */
  fun onSpeakingOp(userId: String, on: Boolean) = if (on) heard(userId) else stop(userId)

  /** The user left. No event: JS drops their state with them. */
  fun forget(userId: String) {
    heard.remove(userId)
  }

  /** The peer is gone: nobody speaks, and counts start again with the next one. */
  fun reset() {
    packets.clear()
    heard.keys.toList().forEach(::stop)
  }

  private suspend fun poll() {
    val connection = peer() ?: return
    // Without a report, silence can't be told apart from a late answer.
    val report = withTimeoutOrNull(STATS_TIMEOUT) { connection.stats() } ?: return
    report.statsMap.values.forEach(::count)
    heard.filterValues { it.elapsedNow() > SILENCE_TIMEOUT }.keys.forEach(::stop)
  }

  private fun count(stats: RTCStats) {
    if (stats.type != STATS_INBOUND_RTP || stats.members[STATS_KIND] != STATS_AUDIO) return
    val ssrc = (stats.members[STATS_SSRC] as? Number)?.toLong() ?: return
    val received = (stats.members[STATS_PACKETS_RECEIVED] as? Number)?.toLong() ?: return
    val before = packets.put(ssrc, received) ?: 0
    if (received > before) userFor(ssrc)?.let(::heard)
  }

  private fun heard(userId: String) {
    if (heard.put(userId, TimeSource.Monotonic.markNow()) == null) onChange(userId, true)
  }

  private fun stop(userId: String) {
    if (heard.remove(userId) != null) onChange(userId, false)
  }

  private suspend fun PeerConnection.stats(): RTCStatsReport = suspendCancellableCoroutine { done ->
    getStats { report -> if (done.isActive) done.resume(report) }
  }
}
