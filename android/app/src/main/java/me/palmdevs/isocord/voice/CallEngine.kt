package me.palmdevs.isocord.voice

import android.content.Context
import android.content.Intent
import android.util.Log
import com.facebook.react.modules.network.OkHttpClientProvider
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import me.palmdevs.isocord.voice.audio.AudioDevices
import me.palmdevs.isocord.voice.audio.AudioInput
import me.palmdevs.isocord.voice.audio.PreferredDevices
import me.palmdevs.isocord.voice.audio.InputMode
import me.palmdevs.isocord.voice.audio.PlaybackVolumes
import me.palmdevs.isocord.voice.audio.RNNOISE_RATE_HZ
import me.palmdevs.isocord.voice.rtc.ConnectRequest
import me.palmdevs.isocord.voice.rtc.MediaKit
import me.palmdevs.isocord.voice.rtc.RtcConnection
import me.palmdevs.isocord.voice.rtc.RtcContext
import me.palmdevs.isocord.voice.rtc.RtcListener
import me.palmdevs.isocord.voice.rtc.RtcState
import me.palmdevs.isocord.voice.rtc.SinkWants
import me.palmdevs.isocord.voice.telecom.AudioEndpoint
import me.palmdevs.isocord.voice.telecom.CallAction
import me.palmdevs.isocord.voice.telecom.CallDetails
import me.palmdevs.isocord.voice.telecom.CallFlags
import me.palmdevs.isocord.voice.telecom.CallListener
import me.palmdevs.isocord.voice.telecom.CallTelecom
import me.palmdevs.isocord.voice.video.CameraDevice
import me.palmdevs.isocord.voice.video.Cameras
import org.webrtc.DefaultVideoDecoderFactory
import org.webrtc.DefaultVideoEncoderFactory
import org.webrtc.EglBase
import org.webrtc.PeerConnectionFactory
import org.webrtc.VideoSink
import org.webrtc.VideoTrack
import org.webrtc.audio.AudioProcessingOptions
import org.webrtc.audio.JavaAudioDeviceModule

private const val TAG = "IsocordVoice"

/** A video to show: a user's camera or screen in one context. Our own is under our user id. */
data class VideoKey(val context: String, val userId: String)

/** The flags that decide what we send and play. */
private data class Flags(
  val selfMute: Boolean = false,
  val selfDeaf: Boolean = false,
  val serverMute: Boolean = false,
  val serverDeaf: Boolean = false,
  /** Telecom hold, such as a cellular call. */
  val held: Boolean = false,
  val camera: Boolean = false,
) {
  val deafened get() = selfDeaf || serverDeaf || held
  val microphone get() = !selfMute && !serverMute && !deafened
}

/**
 * The process's call: one audio device module, factory and EGL context shared by the voice connection and at
 * most one stream connection, plus the Telecom side. Everything runs on one serial dispatcher.
 */
