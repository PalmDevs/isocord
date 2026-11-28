package me.palmdevs.isocord.voice.rtc

import android.content.Context
import kotlinx.serialization.Serializable
import okhttp3.OkHttpClient
import org.webrtc.EglBase
import org.webrtc.PeerConnectionFactory
import org.webrtc.VideoTrack

/** `RtcContext` values (voiceTypes.ts): the voice channel or call, or a Go Live stream. */
object RtcContext {
  const val DEFAULT = "default"
  const val STREAM = "stream"
}

/** `state` event values (voiceTypes.ts). */
object RtcState {
  const val CONNECTING = "connecting"
  const val CONNECTED = "connected"
  const val RECONNECTING = "reconnecting"
  const val DISCONNECTED = "disconnected"
}

/** `connect` JSON (voiceTypes.ts `ConnectRequest`). */
@Serializable
data class ConnectRequest(
  val context: String,
  val endpoint: String,
  val token: String,
  val serverId: String,
  val channelId: String,
  val userId: String,
  val sessionId: String,
  val owner: Boolean = false,
  /** The channel's `video_quality_mode` ([me.palmdevs.isocord.voice.VideoQualityMode]), when it has one. */
  val videoQualityMode: Int? = null,
  /** Our own stream's height ([me.palmdevs.isocord.voice.stream.StreamResolution]), 0 for the source size. */
  val streamResolution: Int? = null,
  /** Our own stream's frame rate ([me.palmdevs.isocord.voice.stream.StreamFramerate]). */
  val streamFramerate: Int? = null,
  /** Our own stream sends other apps' audio (reference `soundshareEnabled`, on by default). API 29+. */
  val soundshare: Boolean = true,
)

/** CallEngine's shared media objects. */
class MediaKit(
  val context: Context,
  val factory: PeerConnectionFactory,
  val egl: EglBase,
  val http: OkHttpClient,
)

/** What a connection reports to CallEngine, on the engine's dispatcher. */
interface RtcListener {
  fun onState(connection: RtcConnection, state: String, code: Int? = null)
  fun onSpeaking(context: String, userId: String, speaking: Boolean)
  fun onVideo(context: String, userId: String, active: Boolean)
  fun onClientConnect(context: String, userIds: List<String>)
  fun onClientDisconnect(context: String, userId: String)
  fun onSecureFrames(context: String, version: Int)
  /** A video track to show for a user, ours included, or null when it is gone. */
  fun onVideoTrack(context: String, userId: String, track: VideoTrack?)
  fun onError(kind: String, message: String)
  /** Our screen capture stopped outside the app. */
  fun onScreenStopped()
  /** Our camera stopped on its own. [reason] is a [me.palmdevs.isocord.voice.CameraFailure]. */
  fun onCameraStopped(reason: String)
  /** Our own stream can't produce frames, or can again: screen off, or the captured app hidden. JS sends op 22. */
  fun onStreamPaused(paused: Boolean) = Unit
  /** The default network changed under the connection. */
  fun onNetworkChanged(context: String) = Unit
}
