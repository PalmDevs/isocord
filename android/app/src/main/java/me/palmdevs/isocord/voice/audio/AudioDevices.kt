package me.palmdevs.isocord.voice.audio

import android.content.Context
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import me.palmdevs.isocord.voice.VoiceEvent
import me.palmdevs.isocord.voice.telecom.AudioEndpoint
import me.palmdevs.isocord.voice.telecom.KIND_BLUETOOTH
import me.palmdevs.isocord.voice.telecom.KIND_EARPIECE
import me.palmdevs.isocord.voice.telecom.KIND_SPEAKER
import me.palmdevs.isocord.voice.telecom.KIND_WIRED
import me.palmdevs.isocord.voice.telecom.deviceAddress
import me.palmdevs.isocord.voice.telecom.outputEndpoint
import org.webrtc.audio.JavaAudioDeviceModule

/** [AudioInputDevice.kind] of the phone's own microphone, as `voiceTypes.ts` `AudioInputDevice`. */
internal const val KIND_MICROPHONE = "microphone"

/** Kinds a phone has one of: a key matches them by kind alone. */
private val BUILT_IN_KINDS = setOf(KIND_EARPIECE, KIND_SPEAKER, KIND_MICROPHONE)

/** A device's identity across calls (`voiceTypes.ts` `AudioDeviceKey`). */
@Serializable
data class DeviceKey(val kind: String, val name: String, val address: String? = null) {
  /** Built-in devices match by kind. Others by name, and by address when both sides know it. */
  fun matches(kind: String, name: String, address: String?): Boolean {
    if (kind != this.kind) return false
    if (kind in BUILT_IN_KINDS) return true
    if (name != this.name) return false
    return this.address == null || address == null || this.address == address
  }

  fun matches(endpoint: AudioEndpoint) = matches(endpoint.kind, endpoint.name, endpoint.address)
}

/** `setPreferredDevices` JSON (`voiceTypes.ts` `PreferredDevices`): the devices the user picked last. */
@Serializable
data class PreferredDevices(val input: DeviceKey? = null, val output: DeviceKey? = null)

/** A microphone (`voiceTypes.ts` `AudioInputDevice`). */
@Serializable
data class AudioInputDevice(
  val id: String,
  val name: String,
  val kind: String,
  val address: String? = null,
  val lowEnergy: Boolean = false,
)

/** Returns the [AudioInputDevice.kind] of an input type, or null for one we don't offer (telephony, FM, echo reference). */
private fun inputKind(type: Int): String? =
  when (type) {
    AudioDeviceInfo.TYPE_BUILTIN_MIC -> KIND_MICROPHONE
    AudioDeviceInfo.TYPE_WIRED_HEADSET,
    AudioDeviceInfo.TYPE_USB_DEVICE,
    AudioDeviceInfo.TYPE_USB_ACCESSORY,
    AudioDeviceInfo.TYPE_USB_HEADSET,
    -> KIND_WIRED
    AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
    AudioDeviceInfo.TYPE_BLE_HEADSET,
    -> KIND_BLUETOOTH
    else -> null
  }

/**
 * The remembered input and output devices. Isocord's own: the reference keeps neither and has no input picker.
 * The input goes to the audio module as its preferred AudioRecord device. Explicit routing outranks the
 * communication device that Telecom or `CallAudio` sets, so a picked built-in mic stays in use beside a
 * Bluetooth headset. The output is requested once per call as it appears: at call start, or when it connects.
 * On CallEngine's dispatcher.
 */
class AudioDevices(private val scope: CoroutineScope, private val host: Host) {
  interface Host {
    /** Switches the call's output to an [AudioEndpoint.id]. */
    fun selectEndpoint(id: String)
    fun emit(event: VoiceEvent)
  }

