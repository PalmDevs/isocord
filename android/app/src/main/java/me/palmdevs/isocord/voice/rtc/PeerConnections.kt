package me.palmdevs.isocord.voice.rtc

import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.suspendCancellableCoroutine
import org.webrtc.DataChannel
import org.webrtc.IceCandidate
import org.webrtc.MediaConstraints
import org.webrtc.MediaStream
import org.webrtc.PeerConnection
import org.webrtc.RtpReceiver
import org.webrtc.SdpObserver
import org.webrtc.SessionDescription

/** Suspending wrappers over libwebrtc's callback SDP API. */
private open class SdpCallback : SdpObserver {
  override fun onCreateSuccess(description: SessionDescription) = Unit
  override fun onSetSuccess() = Unit
  override fun onCreateFailure(error: String) = Unit
  override fun onSetFailure(error: String) = Unit
}

suspend fun PeerConnection.createOfferAwait(): SessionDescription =
  suspendCancellableCoroutine { continuation ->
    createOffer(
      object : SdpCallback() {
        override fun onCreateSuccess(description: SessionDescription) = continuation.resume(description)
        override fun onCreateFailure(error: String) = continuation.resumeWithException(IllegalStateException(error))
      },
      MediaConstraints(),
    )
  }

suspend fun PeerConnection.createAnswerAwait(): SessionDescription =
  suspendCancellableCoroutine { continuation ->
    createAnswer(
      object : SdpCallback() {
        override fun onCreateSuccess(description: SessionDescription) = continuation.resume(description)
        override fun onCreateFailure(error: String) = continuation.resumeWithException(IllegalStateException(error))
      },
      MediaConstraints(),
    )
  }

suspend fun PeerConnection.setLocalAwait(description: SessionDescription) =
  suspendCancellableCoroutine { continuation ->
    setLocalDescription(
      object : SdpCallback() {
        override fun onSetSuccess() = continuation.resume(Unit)
        override fun onSetFailure(error: String) = continuation.resumeWithException(IllegalStateException(error))
      },
      description,
    )
  }

suspend fun PeerConnection.setRemoteAwait(description: SessionDescription) =
  suspendCancellableCoroutine { continuation ->
    setRemoteDescription(
      object : SdpCallback() {
        override fun onSetSuccess() = continuation.resume(Unit)
        override fun onSetFailure(error: String) = continuation.resumeWithException(IllegalStateException(error))
      },
      description,
    )
  }

/** PeerConnection.Observer that only reports connection state. */
class ConnectionStateObserver(private val onState: (PeerConnection.PeerConnectionState) -> Unit) :
  PeerConnection.Observer {
  override fun onConnectionChange(newState: PeerConnection.PeerConnectionState) = onState(newState)
  override fun onSignalingChange(state: PeerConnection.SignalingState) = Unit
  override fun onIceConnectionChange(state: PeerConnection.IceConnectionState) = Unit
  override fun onIceConnectionReceivingChange(receiving: Boolean) = Unit
  override fun onIceGatheringChange(state: PeerConnection.IceGatheringState) = Unit
  override fun onIceCandidate(candidate: IceCandidate) = Unit
  override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>) = Unit
  override fun onAddStream(stream: MediaStream) = Unit
  override fun onRemoveStream(stream: MediaStream) = Unit
  override fun onDataChannel(channel: DataChannel) = Unit
  override fun onRenegotiationNeeded() = Unit
  override fun onAddTrack(receiver: RtpReceiver, streams: Array<out MediaStream>) = Unit
}