@OptIn(ExperimentalCoroutinesApi::class)
object CallEngine : RtcListener, CallListener {
  /** A failure outside a connection is reported, not fatal. Connections handle their own (RtcConnection). */
  private val failures = CoroutineExceptionHandler { _, e ->
    Log.e(TAG, "call engine failed", e)
    events?.invoke(VoiceEvent.Error("connection", e.toString()))
  }
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default.limitedParallelism(1) + failures)
  private val egl: EglBase by lazy { EglBase.create() }
  private var factoryInitialized = false
  private var kit: MediaKit? = null
  private var audio: JavaAudioDeviceModule? = null
  private val input = AudioInput(scope, InputHost)
  private val devices = AudioDevices(scope, DevicesHost)
  private val volumes = PlaybackVolumes()
  /** The settings screen's meter is on. It records outside a call too. */
  private var levelReporting = false
  /** The meter's own recording request (`requestStartRecording`) is held. Never during a call: see [syncMeter]. */
  private var meterRecording = false
  private var voice: RtcConnection? = null
  private var stream: RtcConnection? = null
  private var voiceConnected = false
  /** Between beginCall and endCall. */
  private var inCall = false
  private var flags = Flags()
  /** The MediaProjection consent for the next own stream, used once. */
  private var screenConsent: Intent? = null
  /** Screen capture running or about to: the service needs the mediaProjection type. */
  private var screening = false
  private val sinks = mutableMapOf<VideoKey, MutableSet<VideoSink>>()
  private val tracks = mutableMapOf<VideoKey, VideoTrack>()

  /** Receives events for JS. Called on the engine's dispatcher. */
  @Volatile var events: ((VoiceEvent) -> Unit)? = null

  /** Shared EGL context for decoders and video views. */
  val eglContext: EglBase.Context get() = egl.eglBaseContext

  fun beginCall(context: Context, details: CallDetails) = scope.launch {
    // A details update for the running call keeps the outputs it has seen.
    if (!inCall) devices.callStarted()
    inCall = true
    // The meter's recording goes before the call's starts.
    syncMeter()
    CallTelecom.begin(context, details, this@CallEngine)
    updateTelecom()
  }

  fun endCall() = scope.launch {
    inCall = false
    closeVoice()
    closeStream()
    CallTelecom.end()
    flags = Flags()
    screenConsent = null
    input.callEnded()
    // The peers are disposed, so the call's recording has stopped: the meter may record again.
    syncMeter()
    if (!levelReporting) releaseKit()
  }

  fun connect(context: Context, request: ConnectRequest) = scope.launch {
    val stream = request.context == RtcContext.STREAM
    val owner = stream && request.owner
    // Our own stream keeps the mediaProjection type that its consent added.
    if (stream) closeStream(keepCapture = owner) else closeVoice()
    val screen = if (owner) screenConsent.also { screenConsent = null } else null
    val connection = RtcConnection(kit(context), request, scope, this@CallEngine, screen)
    connection.remoteGain = { userId -> volumes.gain(request.context, userId) }
    if (!stream) connection.setAudioProcessing(input.processing)
    if (stream) this@CallEngine.stream = connection else voice = connection
    connection.start()
    if (!stream) applyFlags()
  }

  fun disconnect(context: String) = scope.launch {
    if (context == RtcContext.STREAM) closeStream() else closeVoice()
  }

  fun setSelfMute(muted: Boolean) = updateFlags { it.copy(selfMute = muted) }

  fun setSelfDeaf(deafened: Boolean) = updateFlags { it.copy(selfDeaf = deafened) }

  fun setServerMute(muted: Boolean) = updateFlags { it.copy(serverMute = muted) }

  fun setServerDeaf(deafened: Boolean) = updateFlags { it.copy(serverDeaf = deafened) }

  fun setVideo(on: Boolean) = updateFlags { it.copy(camera = on) }

  /** The switch button: the next camera (VoicePanelHeader), remembered by JS from the `camera` event. */
  fun switchCamera(context: Context) = scope.launch {
    if (Cameras.pickNext(context) != null) voice?.switchCamera()
  }

  /** Remembers the camera to capture with, null for the default, and moves a running camera to it. */
  fun setCamera(camera: CameraDevice?) = scope.launch {
    Cameras.preferred = camera
    voice?.switchCamera()
  }

  /** Sets what to receive on one connection: which users' video at which quality. */
  fun setSinkWants(context: String, wants: SinkWants) = scope.launch {
    (if (context == RtcContext.STREAM) stream else voice)?.setSinkWants(wants)
  }

  /** Keeps a screen capture consent for the next own stream and adds the service's mediaProjection type. */
  fun setScreenConsent(consent: Intent) = scope.launch {
    // The call ended while the consent dialog was open.
    if (!inCall) return@launch
    screenConsent = consent
    screening = true
    updateTelecom()
  }

  fun setEndpoint(id: String) = CallTelecom.requestEndpoint(id)

  /** The remembered input and output. The input applies at once, the output as it appears in a call. */
  fun setPreferredDevices(context: Context, preferred: PreferredDevices) = scope.launch {
    devices.setPreferred(context.applicationContext, preferred)
  }

  fun setAudioDeviceReporting(context: Context, on: Boolean) = scope.launch {
    devices.setReporting(context.applicationContext, on)
  }

  /** Voice activity or push to talk, sensitivity and processing. Applies mid-call. */
  fun setInputMode(mode: InputMode) = scope.launch { input.setMode(mode) }

  fun setPushToTalk(down: Boolean) = scope.launch { input.setPushToTalk(down) }

  fun setInputVolume(volume: Double) = scope.launch { input.setInputVolume(volume) }

  /** Scales every remote user's playback, both contexts (MediaEngineStore `outputVolume`). */
  fun setOutputVolume(volume: Double) = scope.launch {
    volumes.output = volume
    applyRemoteGain()
  }

  fun setLocalVolume(context: String, userId: String, volume: Double) = scope.launch {
    volumes.setVolume(context, userId, volume)
    applyRemoteGain()
  }

  fun setLocalMute(context: String, userId: String, muted: Boolean) = scope.launch {
    volumes.setMute(context, userId, muted)
    applyRemoteGain()
  }

  /** Emits `inputLevel` while on. Outside a call it records just for the meter, in a call it reads the call's. */
  fun setInputLevelReporting(context: Context, on: Boolean) = scope.launch {
    if (on == levelReporting) return@launch
    levelReporting = on
    input.setLevelReporting(on)
    if (on) kit(context)
    syncMeter()
    if (!on && !inCall) releaseKit()
  }

  /**
   * Holds the meter's recording request only outside a call, with [processing] applied. The call's StopRecording
   * leaves a requested recording thread running but clears its buffer, and the thread's next frame aborts the
   * process (webrtc-sdk m150 `WebRtcAudioRecord.stopRecordingIfNeededImpl`, `AudioRecordJni::StopRecording`).
   */
  private fun syncMeter(processing: AudioProcessingOptions = input.processing) {
    val audio = audio ?: return
    val wanted = levelReporting && !inCall
    if (wanted) {
      // Again on each change: the request applies the processing.
      if (!audio.requestStartRecording(processing)) Log.w(TAG, "meter recording refused")
    } else if (meterRecording) {
      audio.requestStopRecording()
    }
    meterRecording = wanted
  }

  /** Shows the video of [key] in [sink] until [detach], following track changes. Any thread. */
  fun attach(key: VideoKey, sink: VideoSink) = scope.launch {
    sinks.getOrPut(key, ::mutableSetOf).add(sink)
    tracks[key]?.addSink(sink)
  }

  fun detach(key: VideoKey, sink: VideoSink) = scope.launch {
    val attached = sinks[key] ?: return@launch
    attached.remove(sink)
    if (attached.isEmpty()) sinks.remove(key)
    tracks[key]?.removeSink(sink)
  }

  private fun updateFlags(change: (Flags) -> Flags) = scope.launch {
    flags = change(flags)
    applyFlags()
  }

  private fun applyFlags() {
    audio?.setSpeakerMute(flags.deafened)
    if (!flags.microphone) input.microphoneClosed()
    voice?.setMicrophone(flags.microphone)
    voice?.setCamera(flags.camera)
    updateTelecom()
  }

  private fun updateTelecom() = CallTelecom.update(
    CallFlags(
      muted = flags.selfMute || flags.serverMute,
      deafened = flags.selfDeaf || flags.serverDeaf,
      camera = flags.camera && voice != null,
      screen = screening,
      connected = voiceConnected,
    ),
  )

  private fun applyRemoteGain() {
    voice?.applyRemoteGain()
    stream?.applyRemoteGain()
  }

  private fun closeVoice() {
    voice?.close()
    voice = null
    voiceConnected = false
  }

  private fun closeStream(keepCapture: Boolean = false) {
    stream?.close()
    stream = null
    if (screening && !keepCapture) {
      screening = false
      updateTelecom()
    }
  }

  private fun kit(context: Context): MediaKit = kit ?: createKit(context.applicationContext).also { kit = it }

  private fun createKit(context: Context): MediaKit {
    if (!factoryInitialized) {
      PeerConnectionFactory.initialize(PeerConnectionFactory.InitializationOptions.builder(context).createInitializationOptions())
      factoryInitialized = true
    }
    val audio = JavaAudioDeviceModule.builder(context)
      // RNNoise's rate: AudioRecord resamples a device that reports another (the default follows the device).
      .setSampleRate(RNNOISE_RATE_HZ)
      .setUseHardwareAcousticEchoCanceler(true)
      .setUseHardwareNoiseSuppressor(true)
      .setSamplesReadyCallback(input.samples)
      .setAudioRecordErrorCallback(input.recordErrors(context))
      .createAudioDeviceModule()
    this.audio = audio
    devices.attach(audio)
    val factory = PeerConnectionFactory.builder()
      .setAudioDeviceModule(audio)
      .setAudioProcessingFactory(input.processingFactory)
      .setVideoEncoderFactory(DefaultVideoEncoderFactory(egl.eglBaseContext, true, false))
      .setVideoDecoderFactory(DefaultVideoDecoderFactory(egl.eglBaseContext))
      .createPeerConnectionFactory()
    return MediaKit(context, factory, egl, OkHttpClientProvider.getOkHttpClient())
  }

  private fun releaseKit() {
    kit?.factory?.dispose()
    kit = null
    audio?.release()
    audio = null
    devices.detach()
    meterRecording = false
  }

  private fun emit(event: VoiceEvent) {
    events?.invoke(event) ?: Log.w(TAG, "no JS listener for ${event::class.simpleName}")
  }

  override fun onState(connection: RtcConnection, state: String, code: Int?) {
    if (connection !== voice && connection !== stream) return
    emit(VoiceEvent.State(connection.context, state, code))
    if (connection === voice) {
      voiceConnected = state == RtcState.CONNECTED
      updateTelecom()
    }
    if (state != RtcState.DISCONNECTED) return
    if (connection === voice) closeVoice() else closeStream()
  }

  override fun onSpeaking(context: String, userId: String, speaking: Boolean) =
    emit(VoiceEvent.Speaking(context, userId, speaking))

  override fun onVideo(context: String, userId: String, active: Boolean) =
    emit(VoiceEvent.Video(context, userId, active))

  override fun onClientConnect(context: String, userIds: List<String>) =
    emit(VoiceEvent.ClientConnect(context, userIds))

  override fun onClientDisconnect(context: String, userId: String) =
    emit(VoiceEvent.ClientDisconnect(context, userId))

  override fun onSecureFrames(context: String, version: Int) = emit(VoiceEvent.SecureFrames(context, version))

  /** Moves the attached views from the old track to the new one. */
  override fun onVideoTrack(context: String, userId: String, track: VideoTrack?) {
    val key = VideoKey(context, userId)
    val attached = sinks[key].orEmpty()
    tracks.remove(key)?.let { old -> attached.forEach(old::removeSink) }
    if (track == null) return
    tracks[key] = track
    attached.forEach(track::addSink)
  }

  override fun onError(kind: String, message: String) = emit(VoiceEvent.Error(kind, message))

  override fun onStreamPaused(paused: Boolean) = emit(VoiceEvent.StreamPaused(paused))

  override fun onNetworkChanged(context: String) = emit(VoiceEvent.NetworkChanged(context))

  /** Hands our own stream's latest preview JPEG to [done], or null without one. Encodes off the engine thread. */
  fun captureStreamPreview(done: (ByteArray?) -> Unit) = scope.launch {
    val connection = stream
    withContext(Dispatchers.IO) { done(connection?.captureStreamPreview()) }
  }

  /** The camera failed and its connection already sent Video inactive. Our flag follows, so JS can turn it on again. */
  override fun onCameraStopped(reason: String) {
    flags = flags.copy(camera = false)
    updateTelecom()
    emit(VoiceEvent.CameraStopped(reason))
  }

  override fun onScreenStopped() {
    emit(VoiceEvent.StreamEnded)
    screening = false
    updateTelecom()
  }

  override fun onCallAction(action: CallAction) {
    when (action) {
      is CallAction.Hold -> updateFlags { it.copy(held = action.on) }
      CallAction.Disconnect -> scope.launch { emit(VoiceEvent.CallAction("disconnect")) }
      is CallAction.Mute -> scope.launch { emit(VoiceEvent.CallAction("mute", action.on)) }
      is CallAction.Deafen -> scope.launch { emit(VoiceEvent.CallAction("deafen", action.on)) }
    }
  }

  override fun onEndpoints(available: List<AudioEndpoint>, current: String?) {
    scope.launch {
      devices.onEndpoints(available, current)
      emit(VoiceEvent.Endpoints(available, current))
    }
  }

  /** The remembered devices' hooks into the call. On the engine's dispatcher. */
  private object DevicesHost : AudioDevices.Host {
    override fun selectEndpoint(id: String) = CallTelecom.requestEndpoint(id)

    override fun emit(event: VoiceEvent) = CallEngine.emit(event)
  }

  /** The microphone path's hooks into the voice connection. On the engine's dispatcher. */
  private object InputHost : AudioInput.Host {
    override fun transmit(on: Boolean, priority: Boolean) {
      voice?.setSpeaking(on, priority)
    }

    override fun onProcessingChanged(options: AudioProcessingOptions) {
      voice?.setAudioProcessing(options)
      // The meter's own recording applies platform AEC and NS when it starts.
      if (meterRecording) syncMeter(options)
    }

    override fun emit(event: VoiceEvent) = CallEngine.emit(event)
  }
}