  private var audio: AudioManager? = null
  private var preferred = PreferredDevices()
  private var reporting = false
  private var module: JavaAudioDeviceModule? = null
  /** The input handed to [module], null for the system's choice. */
  private var applied: AudioDeviceInfo? = null
  /** Output endpoint ids seen this call: the remembered one is requested only as it appears. */
  private val seen = mutableSetOf<String>()

  private val callback =
    object : AudioDeviceCallback() {
      override fun onAudioDevicesAdded(added: Array<out AudioDeviceInfo>) = changed()

      override fun onAudioDevicesRemoved(removed: Array<out AudioDeviceInfo>) = changed()
    }

  /** Remembers the picked devices and applies the input at once. */
  fun setPreferred(context: Context, devices: PreferredDevices) {
    manager(context)
    preferred = devices
    applyInput()
    if (reporting) publish()
  }

  /** Emits `audioDevices` now and on every change while on. */
  fun setReporting(context: Context, on: Boolean) {
    manager(context)
    reporting = on
    if (on) publish()
  }

  /** A new audio module: it gets the remembered input. */
  fun attach(created: JavaAudioDeviceModule) {
    module = created
    applied = null
    applyInput()
  }

  fun detach() {
    module = null
    applied = null
  }

  fun callStarted() {
    seen.clear()
  }

  /** Requests the remembered output when it first shows up in this call and isn't [current] already. */
  fun onEndpoints(available: List<AudioEndpoint>, current: String?) {
    val fresh = available.filter { seen.add(it.id) }
    val wanted = preferred.output ?: return
    val match = fresh.firstOrNull { wanted.matches(it) } ?: return
    if (match.id != current) host.selectEndpoint(match.id)
  }

  /** Registers for device changes once, for the process. */
  private fun manager(context: Context): AudioManager =
    audio
      ?: context.getSystemService(AudioManager::class.java).also {
        audio = it
        it.registerAudioDeviceCallback(callback, null)
      }

  private fun changed() {
    scope.launch {
      applyInput()
      if (reporting) publish()
    }
  }

  /** The phone's inputs we offer. Phones list several built-in mics: the first stands for them all. */
  private fun inputs(): List<Pair<AudioDeviceInfo, AudioInputDevice>> {
    val devices = audio?.getDevices(AudioManager.GET_DEVICES_INPUTS).orEmpty()
    return devices
      .mapNotNull { device -> describe(device)?.let { device to it } }
      .distinctBy { (device, input) -> if (input.kind == KIND_MICROPHONE) KIND_MICROPHONE else device.id.toString() }
  }

  private fun describe(device: AudioDeviceInfo): AudioInputDevice? =
    inputKind(device.type)?.let { kind ->
      AudioInputDevice(
        device.id.toString(),
        device.productName.toString(),
        kind,
        deviceAddress(device),
        device.type == AudioDeviceInfo.TYPE_BLE_HEADSET,
      )
    }

  /** The remembered input when it is connected. */
  private fun preferredInput(): AudioDeviceInfo? {
    val key = preferred.input ?: return null
    return inputs().firstOrNull { (_, input) -> key.matches(input.kind, input.name, input.address) }?.first
  }

  private fun applyInput() {
    val target = module ?: return
    val device = preferredInput()
    if (device?.id == applied?.id) return
    applied = device
    target.setPreferredInputDevice(device)
  }

  /** Lists inputs and, for the picker outside a call, the phone's outputs. */
  private fun publish() {
    val inputs = inputs().map { it.second }
    val outputs =
      audio?.getDevices(AudioManager.GET_DEVICES_OUTPUTS).orEmpty()
        .mapNotNull { outputEndpoint(it) }
        .distinctBy { if (it.kind == KIND_EARPIECE || it.kind == KIND_SPEAKER) it.kind else it.id }
    val output = preferred.output?.let { key -> outputs.firstOrNull { key.matches(it) } }
    host.emit(VoiceEvent.AudioDevices(inputs, outputs, preferredInput()?.id?.toString(), output?.id))
  }
}
