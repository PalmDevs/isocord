package me.palmdevs.isocord.voice.telecom

import android.net.Uri
import android.os.Build
import android.telecom.DisconnectCause
import android.util.Log
import androidx.annotation.RequiresApi
import androidx.core.telecom.CallAttributesCompat
import androidx.core.telecom.CallControlResult
import androidx.core.telecom.CallControlScope
import androidx.core.telecom.CallEndpointCompat
import androidx.core.telecom.CallsManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.launch

private const val ADDRESS_SCHEME = "isocord"
private const val ADDRESS_PART = "call"
private const val CAPABILITIES = CallsManager.CAPABILITY_BASELINE or CallsManager.CAPABILITY_SUPPORTS_VIDEO_CALLING

/** The call log option needs 36.1, which reports SDK 36. */
private const val LOG_EXCLUDED_SDK = Build.VERSION_CODES.BAKLAVA

/**
 * The Telecom half of a call: one `CallsManager.addCall` that lives as long as the call. Reference: the official
 * `TelecomConnectionService`. Remote surfaces (headsets, watches, the system) act through the `addCall` callbacks,
 * each of which must return within 5 s.
 */
@RequiresApi(Build.VERSION_CODES.O)
internal class TelecomCall(private val call: ActiveCall, private val scope: CoroutineScope) {
  private val manager = CallsManager(call.context)
  private val lock = Any()
  // Guarded by lock: the scope arrives on another thread once Telecom has added the call.
  private var control: CallControlScope? = null
  private var available = emptyList<CallEndpointCompat>()
  private var current: CallEndpointCompat? = null
  private var activated = false
  private var systemMuted = false
  @Volatile private var job: Job? = null
  /** The scope once Telecom has added the call, or null when it refused. */
  private val added = CompletableDeferred<CallControlScope?>()

  /** Adds the call once [after], the previous call's teardown, is done: Telecom sets up one call at a time. */
  fun start(after: Job?) {
    job = scope.launch {
      after?.join()
      run()
    }
  }

  /** Tells Telecom the voice connection is up, once, as soon as the call is added and [CallFlags.connected]. */
  fun activate() {
    val target =
      synchronized(lock) { if (activated || !call.flags.connected) null else control?.also { activated = true } } ?: return
    scope.launch { attempt("set active") { target.setActive() } }
  }

  /** The user answered a ring. Answering makes the call active, so [activate] has nothing left to do. */
  fun answer() {
    scope.launch {
      val target = awaitControl() ?: return@launch
      attempt("answer") { target.answer(CallAttributesCompat.CALL_TYPE_AUDIO_CALL) }
      synchronized(lock) { activated = true }
    }
  }

  fun requestEndpoint(id: String) {
    val (target, endpoint) = synchronized(lock) { control to available.firstOrNull { it.identifier.toString() == id } }
    if (target == null || endpoint == null) {
      Log.w(CALL_TAG, "no endpoint $id to switch to")
      return
    }
    scope.launch { attempt("endpoint change") { target.requestEndpointChange(endpoint) } }
  }

  /**
   * Disconnects the call and waits for `addCall` to return. The returned job completes when the teardown is done.
   * [cause] is a `DisconnectCause` code: local, rejected, missed or remote.
   */
  fun end(cause: Int): Job =
    scope.launch {
      val target = synchronized(lock) { control }
      if (target != null) attempt("disconnect") { target.disconnect(DisconnectCause(cause)) }
      job?.cancelAndJoin()
    }

  /** True while this is the call's Telecom call. An adopted ring that drops Telecom detaches it ([CallTelecom.begin]). */
  private val attached get() = call.telecom === this

  /** Hands a Telecom request to the call, unless the call has dropped this Telecom call. */
  private fun dispatch(action: CallAction) {
    if (attached) call.dispatch(action) else Log.d(CALL_TAG, "dropped telecom call: $action ignored")
  }

  /** Waits for Telecom to add the call, for a ring answered at once. Null when it refused. */
  private suspend fun awaitControl() = added.await()

