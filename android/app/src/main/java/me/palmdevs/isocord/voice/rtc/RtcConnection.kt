package me.palmdevs.isocord.voice.rtc

import android.content.Intent
import android.util.Log
import java.nio.ByteBuffer
import java.util.UUID
import kotlin.time.Duration.Companion.seconds
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeoutOrNull
import me.palmdevs.isocord.voice.LocalVideo
import me.palmdevs.isocord.voice.ScreenEvents
import me.palmdevs.isocord.voice.SpeakingFlag
import me.palmdevs.isocord.voice.VideoQualityMode
import me.palmdevs.isocord.voice.VoiceCloseCode
import me.palmdevs.isocord.voice.VoiceOp
import me.palmdevs.isocord.voice.stream.OwnStream
import me.palmdevs.isocord.voice.stream.OwnStreamListener
import org.json.JSONArray
import org.json.JSONObject
import org.webrtc.AudioSource
import org.webrtc.AudioTrack
import org.webrtc.FrameDecryptor
import org.webrtc.FrameEncryptor
import org.webrtc.MediaConstraints
import org.webrtc.MediaStreamTrack
import org.webrtc.PeerConnection
import org.webrtc.RtpParameters
import org.webrtc.RtpSender
import org.webrtc.RtpTransceiver
import org.webrtc.SessionDescription
import org.webrtc.VideoTrack
import org.webrtc.audio.AudioProcessingOptions

/** Recvonly sections offered up front. More are added when a speaker or camera finds none free. */
private const val INITIAL_AUDIO_SLOTS = 4
private const val INITIAL_VIDEO_SLOTS = 2

/** Recvonly sections added at once, so a crowd that joins costs few renegotiations. */
private const val AUDIO_SLOT_GROWTH = 4
private const val VIDEO_SLOT_GROWTH = 2

/** Receive sections per kind at most. Guards against a runaway loop, far above any channel's speakers. */
private const val MAX_RECEIVE_SECTIONS = 128

/** Priority step between codecs in Select Protocol (RTCControlSocket.tsx `selectProtocol`). */
private const val CODEC_PRIORITY_STEP = 1000

/** How long our own stream's ICE restart waits for the voice gateway to be usable again. */
private val GATEWAY_WAIT = 10.seconds

/** Heartbeat ack wait after a network change (RTCConnection.tsx `_handleNetworkOnline`, 5000 ms). */
private val NETWORK_HEARTBEAT_TIMEOUT = 5.seconds

private val STATS_INTERVAL = 30.seconds

/** Codec names in Select Protocol to libdave codecs. */
private val DAVE_CODECS = mapOf(
  "opus" to DaveNative.CODEC_OPUS,
  "H264" to DaveNative.CODEC_H264,
  "VP8" to DaveNative.CODEC_VP8,
  "VP9" to DaveNative.CODEC_VP9,
  "AV1" to DaveNative.CODEC_AV1,
)

/**
 * One voice server over the `webrtc` protocol with DAVE frame encryption: the voice channel, or a Go Live stream
 * we watch or own (reference `RTCConnection`, `StreamRTCConnection`). Runs on CallEngine's serial dispatcher.
 */
