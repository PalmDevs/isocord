package me.palmdevs.isocord.voice.telecom

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.asExecutor
import kotlinx.coroutines.launch

/**
 * The audio of a call without Telecom: communication mode, audio focus and the output ([AudioRoutes]). Reference:
 * `AudioManagerStore.android` turns `setCommunicationModeOn` on for a call and off after it.
 * The reference requests no focus for calls: Telecom holds it. Ours does, and a transient loss (a phone call, an
 * assistant) holds the call as Telecom's `onSetInactive` does. A lasting loss or ducking leaves the call going.
 * Work runs on one serial dispatcher. Safe from any thread.
 */
@OptIn(ExperimentalCoroutinesApi::class)
internal object CallAudio : RoutesHost {
  private val dispatcher = Dispatchers.Default.limitedParallelism(1)
  private val scope = CoroutineScope(SupervisorJob() + dispatcher)
  // On the dispatcher.
  private var call: ActiveCall? = null
  private var audio: AudioManager? = null
  /** Made once per process, as the reference's singleton: it keeps the user's output between calls. */
  private var routes: AudioRoutes? = null
  /** API 26+. */
  private var focus: AudioFocusRequest? = null
  private var held = false

  private val focusListener = AudioManager.OnAudioFocusChangeListener { change -> scope.launch { focusChanged(change) } }

  /** Takes the audio for [started] once [after], a Telecom call's teardown, is done: Telecom resets the mode. */
  fun start(started: ActiveCall, after: Job?) {
    scope.launch {
      call = started
      after?.join()
      // The call ended while Telecom let go.
      if (call !== started) return@launch
      val manager = started.context.getSystemService(AudioManager::class.java)
      audio = manager
      manager.mode = AudioManager.MODE_IN_COMMUNICATION
      requestFocus(manager)
      routes(started.context, manager).start()
    }
  }

  /** Hands the output, focus and mode back. Safe without a call. */
  fun stop() {
    scope.launch {
      call = null
      held = false
      val manager = audio ?: return@launch
      audio = null
      routes?.stop()
      abandonFocus(manager)
      manager.mode = AudioManager.MODE_NORMAL
    }
  }

  fun select(id: String) {
    scope.launch { if (audio != null) routes?.select(id) }
  }

  override fun publish(available: List<AudioEndpoint>, current: String?) {
    call?.publishEndpoints(available, current)
  }

  private fun routes(context: Context, manager: AudioManager): AudioRoutes =
    routes
      ?: run {
        val executor = dispatcher.asExecutor()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) CommunicationRoutes(manager, executor, this)
        else LegacyRoutes(context.applicationContext, manager, executor, this)
      }.also { routes = it }

  private fun requestFocus(manager: AudioManager) {
    val result =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val attributes =
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
            .build()
        val request =
          AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
            .setAudioAttributes(attributes)
            .setOnAudioFocusChangeListener(focusListener)
            .build()
        focus = request
        manager.requestAudioFocus(request)
      } else {
        @Suppress("DEPRECATION")
        manager.requestAudioFocus(focusListener, AudioManager.STREAM_VOICE_CALL, AudioManager.AUDIOFOCUS_GAIN)
      }
    if (result != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) Log.w(CALL_TAG, "audio focus refused: $result")
  }

  private fun abandonFocus(manager: AudioManager) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      focus?.let(manager::abandonAudioFocusRequest)
      focus = null
    } else {
      @Suppress("DEPRECATION")
      manager.abandonAudioFocus(focusListener)
    }
  }

  private fun focusChanged(change: Int) {
    val running = call ?: return
    val hold =
      when (change) {
        AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> true
        AudioManager.AUDIOFOCUS_GAIN -> false
        else -> {
          Log.d(CALL_TAG, "audio focus change $change ignored")
          return
        }
      }
    // A phone call leaves the mode at normal.
    if (!hold) audio?.mode = AudioManager.MODE_IN_COMMUNICATION
    if (hold == held) return
    held = hold
    running.dispatch(CallAction.Hold(hold))
  }
}
