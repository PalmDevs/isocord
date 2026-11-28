package me.palmdevs.isocord.voice.telecom

import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import android.util.Log
import androidx.annotation.RequiresApi
import java.util.concurrent.Executor

/**
 * The output from API 33, through `setCommunicationDevice`. Reference: `DiscordAudioManager2`, which
 * `AudioManagerModule` picks from API 33. Ids are `AudioDeviceInfo` ids.
 */
@RequiresApi(Build.VERSION_CODES.TIRAMISU)
internal class CommunicationRoutes(
  private val audio: AudioManager,
  /** [CallAudio]'s dispatcher. */
  private val executor: Executor,
  private val host: RoutesHost,
) : AudioRoutes,
  AudioManager.OnCommunicationDeviceChangedListener {
  private var active = false
  /** The device the user picked. Kept between calls, as the reference's singleton keeps it. */
  private var preferred: Int? = null

  private val devices =
    object : AudioDeviceCallback() {
      override fun onAudioDevicesAdded(added: Array<out AudioDeviceInfo>) = executor.execute { devicesAdded(added) }

      override fun onAudioDevicesRemoved(removed: Array<out AudioDeviceInfo>) = executor.execute { if (active) publish() }
    }

  override fun start() {
    active = true
    audio.registerAudioDeviceCallback(devices, null)
    audio.addOnCommunicationDeviceChangedListener(executor, this)
    val usable = usable()
    // The user's pick while it is there, else a Bluetooth headset, a wired one, then the speaker.
    val pick = usable.firstOrNull { it.id == preferred } ?: firstOfKind(usable, KIND_BLUETOOTH, KIND_WIRED, KIND_SPEAKER)
    pick?.let(::use)
    publish()
  }

  override fun stop() {
    active = false
    audio.removeOnCommunicationDeviceChangedListener(this)
    audio.unregisterAudioDeviceCallback(devices)
    audio.clearCommunicationDevice()
  }

  override fun select(id: String) {
    val device = usable().firstOrNull { it.id.toString() == id }
    if (device == null) {
      Log.w(CALL_TAG, "no output $id to switch to")
      return
    }
    preferred = device.id
    use(device)
  }

  override fun onCommunicationDeviceChanged(device: AudioDeviceInfo?) {
    if (active) publish()
  }

  /** With no pick of the user's, a headset that connects takes over: Bluetooth first, then wired. */
  private fun devicesAdded(added: Array<out AudioDeviceInfo>) {
    if (!active) return
    if (preferred == null) {
      val ids = added.filter { it.isSink }.map { it.id }.toSet()
      firstOfKind(usable().filter { it.id in ids }, KIND_BLUETOOTH, KIND_WIRED)?.let(::use)
    }
    publish()
  }

  private fun use(device: AudioDeviceInfo) {
    try {
      if (!audio.setCommunicationDevice(device)) Log.w(CALL_TAG, "output type ${device.type} refused")
    } catch (e: IllegalArgumentException) {
      // The device left between listing and switching.
      Log.w(CALL_TAG, "output type ${device.type} gone", e)
    }
  }

  private fun usable() = audio.availableCommunicationDevices.filter { deviceKind(it.type) != null }

  private fun publish() {
    val endpoints = usable().mapNotNull { outputEndpoint(it) }
    host.publish(endpoints, audio.communicationDevice?.id?.toString())
  }
}