class RtcConnection(
  private val kit: MediaKit,
  val request: ConnectRequest,
  parentScope: CoroutineScope,
  private val listener: RtcListener,
  /** MediaProjection consent, for our own Go Live stream. */
  private val screen: Intent?,
) : DaveTransport, VoiceGatewayListener, RecoveryHost {
  val context = request.context
  private val stream = context == RtcContext.STREAM
  /** A stream we only watch. Viewers send no media at all. */
  private val viewer = stream && screen == null
  private val tag = if (stream) "IsocordVoiceStream" else "IsocordVoice"
  /** A failure ends this connection, on the engine's dispatcher, and JS decides whether to rejoin. */
  private val failures = CoroutineExceptionHandler { _, e ->
    Log.e(tag, "connection failed", e)
    parentScope.launch { listener.onState(this@RtcConnection, RtcState.DISCONNECTED) }
  }
  private val scope =
    CoroutineScope(parentScope.coroutineContext + SupervisorJob(parentScope.coroutineContext[Job]) + failures)
  private var gateway = VoiceGateway(request, kit.http, scope, this, tag)
  private var dave = DaveSession(request.userId, request.channelId.toLong(), this)
  private val network = NetworkWatcher(kit.context, tag) { scope.launch { onNetworkChanged() } }
  private val recovery = ConnectionRecovery(scope, this, network.online, tag)
  /** Our own stream's quality, app audio, previews, rotation and pause. */
  private val own = if (screen != null) OwnStream(kit, request, scope, tag, OwnStreamEvents()) else null
  /** Our own stream with app audio has a factory of its own (StreamMedia). */
  private val factory get() = own?.factory ?: kit.factory
  private var peer: PeerConnection? = null
  /** Counts peers, so a disposed one's late state changes are dropped. */
  private var peerGeneration = 0
  private var everConnected = false
  private var audioSender: RtpSender? = null
  private var audioSource: AudioSource? = null
  private var audioTrack: AudioTrack? = null
  /** Our track's processing, from CallEngine's input mode. Applied again to each new track. */
  private var audioProcessing: AudioProcessingOptions? = null
  /** Playback gain of a remote user's audio, from CallEngine's volumes. */
  var remoteGain: (userId: String) -> Double = { 1.0 }
  private val layers = VideoLayers.create(tag, stream, viewer, request.videoQualityMode == VideoQualityMode.FULL)

  /** Our transceivers. PeerConnection.getTransceivers() disposes the wrappers it returned before, senders included. */
  private val transceivers = mutableListOf<RtpTransceiver>()
  private var offer: List<OfferSection> = emptyList()
  private var opusPayloadType = 0
  private var videoCodecs: List<VideoCodec> = emptyList()
  /** Our sendrecv video section, which carries the camera or screen. */
  private var sendSection: OfferSection? = null
  /** The call's video codec, from Session Description and Session Update. */
  private var callCodec: String? = null
  private var serverSdp: String? = null
  /** Session Description came once. Later ones answer an ICE restart. */
  private var sessionStarted = false
  private var rtcConnectionId = ""
  private val remote = mutableMapOf<String, RemoteStream>()
  private val negotiation = Mutex()
  /** Speaking and Video payloads that arrive before the first answer, replayed after it. */
  private val early = mutableListOf<Pair<Int, JSONObject>>()
  private var localSsrc = 0L
  /** Unmuted voice connection: the audio encoding is active and the microphone open. */
  private var microphone = false
  /** Voice activity: audio frames pass the encryptor and op 5 says we speak. */
  private var speaking = false
  /** Our own stream sends app audio: the audio encoding is active and the encryptor's gate open. */
  private var soundshare = false
  private var cameraWanted = false
  private var localVideo: LocalVideo? = null
  /** Counts camera starts, so a stopped camera's late failures are dropped. */
  private var videoGeneration = 0
  /** What the server wants us to send, from op 15. */
  private var incomingWants = IncomingWants.ALL
  /** What JS wants to receive. Sent as op 15 with the users' SSRCs. */
  private var sinkWants = SinkWants()
  private var lastSinkWants: String? = null
  /** Each remote user's active video layers, from op 12. */
  private val userVideo = mutableMapOf<String, List<RemoteLayer>>()
  /** Remote speaking from received audio: op 5 alone never ends a burst. */
  private val speakers =
    RemoteSpeaking(scope, { peer }, { ssrc -> remote.values.firstOrNull { it.ssrc == ssrc }?.userId }) { userId, on ->
      listener.onSpeaking(context, userId, on)
    }

  fun start() {
    listener.onState(this, RtcState.CONNECTING)
    network.start()
    gateway.open()
    speakers.start()
    scope.launch {
      while (isActive) {
        delay(STATS_INTERVAL)
        Log.d(tag, "stats: ${dave.stats()}, peer ${peer?.connectionState()}")
      }
    }
  }

  /** Closes the socket and the peer connection. Video tracks are reported gone first. */
  fun close() {
    recovery.cancel()
    network.stop()
    gateway.close()
    teardownMedia()
    own?.release()
    scope.cancel()
  }

  /** Returns a JPEG of our own stream for its preview, or null before the first frame. Any thread. */
  fun captureStreamPreview(): ByteArray? = own?.previewJpeg()

  /** Opens or closes the microphone path. Stream connections never send audio. */
  fun setMicrophone(on: Boolean) {
    microphone = on && !stream
    applyMicrophone()
  }

  /**
   * Voice activity or push to talk: opens the encryptor's gate and sends op 5, or closes both. Nothing is sent
   * between bursts. [priority] adds the priority speaker flag.
   */
  fun setSpeaking(on: Boolean, priority: Boolean = false) {
    val next = on && microphone && audioSender != null
    if (next == speaking) return
    speaking = next
    DaveNative.encryptorSetTransmitting(dave.encryptor, next)
    val flags = when {
      !next -> SpeakingFlag.NONE
      priority -> SpeakingFlag.VOICE or SpeakingFlag.PRIORITY
      else -> SpeakingFlag.VOICE
    }
    sendSpeaking(flags)
    listener.onSpeaking(context, request.userId, next)
  }

  /** Speaking (op 5) for our audio SSRC. */
  private fun sendSpeaking(flags: Int) =
    gateway.send(VoiceOp.SPEAKING, JSONObject().put("speaking", flags).put("delay", 0).put("ssrc", localSsrc))

  /**
   * Opens or closes our own stream's app audio: the audio encoding, the encryptor's gate and op 5 with the
   * SOUNDSHARE flag (docs.discord.food, Stream Media Connections). Sent once per stream, not per burst.
   */
  private fun setSoundshare(on: Boolean) {
    if (on == soundshare) return
    soundshare = on
    applyMicrophone()
    DaveNative.encryptorSetTransmitting(dave.encryptor, on)
    sendSpeaking(if (on) SpeakingFlag.SOUNDSHARE else SpeakingFlag.NONE)
    Log.i(tag, "app audio $on")
  }

  fun setCamera(on: Boolean) {
    if (stream) return
    cameraWanted = on
    if (on == (localVideo != null)) return
    if (!on) return stopVideo()
    if (serverSdp == null) return // Started once Session Description arrives.
    val generation = ++videoGeneration
    val camera = capture("camera") {
      LocalVideo.camera(kit.context, kit.factory, kit.egl) { reason, message ->
        scope.launch { onCameraFailed(generation, reason, message) }
      }
    }
    if (camera != null) startVideo(camera)
  }

  /** Starts a capture, or reports why it couldn't: no camera, a refused permission, a lapsed consent. */
  private fun capture(kind: String, start: () -> LocalVideo?): LocalVideo? =
    try {
      val video = start()
      if (video == null) listener.onError(kind, "no $kind")
      video
    } catch (e: RuntimeException) {
      Log.e(tag, "$kind capture failed", e)
      listener.onError(kind, e.toString())
      null
    }

  fun switchCamera() {
    localVideo?.switchCamera()
  }

  /** Turns the camera off cleanly after it stopped on its own: Video (op 12) inactive, then JS clears `selfVideo`. */
  private fun onCameraFailed(generation: Int, reason: String, message: String) {
    if (generation != videoGeneration || localVideo == null) return
    Log.w(tag, "camera stopped ($reason): $message")
    cameraWanted = false
    stopVideo()
    listener.onError("camera", message)
    listener.onCameraStopped(reason)
  }

  /** Sets what we want to receive and sends it to the server (op 15). */
  fun setSinkWants(wants: SinkWants) {
    sinkWants = wants
    sendSinkWants()
  }

  /** Sets our track's AEC, NS and AGC. Senders apply a change mid-call, no new track (AudioTrack, webrtc-sdk). */
  fun setAudioProcessing(options: AudioProcessingOptions) {
    audioProcessing = options
    applyAudioProcessing(options)
  }

  private fun applyAudioProcessing(options: AudioProcessingOptions) {
    val track = audioTrack ?: return
    val result = track.setAudioProcessingOptions(options)
    Log.i(tag, "audio processing ${result.code}: ${result.message}")
  }

  /** Applies [remoteGain] to every remote user's audio again. */
  fun applyRemoteGain() {
    remote.forEach { (mid, stream) -> if (!isRecvVideo(mid)) applyRemoteGain(mid, stream.userId) }
  }

  private fun applyRemoteGain(mid: String, userId: String) {
    val track = transceivers.firstOrNull { it.mid == mid }?.receiver?.track() as? AudioTrack ?: return
    track.setVolume(remoteGain(userId))
  }

  private fun applyMicrophone() {
    val sender = audioSender ?: return
    val parameters = sender.parameters
    parameters.encodings.forEach { it.active = microphone || soundshare }
    sender.setParameters(parameters)
    if (!microphone) setSpeaking(false)
    Log.i(tag, "microphone $microphone")
  }

  override fun identify(): JSONObject =
    JSONObject()
      .put("server_id", request.serverId)
      .put("channel_id", request.channelId)
      .put("user_id", request.userId)
      .put("session_id", request.sessionId)
      .put("token", request.token)
      .put("video", true)
      // The layers we would send (RTCControlSocket.tsx identify `streamParameters`).
      .put("streams", layers.announce())
      .put("max_dave_protocol_version", DaveNative.maxProtocolVersion())

  override suspend fun onMessage(op: Int, d: JSONObject?) {
    when (op) {
      VoiceOp.READY -> onReady(d!!)
      VoiceOp.SESSION_DESCRIPTION -> onSessionDescription(d!!)
      VoiceOp.SPEAKING, VoiceOp.VIDEO -> if (serverSdp == null) early += op to d!! else onMedia(op, d!!)
      VoiceOp.SESSION_UPDATE -> onSessionUpdate(d!!)
      VoiceOp.MEDIA_SINK_WANTS -> onSinkWants(d!!)
      VoiceOp.CLIENT_CONNECT -> {
        val userIds = d!!.getJSONArray("user_ids").strings()
        userIds.forEach(dave::createUser)
        listener.onClientConnect(context, userIds)
      }
      VoiceOp.CLIENT_DISCONNECT -> {
        val userId = d!!.getString("user_id")
        dave.destroyUser(userId)
        speakers.forget(userId)
        listener.onClientDisconnect(context, userId)
        freeSections(userId)
      }
      VoiceOp.DAVE_PREPARE_TRANSITION ->
        dave.onPrepareTransition(d!!.getInt("transition_id"), d.getInt("protocol_version"))
      VoiceOp.DAVE_EXECUTE_TRANSITION -> {
        dave.onExecuteTransition(d!!.getInt("transition_id"))
        listener.onSecureFrames(context, dave.protocolVersion)
      }
      VoiceOp.DAVE_PREPARE_EPOCH -> dave.onPrepareEpoch(d!!.getLong("epoch"), d.getInt("protocol_version"))
    }
  }

  override fun onBinary(op: Int, payload: ByteBuffer) {
    when (op) {
      VoiceOp.MLS_EXTERNAL_SENDER -> dave.onExternalSender(payload.rest())
      VoiceOp.MLS_PROPOSALS -> dave.onProposals(payload.rest())
      VoiceOp.MLS_ANNOUNCE_COMMIT -> dave.onAnnounceCommit(payload.unsignedShort(), payload.rest())
      VoiceOp.MLS_WELCOME -> dave.onWelcome(payload.unsignedShort(), payload.rest())
    }
  }

  override fun onResuming() = listener.onState(this, RtcState.RECONNECTING)

  override fun onResumed() {
    if (!recovery.active && peer?.connectionState() == PeerConnection.PeerConnectionState.CONNECTED) {
      listener.onState(this, RtcState.CONNECTED)
    }
  }

  /**
   * The voice gateway is gone. After a handshake the media path may still be fine, so a full reconnect comes
   * first, unless the server closed us for good (docs.discord.food, Voice Close Codes).
   */
  override fun onGone(code: Int?) {
    val final = code in VoiceCloseCode.FINAL
    when {
      recovery.active -> recovery.onGatewayGone(code, final)
      !final && sessionStarted && canRebuild -> recovery.start("voice gateway lost", settle = false, iceRestart = false)
      else -> listener.onState(this, RtcState.DISCONNECTED, code)
    }
  }

  private fun onPeerState(state: PeerConnection.PeerConnectionState) {
    Log.i(tag, "peer $state")
    when (state) {
      PeerConnection.PeerConnectionState.CONNECTED -> {
        everConnected = true
        recovery.onConnected()
        listener.onState(this, RtcState.CONNECTED)
      }
      PeerConnection.PeerConnectionState.DISCONNECTED -> recovery.onPeerDisconnected()
      PeerConnection.PeerConnectionState.FAILED -> {
        // RTCConnection.tsx `_handleNoRoute`: tell the server we never reached it.
        if (!everConnected) gateway.send(VoiceOp.NO_ROUTE, JSONObject())
        recovery.onPeerFailed()
      }
      else -> Unit
    }
  }

  /**
   * The default network changed: reconnects the media path now instead of waiting for the peer to fail. JS checks
   * the main gateway (GatewaySocketSingleton `networkStateChange`).
   */
  private fun onNetworkChanged() {
    listener.onNetworkChanged(context)
    if (serverSdp == null) return
    gateway.expeditedHeartbeat(NETWORK_HEARTBEAT_TIMEOUT)
    recovery.start("network changed", settle = true)
  }

  override val canRebuild get() = screen == null

  override fun onRecoveryStarted() = listener.onState(this, RtcState.RECONNECTING)

  override fun onRecoveryFailed(code: Int?) = listener.onState(this, RtcState.DISCONNECTED, code)

  /** Sends a new Select Protocol with fresh ICE credentials. The next Session Description answers it. */
  override suspend fun restartIce() {
    val peer = peer ?: return
    if (withTimeoutOrNull(GATEWAY_WAIT) { gateway.healthy.first { it } } == null) return
    Log.i(tag, "restarting ICE")
    peer.restartIce()
    val description = negotiation.withLock { setLocalOffer(peer) }
    sendSelectProtocol(description)
  }

  /** Reconnects from the voice gateway's Identify, as the reference does when the media connection drops. */
  override suspend fun rebuild() {
    Log.i(tag, "reconnecting the voice gateway")
    gateway.close()
    teardownMedia()
    gateway = VoiceGateway(request, kit.http, scope, this, tag)
    dave = DaveSession(request.userId, request.channelId.toLong(), this)
    gateway.open()
  }

  /** Releases the peer, our tracks and DAVE state, and forgets the session. Our camera starts again at the next one. */
  private fun teardownMedia() {
    stopVideo()
    remote.filterKeys(::isRecvVideo).values.forEach { listener.onVideoTrack(context, it.userId, null) }
    peerGeneration++
    peer?.dispose()
    peer = null
    speakers.reset()
    audioSender = null
    layers.bind(emptyList())
    audioTrack?.dispose()
    audioSource?.dispose()
    audioTrack = null
    audioSource = null
    dave.close()
    transceivers.clear()
    offer = emptyList()
    remote.clear()
    early.clear()
    userVideo.clear()
    sendSection = null
    videoCodecs = emptyList()
    callCodec = null
    serverSdp = null
    sessionStarted = false
    speaking = false
    incomingWants = IncomingWants.ALL
    lastSinkWants = null
  }

  private suspend fun onReady(d: JSONObject) {
    Log.i(tag, "ready: ssrc ${d.optLong("ssrc")}, streams ${d.optJSONArray("streams")}")
    localSsrc = d.getLong("ssrc")
    layers.assign(d.optJSONArray("streams"), localSsrc)
    val peer = createPeer()
    val description = negotiation.withLock { setLocalOffer(peer) }
    offer = VoiceSdp.sections(description)
    opusPayloadType = VoiceSdp.opusPayloadType(description)
    sendSection = offer.first { it.kind == "video" && it.direction == "sendrecv" }
    videoCodecs = VoiceSdp.videoCodecs(offer)
    Log.i(tag, "video codecs: $videoCodecs, encodable ${videoCodecs.filter(::encodable).map { it.name }}")
    DaveNative.encryptorAssignCodec(dave.encryptor, localSsrc.toInt(), DaveNative.CODEC_OPUS)
    applyMicrophone()
    rtcConnectionId = UUID.randomUUID().toString()
    sendSelectProtocol(description)
  }

  /** Select Protocol with our offer fragment and codecs (docs.discord.food, Select Protocol). */
  private fun sendSelectProtocol(description: String) {
    val opus = JSONObject()
      .put("name", "opus")
      .put("type", "audio")
      .put("priority", CODEC_PRIORITY_STEP)
      .put("payload_type", opusPayloadType)
      .put("rtx_payload_type", JSONObject.NULL)
    gateway.send(
      VoiceOp.SELECT_PROTOCOL,
      JSONObject()
        .put("protocol", "webrtc")
        .put("data", VoiceSdp.fragment(description))
        .put("codecs", selectCodecs(opus))
        .put("rtc_connection_id", rtcConnectionId),
    )
  }

  /**
   * Sets a new local offer, payload type 96 moved away and the assigned SSRCs written in, and returns its SDP.
   * Callers hold the negotiation lock.
   */
  private suspend fun setLocalOffer(peer: PeerConnection): String {
    val created = VoiceSdp.avoidProbePayloadType(peer.createOfferAwait().description)
    val sdp = VoiceSdp.assignSsrcs(created, assignedSsrcs(VoiceSdp.sections(created)))
    peer.setLocalAwait(SessionDescription(SessionDescription.Type.OFFER, sdp))
    return sdp
  }

  /** The SSRCs READY gave us for each send section: audio, then the video layers in section order. */
  private fun assignedSsrcs(sections: List<OfferSection>): Map<String, SsrcPair> = buildMap {
    sections.firstOrNull { it.kind == "audio" && it.direction == "sendrecv" }
      ?.let { put(it.mid, SsrcPair(localSsrc, null)) }
    val videoSections = sections.filter { it.kind == "video" && it.direction != "recvonly" }
    videoSections.zip(layers.assigned).forEach { (section, layer) ->
      put(section.mid, SsrcPair(layer.ssrc, layer.rtxSsrc))
    }
  }

  private suspend fun onSessionDescription(d: JSONObject) {
    serverSdp = d.getString("sdp")
    if (sessionStarted) {
      Log.i(tag, "session description after an ICE restart")
      return applyAnswer()
    }
    sessionStarted = true
    callCodec = d.optString("video_codec").ifEmpty { null }
    val daveVersion = d.optInt("dave_protocol_version")
    Log.i(tag, "session description: audio ${d.optString("audio_codec")}, video $callCodec, dave $daveVersion")
    gateway.resumable = true
    applyAnswer()
    dave.onSelectProtocolAck(daveVersion)
    listener.onSecureFrames(context, daveVersion)
    early.forEach { (op, payload) -> onMedia(op, payload) }
    early.clear()
    sendSinkWants()
    when {
      own != null && screen != null -> startScreen(own, screen)
      cameraWanted -> setCamera(true)
      else -> sendVideoState()
    }
  }

  /** Starts our own stream's screen capture, then its app audio on the same projection. */
  private fun startScreen(own: OwnStream, consent: Intent) {
    val video = capture("screen") { own.capture(consent, ProjectionEvents()) } ?: return
    startVideo(video)
    setSoundshare(own.sendsAppAudio)
  }

  /** The screen capture's projection events, on a capture thread. */
  private inner class ProjectionEvents : ScreenEvents {
    override fun onStop() {
      scope.launch {
        stopVideo()
        listener.onScreenStopped()
      }
    }

    override fun onVisibilityChanged(visible: Boolean) {
      scope.launch { own?.onVisibilityChanged(visible) }
    }
  }

  /** What our own stream reports, on the engine's dispatcher. */
  private inner class OwnStreamEvents : OwnStreamListener {
    /** The layer's downscale follows the new capture height. `max_resolution` is the preset's, so no op 12. */
    override fun onCaptureResized() = layers.apply(localVideo, incomingWants)

    override fun onPausedChanged(paused: Boolean) = listener.onStreamPaused(paused)
  }

  /** Session Update (op 14): the call's codecs change as people join with other codecs. */
  private suspend fun onSessionUpdate(d: JSONObject) {
    Log.i(tag, "session update: $d")
    val codec = d.optString("video_codec").ifEmpty { null } ?: return
    if (codec == callCodec) return
    callCodec = codec
    assignVideoCodec()
    renegotiate()
  }

  /** Media Sink Wants (op 15): what the server wants us to send. Layers nobody wants stop sending. */
  private fun onSinkWants(d: JSONObject) {
    Log.i(tag, "media sink wants: $d")
    incomingWants = IncomingWants.parse(d)
    layers.apply(localVideo, incomingWants)
  }

  private suspend fun onMedia(op: Int, d: JSONObject) = if (op == VoiceOp.SPEAKING) onSpeaking(d) else onVideo(d)

  /** Whether libwebrtc offered this codec on our send section, so it can encode it. */
  private fun encodable(codec: VideoCodec) = sendSection?.rtpmaps?.containsKey(codec.payloadType) == true

  /** The codec our send section uses: the call's, else the first we can encode. */
  private fun sendCodec(): VideoCodec? =
    videoCodecs.firstOrNull { it.name == callCodec && encodable(it) } ?: videoCodecs.firstOrNull(::encodable)

  /** Select Protocol codecs: Opus, then each video codec we decode, and encode when libwebrtc can. */
  private fun selectCodecs(opus: JSONObject): JSONArray {
    val codecs = JSONArray().put(opus)
    videoCodecs.forEachIndexed { index, codec ->
      codecs.put(
        JSONObject()
          .put("name", codec.name)
          .put("type", "video")
          .put("priority", (index + 1) * CODEC_PRIORITY_STEP)
          .put("payload_type", codec.payloadType)
          .put("rtx_payload_type", codec.rtxPayloadType ?: JSONObject.NULL)
          .put("encode", encodable(codec))
          .put("decode", true),
      )
    }
    return codecs
  }

  private fun startVideo(video: LocalVideo) {
    localVideo = video
    assignVideoCodec()
    layers.setTrack(video.track)
    layers.apply(video, incomingWants)
    listener.onVideoTrack(context, request.userId, video.track)
    sendVideoState()
  }

  private fun stopVideo() {
    videoGeneration++
    val video = localVideo ?: return
    localVideo = null
    listener.onVideoTrack(context, request.userId, null)
    layers.setTrack(null)
    own?.stop()
    setSoundshare(false)
    video.dispose()
    sendVideoState()
  }

  /** Tells DAVE which codec each video layer's SSRC carries. */
  private fun assignVideoCodec() {
    val codec = sendCodec()?.name
    val daveCodec = DAVE_CODECS[codec] ?: return
    layers.assigned.forEach { DaveNative.encryptorAssignCodec(dave.encryptor, it.ssrc.toInt(), daveCodec) }
    Log.i(tag, "sending video as $codec on ${layers.assigned.map { it.ssrc }}")
  }

  /** Video (op 12): our camera or screen layers, active or not (RTCControlSocket.tsx `video`). */
  private fun sendVideoState() {
    val first = layers.assigned.firstOrNull() ?: return
    val video = localVideo
    gateway.send(
      VoiceOp.VIDEO,
      JSONObject()
        .put("audio_ssrc", localSsrc)
        .put("video_ssrc", if (video != null) first.ssrc else 0)
        .put("rtx_ssrc", if (video != null) first.rtxSsrc else 0)
        .put("streams", layers.toJson(video)),
    )
    listener.onVideo(context, request.userId, video != null)
  }

  /** Sends our wants as op 15 when they changed (RTCConnection.tsx `_localMediaSinkWantsManager` Update). */
  private fun sendSinkWants() {
    if (serverSdp == null) return
    val payload = sinkWants.toPayload(userVideo).toString()
    if (payload == lastSinkWants) return
    lastSinkWants = payload
    Log.i(tag, "media sink wants sent: $payload")
    gateway.send(VoiceOp.MEDIA_SINK_WANTS, JSONObject(payload))
  }

  /** Video (op 12): maps a user's active video stream to a free recvonly video section. */
  private suspend fun onVideo(d: JSONObject) {
    val userId = d.getString("user_id")
    val streams = d.optJSONArray("streams") ?: JSONArray()
    val live = (0 until streams.length()).map(streams::getJSONObject)
      .filter { it.optBoolean("active") && it.optLong("ssrc") != 0L }
    val active = live.maxByOrNull { it.optInt("quality") }
    val current = remote.entries.firstOrNull { (mid, stream) -> stream.userId == userId && isRecvVideo(mid) }
    if (live.isEmpty()) {
      userVideo.remove(userId)
    } else {
      userVideo[userId] = live.map { RemoteLayer(it.getLong("ssrc"), it.optInt("quality")) }
    }
    sendSinkWants()
    if (active == null || d.optLong("video_ssrc") == 0L) {
      // Keeps the mapping: the server toggles a stream off and on, and renegotiating stalls the receiver.
      listener.onVideo(context, userId, false)
      return
    }
    listener.onVideo(context, userId, true)
    val ssrc = active.getLong("ssrc")
    if (current?.value?.ssrc == ssrc) return
    val rtx = active.optLong("rtx_ssrc").takeIf { it != 0L } ?: (ssrc + 1)
    val mid = current?.key ?: acquireSection("video")?.mid ?: return
    remote[mid] = RemoteStream(userId, ssrc, rtx)
    val receiver = attachDecryptor(mid, userId)
    listener.onVideoTrack(context, userId, receiver.track() as VideoTrack)
    Log.i(tag, "user $userId video ssrc $ssrc rtx $rtx on mid $mid")
    renegotiate()
  }

  /** Gives a departed user's receive sections back, so later speakers and cameras find a free one. */
  private suspend fun freeSections(userId: String) {
    userVideo.remove(userId)
    sendSinkWants()
    val mids = remote.filterValues { it.userId == userId }.keys
    if (mids.isEmpty()) return
    mids.filter(::isRecvVideo).forEach { listener.onVideoTrack(context, userId, null) }
    mids.forEach(remote::remove)
    renegotiate()
  }

  private fun isRecvVideo(mid: String) =
    offer.firstOrNull { it.mid == mid }?.let { it.kind == "video" && it.direction == "recvonly" } == true

  private fun freeSection(kind: String) =
    offer.firstOrNull { it.kind == kind && it.direction == "recvonly" && it.mid !in remote }

  /** Returns a free receive section, adding a batch of them when none is left. */
  private suspend fun acquireSection(kind: String): OfferSection? = freeSection(kind) ?: growSections(kind)

  /**
   * Adds recvonly sections and applies the answer for them. Our own list keeps the transceivers
   * (docs/voice.md 7.1), the new offer gives their mids.
   */
  private suspend fun growSections(kind: String): OfferSection? = negotiation.withLock {
    val peer = peer ?: return@withLock null
    val count = offer.count { it.kind == kind && it.direction == "recvonly" }
    if (count >= MAX_RECEIVE_SECTIONS) {
      Log.w(tag, "no $kind section left, $count in use")
      return@withLock null
    }
    val audio = kind == "audio"
    val type = if (audio) MediaStreamTrack.MediaType.MEDIA_TYPE_AUDIO else MediaStreamTrack.MediaType.MEDIA_TYPE_VIDEO
    val growth = if (audio) AUDIO_SLOT_GROWTH else VIDEO_SLOT_GROWTH
    repeat(growth) { transceivers += peer.addTransceiver(type, recvOnly()) }
    offer = VoiceSdp.sections(setLocalOffer(peer))
    applyAnswerLocked()
    Log.i(tag, "$kind sections: $count -> ${offer.count { it.kind == kind && it.direction == "recvonly" }}")
    freeSection(kind)
  }

  /** Speaking (op 5): starts the user's speaking and maps a new SSRC to a free recvonly audio section. */
  private suspend fun onSpeaking(d: JSONObject) {
    val userId = d.getString("user_id")
    val ssrc = d.getLong("ssrc")
    speakers.onSpeakingOp(userId, d.optInt("speaking") and SpeakingFlag.VOICE != 0)
    if (remote.values.any { it.ssrc == ssrc }) return
    val free = acquireSection("audio") ?: return
    remote[free.mid] = RemoteStream(userId, ssrc)
    attachDecryptor(free.mid, userId)
    applyRemoteGain(free.mid, userId)
    Log.i(tag, "user $userId ssrc $ssrc on mid ${free.mid}")
    renegotiate()
  }

  private fun attachDecryptor(mid: String, userId: String) =
    transceivers.first { it.mid == mid }.receiver.also {
      val decryptor = dave.decryptorFor(userId)
      it.setFrameDecryptor(FrameDecryptor { DaveNative.decryptorWebrtcPointer(decryptor) })
    }

  /** Sends a new offer, then applies the answer for it. One at a time: callers suspend mid-negotiation. */
  private suspend fun renegotiate() = negotiation.withLock {
    peer?.let { setLocalOffer(it) }
    applyAnswerLocked()
  }

  private suspend fun applyAnswer() = negotiation.withLock { applyAnswerLocked() }

  private suspend fun applyAnswerLocked() {
    val sdp = serverSdp ?: return
    val answer = VoiceSdp.answer(offer, sdp, opusPayloadType, videoCodecs, sendCodec(), remote)
    peer?.setRemoteAwait(SessionDescription(SessionDescription.Type.ANSWER, answer))
  }

  private fun createPeer(): PeerConnection {
    val config = PeerConnection.RTCConfiguration(emptyList()).apply {
      sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
      bundlePolicy = PeerConnection.BundlePolicy.MAXBUNDLE
      rtcpMuxPolicy = PeerConnection.RtcpMuxPolicy.REQUIRE
    }
    val generation = ++peerGeneration
    val observer = ConnectionStateObserver { state ->
      scope.launch { if (generation == peerGeneration) onPeerState(state) }
    }
    val peer = factory.createPeerConnection(config, observer)!!
    this.peer = peer
    // Starts inactive: an inactive encoding sends nothing and keeps the microphone closed.
    val audioInit = RtpTransceiver.RtpTransceiverInit(
      RtpTransceiver.RtpTransceiverDirection.SEND_RECV,
      emptyList(),
      listOf(RtpParameters.Encoding(null, false, null)),
    )
    val source = factory.createAudioSource(MediaConstraints()).also { audioSource = it }
    val track = factory.createAudioTrack("audio", source).also { audioTrack = it }
    (own?.audioProcessing ?: audioProcessing)?.let(::applyAudioProcessing)
    audioSender = peer.addTransceiver(track, audioInit).also(transceivers::add).sender.also(::encrypt)
    val audioType = MediaStreamTrack.MediaType.MEDIA_TYPE_AUDIO
    val videoType = MediaStreamTrack.MediaType.MEDIA_TYPE_VIDEO
    repeat(INITIAL_AUDIO_SLOTS) { transceivers += peer.addTransceiver(audioType, recvOnly()) }
    repeat(INITIAL_VIDEO_SLOTS) { transceivers += peer.addTransceiver(videoType, recvOnly()) }
    // Camera or screen, one sender per layer. Without a track they send nothing.
    val senders = List(layers.size.coerceAtLeast(1)) { index ->
      val direction = if (index == 0) {
        RtpTransceiver.RtpTransceiverDirection.SEND_RECV
      } else {
        RtpTransceiver.RtpTransceiverDirection.SEND_ONLY
      }
      peer.addTransceiver(videoType, RtpTransceiver.RtpTransceiverInit(direction))
        .also(transceivers::add).sender.also(::encrypt)
    }
    layers.bind(senders)
    return peer
  }

  private fun encrypt(sender: RtpSender) =
    sender.setFrameEncryptor(FrameEncryptor { DaveNative.encryptorWebrtcPointer(dave.encryptor) })

  private fun recvOnly() = RtpTransceiver.RtpTransceiverInit(RtpTransceiver.RtpTransceiverDirection.RECV_ONLY)

  override fun sendReadyForTransition(transitionId: Int) =
    gateway.send(VoiceOp.DAVE_READY_FOR_TRANSITION, JSONObject().put("transition_id", transitionId))

  override fun sendKeyPackage(keyPackage: ByteArray) = gateway.sendBinary(VoiceOp.MLS_KEY_PACKAGE, keyPackage)

  override fun sendCommitWelcome(commitWelcome: ByteArray) =
    gateway.sendBinary(VoiceOp.MLS_COMMIT_WELCOME, commitWelcome)

  override fun sendInvalidCommitWelcome(transitionId: Int) =
    gateway.send(VoiceOp.MLS_INVALID_COMMIT_WELCOME, JSONObject().put("transition_id", transitionId))
}

private fun ByteBuffer.rest(): ByteArray = ByteArray(remaining()).also(::get)

private fun JSONArray.strings(): List<String> = List(length()) { getString(it) }