  private suspend fun run() {
    try {
      manager.registerAppWithTelecom(CAPABILITIES)
      manager.addCall(
        attributes(),
        // Telecom asks to answer a ring, from a headset or the system. An outgoing call has no one to answer.
        onAnswer = { call.onAnswer?.invoke() },
        onDisconnect = { cause ->
          Log.d(CALL_TAG, "telecom disconnect: $cause")
          dispatch(CallAction.Disconnect)
        },
        onSetActive = { dispatch(CallAction.Hold(false)) },
        onSetInactive = { dispatch(CallAction.Hold(true)) },
      ) {
        observe()
      }
    } catch (e: CancellationException) {
      throw e
    } catch (e: Exception) {
      // The call goes on without Telecom: the service still keeps it alive, but there are no endpoints to offer.
      Log.e(CALL_TAG, "telecom call failed", e)
      if (attached) call.publishEndpoints(emptyList(), null)
    } finally {
      // Whatever ended the call, an answer waiting for it must not hang.
      added.complete(null)
    }
  }

  /** Display name the channel, address an `isocord:` URI, outgoing or incoming, audio, no call log entry where the platform has one. */
  private fun attributes() =
    CallAttributesCompat(
      displayName = call.details.title,
      address = Uri.fromParts(ADDRESS_SCHEME, ADDRESS_PART, null),
      direction = if (call.ring == RingStage.None) CallAttributesCompat.DIRECTION_OUTGOING else CallAttributesCompat.DIRECTION_INCOMING,
      callType = CallAttributesCompat.CALL_TYPE_AUDIO_CALL,
      callCapabilities = CallAttributesCompat.SUPPORTS_SET_INACTIVE,
      isLogExcluded = if (Build.VERSION.SDK_INT >= LOG_EXCLUDED_SDK) true else null,
    )

  /** Runs when Telecom has added the call. Each flow needs its own coroutine. */
  private fun CallControlScope.observe() {
    synchronized(lock) { control = this@observe }
    added.complete(this@observe)
    launch { currentCallEndpoint.collect { endpointsChanged(newAvailable = null, newCurrent = it) } }
    launch { availableEndpoints.collect { endpointsChanged(newAvailable = it, newCurrent = null) } }
    launch { isMuted.collect { systemMuteChanged(it) } }
    activate()
  }

  private fun endpointsChanged(newAvailable: List<CallEndpointCompat>?, newCurrent: CallEndpointCompat?) {
    val (endpoints, currentId) =
      synchronized(lock) {
        newAvailable?.let { available = it }
        newCurrent?.let { current = it }
        available.map { audioEndpoint(it) } to current?.identifier?.toString()
      }
    if (attached) call.publishEndpoints(endpoints, currentId)
  }

  /** The system's mic mute, from a headset or quick settings. Only a change that the app doesn't already show counts. */
  private fun systemMuteChanged(on: Boolean) {
    val changed = synchronized(lock) { (on != systemMuted).also { systemMuted = on } }
    if (changed && on != call.flags.muted) dispatch(CallAction.Mute(on))
  }

  private suspend fun attempt(what: String, block: suspend () -> CallControlResult) {
    try {
      val result = block()
      if (result is CallControlResult.Error) Log.w(CALL_TAG, "telecom $what refused, code ${result.errorCode}")
    } catch (e: CancellationException) {
      throw e
    } catch (e: Exception) {
      Log.e(CALL_TAG, "telecom $what failed", e)
    }
  }

  private fun audioEndpoint(endpoint: CallEndpointCompat) =
    AudioEndpoint(endpoint.identifier.toString(), endpoint.name.toString(), endpointKind(endpoint.type))

  private fun endpointKind(type: Int) =
    when (type) {
      CallEndpointCompat.TYPE_EARPIECE -> KIND_EARPIECE
      CallEndpointCompat.TYPE_SPEAKER -> KIND_SPEAKER
      CallEndpointCompat.TYPE_WIRED_HEADSET -> KIND_WIRED
      CallEndpointCompat.TYPE_BLUETOOTH -> KIND_BLUETOOTH
      CallEndpointCompat.TYPE_STREAMING -> KIND_STREAMING
      else -> KIND_UNKNOWN
    }
}
