package me.palmdevs.isocord.voice.rtc

import android.util.Log
import kotlin.time.Duration
import kotlin.time.Duration.Companion.seconds
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull

/** How long an ICE restart gets to bring our own stream's peer back. */
private val ICE_RESTART_TIMEOUT = 8.seconds

/** How long a full voice gateway reconnect gets, handshake included. */
private val REBUILD_TIMEOUT = 15.seconds

/** Full reconnects before giving the connection up to JS. */
private const val REBUILD_ATTEMPTS = 2

/** Pause before a retried full reconnect, times the retries so far. The first one starts at once. */
private val REBUILD_BACKOFF = 1.seconds

/** A peer that reports `disconnected` often heals by itself. It gets this long before recovery starts. */
private val DISCONNECT_GRACE = 3.seconds

/** Wait after a network change, so a flapping network starts one recovery. */
private val NETWORK_SETTLE = 1.seconds

/** How long to wait for a network before giving up. */
private val OFFLINE_LIMIT = 30.seconds

/** What a recovery asks of its connection. All calls run on the connection's serial dispatcher. */
interface RecoveryHost {
  /** Whether a full reconnect is possible. Our own Go Live stream can't, its screen consent was used once. */
  val canRebuild: Boolean

  /** Tells JS the connection is `reconnecting`. */
  fun onRecoveryStarted()

  /** Sends a new Select Protocol with fresh ICE credentials on the live voice gateway. Only without [canRebuild]. */
  suspend fun restartIce()

  /** Closes the voice gateway and the peer and opens them again, with a fresh Identify. */
  suspend fun rebuild()

  /** Nothing worked. The connection is gone and JS decides whether to rejoin. */
  fun onRecoveryFailed(code: Int?)
}

/**
 * Brings the media path back without a rejoin through the main gateway. Discord's client reconnects the voice
 * gateway from Identify at once when the media connection drops (RTCConnection.tsx: RTC_DISCONNECTED calls
 * `reconnect`, `_scheduleReconnect` retries). Our own Go Live stream can't, so it tries an ICE restart instead.
 */
class ConnectionRecovery(
  private val scope: CoroutineScope,
  private val host: RecoveryHost,
  private val online: StateFlow<Boolean>,
  private val tag: String,
) {
  private var job: Job? = null
  private var attempt: CompletableDeferred<Boolean>? = null
  private var graceJob: Job? = null

  val active get() = job?.isActive == true

  /** The peer reports `disconnected`: waits a short while, then recovers unless it healed. */
  fun onPeerDisconnected() {
    if (active || graceJob?.isActive == true) return
    graceJob = scope.launch {
      delay(DISCONNECT_GRACE)
      begin("peer disconnected", settle = false, iceRestart = true)
    }
  }

  /** The peer failed. A running recovery counts it as a failed step, since its own steps make the peer fail too. */
  fun onPeerFailed() {
    if (active) attempt?.complete(false) else start("peer failed", settle = false)
  }

  /** The peer is connected again, or still is. */
  fun onConnected() {
    graceJob?.cancel()
    attempt?.complete(true)
  }

  /**
   * The network changed or the voice gateway is gone, or the peer failed. Restarts a running recovery.
   * Without [iceRestart] our own stream gives up at once, for a gateway that can't carry Select Protocol.
   */
  fun start(reason: String, settle: Boolean, iceRestart: Boolean = true) {
    graceJob?.cancel()
    begin(reason, settle, iceRestart)
  }

  private fun begin(reason: String, settle: Boolean, iceRestart: Boolean) {
    job?.cancel()
    job = scope.launch {
      Log.w(tag, "recovering: $reason")
      host.onRecoveryStarted()
      if (settle) delay(NETWORK_SETTLE)
      when {
        host.canRebuild -> rebuild()
        !iceRestart || !tryStep(ICE_RESTART_TIMEOUT, host::restartIce) -> fail(null)
      }
    }
  }

  /** The voice gateway of a full reconnect closed. [fatal] closes mean the server won't take us back. */
  fun onGatewayGone(code: Int?, fatal: Boolean) {
    if (fatal) fail(code) else attempt?.complete(false)
  }

  fun cancel() {
    graceJob?.cancel()
    job?.cancel()
  }

  private suspend fun rebuild() {
    for (retry in 0 until REBUILD_ATTEMPTS) {
      delay(REBUILD_BACKOFF * retry)
      if (tryStep(REBUILD_TIMEOUT, host::rebuild)) return
    }
    fail(null)
  }

  private fun fail(code: Int?) {
    Log.w(tag, "recovery failed")
    job?.cancel()
    host.onRecoveryFailed(code)
  }

  /** Runs [step], then waits for the peer to connect. Returns false on a timeout or a closed gateway. */
  private suspend fun tryStep(timeout: Duration, step: suspend () -> Unit): Boolean {
    if (withTimeoutOrNull(OFFLINE_LIMIT) { online.first { it } } == null) return false
    val result = CompletableDeferred<Boolean>().also { attempt = it }
    try {
      step()
    } catch (e: CancellationException) {
      throw e
    } catch (e: RuntimeException) {
      Log.e(tag, "recovery step failed", e)
      attempt = null
      return false
    }
    val connected = withTimeoutOrNull(timeout) { result.await() } ?: false
    attempt = null
    return connected
  }
}
