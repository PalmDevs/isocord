package me.palmdevs.isocord.voice

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import me.palmdevs.isocord.voice.audio.AudioInputDevice
import me.palmdevs.isocord.voice.telecom.AudioEndpoint
import me.palmdevs.isocord.voice.video.CameraDevice

/** Encodes events for JS. Optional fields left at their default are omitted, a null without a default is kept. */
private val EventJson = Json

/** `onVoiceEvent` payloads (src/native/voiceTypes.ts `VoiceEvent`), discriminated by `type`. */
@Serializable
sealed interface VoiceEvent {
  @Serializable
  @SerialName("state")
  data class State(val context: String, val state: String, val code: Int? = null) : VoiceEvent

  @Serializable
  @SerialName("speaking")
  data class Speaking(val context: String, val userId: String, val speaking: Boolean) : VoiceEvent

  @Serializable
  @SerialName("video")
  data class Video(val context: String, val userId: String, val active: Boolean) : VoiceEvent

  @Serializable
  @SerialName("clientConnect")
  data class ClientConnect(val context: String, val userIds: List<String>) : VoiceEvent

  @Serializable
  @SerialName("clientDisconnect")
  data class ClientDisconnect(val context: String, val userId: String) : VoiceEvent

  @Serializable
  @SerialName("secureFrames")
  data class SecureFrames(val context: String, val version: Int) : VoiceEvent

  /** Our camera stopped on its own. `reason` is a [CameraFailure]. JS clears `selfVideo` and sends op 4. */
  @Serializable
  @SerialName("cameraStopped")
  data class CameraStopped(val reason: String) : VoiceEvent

  /**
   * The camera capture runs on, null once it stops. `picked` is set when native picked the camera itself (the
   * switch button): JS remembers it.
   */
  @Serializable
  @SerialName("camera")
  data class Camera(val camera: CameraDevice?, val picked: CameraDevice?) : VoiceEvent

  /** While `setCameraReporting` is on: every camera, again whenever one comes or goes. */
  @Serializable
  @SerialName("cameras")
  data class Cameras(val cameras: List<CameraDevice>) : VoiceEvent

  @Serializable
  @SerialName("screenConsent")
  data class ScreenConsent(val granted: Boolean) : VoiceEvent

  @Serializable
  @SerialName("streamEnded")
  data object StreamEnded : VoiceEvent

  /** Our stream's screen is off or the captured app is hidden. JS sends op 22 (ScreenWatcher). */
  @Serializable
  @SerialName("streamPaused")
  data class StreamPaused(val paused: Boolean) : VoiceEvent

  /** `action` is `disconnect`, `mute` or `deafen`. `on` is set for the last two. */
  @Serializable
  @SerialName("callAction")
  data class CallAction(val action: String, val on: Boolean? = null) : VoiceEvent

  @Serializable
  @SerialName("endpoints")
  data class Endpoints(val available: List<AudioEndpoint>, val current: String?) : VoiceEvent

  /** While `setAudioDeviceReporting` is on. `input` and `output` are the remembered devices' ids while connected. */
  @Serializable
  @SerialName("audioDevices")
  data class AudioDevices(
    val inputs: List<AudioInputDevice>,
    val outputs: List<AudioEndpoint>,
    val input: String?,
    val output: String?,
  ) : VoiceEvent

  /** Our mic level in dBFS, about 10 a second while `setInputLevelReporting` is on. */
  @Serializable
  @SerialName("inputLevel")
  data class InputLevel(val level: Double) : VoiceEvent

  /** Noise suppression stepped down for the rest of the call. A NoiseSuppression `tier`, a RnnoiseFallback `reason`. */
  @Serializable
  @SerialName("noiseSuppressionTier")
  data class NoiseSuppressionTier(val tier: String, val reason: String) : VoiceEvent

  /** Our mic stopped delivering sound. `reason` is a MicrophoneStop. */
  @Serializable
  @SerialName("microphoneStopped")
  data class MicrophoneStopped(val reason: String, val message: String) : VoiceEvent

  /** Sound came back after `microphoneStopped`. */
  @Serializable
  @SerialName("microphoneResumed")
  data object MicrophoneResumed : VoiceEvent

  /** The default network changed under a connection. JS checks the main gateway at once. */
  @Serializable
  @SerialName("networkChanged")
  data class NetworkChanged(val context: String) : VoiceEvent

  /** `kind` is `microphone`, `camera`, `screen` or `connection`. */
  @Serializable
  @SerialName("error")
  data class Error(val kind: String, val message: String) : VoiceEvent

  fun toJson(): String = EventJson.encodeToString(serializer(), this)
}
