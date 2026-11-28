package me.palmdevs.isocord.voice.audio

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.util.Log
import androidx.core.content.ContextCompat
import org.webrtc.audio.JavaAudioDeviceModule

private const val TAG = "IsocordVoice"

/** `microphoneStopped` reasons (voiceTypes.ts). */
object MicrophoneStop {
  /** Another app or the privacy toggle has the mic. */
  const val BUSY = "busy"
  /** RECORD_AUDIO is not granted. */
  const val PERMISSION = "permission"
  const val ERROR = "error"
}

/** Sorts the ADM's microphone errors into [MicrophoneStop] reasons. Called on the audio record thread. */
class RecordErrors(
  private val context: Context,
  private val onStopped: (reason: String, message: String) -> Unit,
) : JavaAudioDeviceModule.AudioRecordErrorCallback {
  override fun onWebRtcAudioRecordInitError(message: String) = report(MicrophoneStop.ERROR, "init: $message")

  /** A recorder that won't enter the recording state is held by another app (WebRtcAudioRecord). */
  override fun onWebRtcAudioRecordStartError(code: JavaAudioDeviceModule.AudioRecordStartErrorCode, message: String) {
    val busy = code == JavaAudioDeviceModule.AudioRecordStartErrorCode.AUDIO_RECORD_START_STATE_MISMATCH
    report(if (busy) MicrophoneStop.BUSY else MicrophoneStop.ERROR, "start $code: $message")
  }

  override fun onWebRtcAudioRecordError(message: String) = report(MicrophoneStop.ERROR, message)

  private fun report(fallback: String, message: String) {
    val granted = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
      PackageManager.PERMISSION_GRANTED
    val reason = if (granted) fallback else MicrophoneStop.PERMISSION
    Log.e(TAG, "microphone stopped ($reason): $message")
    onStopped(reason, message)
  }
}
