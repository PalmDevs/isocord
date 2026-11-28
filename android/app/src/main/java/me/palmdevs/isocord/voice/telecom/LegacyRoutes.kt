package me.palmdevs.isocord.voice.telecom

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.util.Log
import androidx.core.content.ContextCompat
import java.util.concurrent.Executor

/** Bluetooth SCO restarts before falling back to the default output (`AudioManagerStore.android` `setSCORetryCount`). */
private const val SCO_RETRIES = 4

/**
 * The output below API 33, through the speakerphone and Bluetooth SCO switches. Reference: `DiscordAudioManager`.
 * One endpoint per kind, and its id is the kind.
 */
// The speakerphone and SCO switches are deprecated from API 31, and this class only runs below 33.
@Suppress("DEPRECATION")
internal class LegacyRoutes(
  private val context: Context,
  private val audio: AudioManager,
  /** [CallAudio]'s dispatcher. */
  private val executor: Executor,
  private val host: RoutesHost,
) : AudioRoutes {
  private var active = false
  /** The kind picked by the user or by [start]. Null follows the system (the reference's `DEFAULT`). Kept between calls. */
  private var desired: String? = null
  private var scoAttempts = 0

  private val devices =
    object : AudioDeviceCallback() {
      override fun onAudioDevicesAdded(added: Array<out AudioDeviceInfo>) = executor.execute { devicesAdded(added) }

      override fun onAudioDevicesRemoved(removed: Array<out AudioDeviceInfo>) = executor.execute { devicesRemoved() }
    }

  private val sco =
    object : BroadcastReceiver() {
      override fun onReceive(context: Context, intent: Intent) {
        // The sticky state from before this call.
        if (isInitialStickyBroadcast) return
        val state = intent.getIntExtra(AudioManager.EXTRA_SCO_AUDIO_STATE, AudioManager.SCO_AUDIO_STATE_ERROR)
        executor.execute { scoChanged(state) }
      }
    }

  override fun start() {
    active = true
    scoAttempts = 0
    audio.registerAudioDeviceCallback(devices, null)
    val filter = IntentFilter(AudioManager.ACTION_SCO_AUDIO_STATE_UPDATED)
    ContextCompat.registerReceiver(context, sco, filter, ContextCompat.RECEIVER_NOT_EXPORTED)
    val kinds = kinds()
    val wanted = desired
    // A Bluetooth headset, else a wired one (the system plays to it), else the speaker.
    when {
      wanted != null -> apply(wanted)
      KIND_BLUETOOTH in kinds -> apply(KIND_BLUETOOTH)
      KIND_WIRED in kinds -> audio.isSpeakerphoneOn = false
      else -> audio.isSpeakerphoneOn = true
    }
    publish()
  }

  override fun stop() {
    active = false
    audio.unregisterAudioDeviceCallback(devices)
    try {
      context.unregisterReceiver(sco)
    } catch (e: IllegalArgumentException) {
      Log.w(CALL_TAG, "SCO receiver was not registered", e)
    }
    audio.stopBluetoothSco()
    audio.isSpeakerphoneOn = false
  }

  override fun select(id: String) {
    if (id !in kinds()) {
      Log.w(CALL_TAG, "no output $id to switch to")
      return
    }
    apply(id)
    publish()
  }

  private fun apply(kind: String) {
    if (kind == KIND_BLUETOOTH) {
      scoAttempts = 0
      audio.isSpeakerphoneOn = false
      audio.startBluetoothSco()
    } else {
      audio.stopBluetoothSco()
      audio.isBluetoothScoOn = false
      audio.isSpeakerphoneOn = kind == KIND_SPEAKER
    }
    desired = kind
  }

  /** With no pick, a Bluetooth headset that connects takes over. */
  private fun devicesAdded(added: Array<out AudioDeviceInfo>) {
    if (!active) return
    if (desired == null && added.any { it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO }) {
      audio.startBluetoothSco()
      audio.isSpeakerphoneOn = false
    }
    publish()
  }

  /** A picked output that left hands over to the system. */
  private fun devicesRemoved() {
    if (!active) return
    val wanted = desired
    if (wanted != null && wanted !in kinds()) {
      if (wanted == KIND_BLUETOOTH) audio.stopBluetoothSco()
      desired = null
    }
    publish()
  }

  /** Retries a Bluetooth SCO link that failed, then falls back to the system's output. */
  private fun scoChanged(state: Int) {
    if (!active) return
    when (state) {
      AudioManager.SCO_AUDIO_STATE_ERROR, AudioManager.SCO_AUDIO_STATE_DISCONNECTED -> {
        if (desired != KIND_BLUETOOTH) return
        if (scoAttempts < SCO_RETRIES) {
          scoAttempts++
          Log.i(CALL_TAG, "Bluetooth SCO retry $scoAttempts")
          audio.startBluetoothSco()
          return
        }
        desired = null
      }
      AudioManager.SCO_AUDIO_STATE_CONNECTED -> {
        if (!audio.isBluetoothScoOn) return
        scoAttempts = 0
      }
      else -> return
    }
    publish()
  }

  private fun outputs() = audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS).filter { deviceKind(it.type) != null }

  /** One kind per output in use order. The earpiece goes when a wired headset is in (reference `getSimpleDevices`). */
  private fun kinds(): Set<String> {
    val kinds = outputs().mapNotNullTo(LinkedHashSet()) { deviceKind(it.type) }
    if (KIND_WIRED in kinds) kinds.remove(KIND_EARPIECE)
    return kinds
  }

  /** Returns what the system plays to now (reference `getActiveAudioDevice`). */
  private fun playing(): String? {
    if (audio.isSpeakerphoneOn) return KIND_SPEAKER
    if (audio.isBluetoothScoOn) return KIND_BLUETOOTH
    val kinds = kinds()
    return listOf(KIND_WIRED, KIND_EARPIECE).firstOrNull { it in kinds }
  }

  /** Returns the output to show as current (reference `getEffectiveAudioDevice`). */
  private fun current(): String? {
    val now = playing()
    val wanted = desired ?: return now
    return if (now == KIND_WIRED && wanted == KIND_EARPIECE) KIND_WIRED else wanted
  }

  private fun publish() {
    val devices = outputs()
    val endpoints = kinds().mapNotNull { kind -> outputEndpoint(devices.first { deviceKind(it.type) == kind }, id = kind) }
    host.publish(endpoints, current())
  }
}
