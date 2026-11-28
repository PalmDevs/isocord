package me.palmdevs.isocord.voice.telecom

import android.media.AudioDeviceInfo
import android.os.Build

/** Hears the outputs a call can use and the one it plays to. On [CallAudio]'s dispatcher. */
internal interface RoutesHost {
  fun publish(available: List<AudioEndpoint>, current: String?)
}

/**
 * Lists and picks a call's audio output without Telecom: [CommunicationRoutes] from API 33, else [LegacyRoutes].
 * Reference: `DiscordAudioManagerInterface`. Every method runs on [CallAudio]'s dispatcher.
 */
internal interface AudioRoutes {
  /** Registers for device changes, picks the output and publishes the list. */
  fun start()

  /** Unregisters and hands the output back to the system. */
  fun stop()

  /** Switches to an [AudioEndpoint.id] from [RoutesHost.publish]. */
  fun select(id: String)
}

/**
 * Returns the [AudioEndpoint.kind] of an output device type, or null for one a call doesn't offer. Reference:
 * `AndroidAudioDeviceKt.audioDeviceTypeToSimpleMapping`. Left out: what it files under earpiece (HDMI, dock, line out)
 * and the BLE speaker and broadcast that `DiscordAudioManager2.getAudioDevices` drops.
 */
internal fun deviceKind(type: Int): String? =
  when (type) {
    AudioDeviceInfo.TYPE_BUILTIN_EARPIECE -> KIND_EARPIECE
    AudioDeviceInfo.TYPE_BUILTIN_SPEAKER -> KIND_SPEAKER
    AudioDeviceInfo.TYPE_WIRED_HEADSET,
    AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
    AudioDeviceInfo.TYPE_USB_DEVICE,
    AudioDeviceInfo.TYPE_USB_ACCESSORY,
    AudioDeviceInfo.TYPE_USB_HEADSET,
    -> KIND_WIRED
    AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
    AudioDeviceInfo.TYPE_HEARING_AID,
    AudioDeviceInfo.TYPE_BLE_HEADSET,
    -> KIND_BLUETOOTH
    else -> null
  }

/** Returns the [AudioEndpoint] of an output device, or null for one a call doesn't offer. */
internal fun outputEndpoint(device: AudioDeviceInfo, id: String = device.id.toString()): AudioEndpoint? =
  deviceKind(device.type)?.let { kind ->
    AudioEndpoint(id, device.productName.toString(), kind, deviceAddress(device), device.type == AudioDeviceInfo.TYPE_BLE_HEADSET)
  }

/** Returns a device's address, such as a Bluetooth MAC, or null without one (API 28+). */
internal fun deviceAddress(device: AudioDeviceInfo): String? =
  if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) device.address.takeIf { it.isNotEmpty() } else null

/** Returns the first device of the first of [kinds] that [devices] has. */
internal fun firstOfKind(devices: List<AudioDeviceInfo>, vararg kinds: String): AudioDeviceInfo? =
  kinds.firstNotNullOfOrNull { kind -> devices.firstOrNull { deviceKind(it.type) == kind } }
