package com.margelo.nitro.isocord

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
import android.util.Base64
import androidx.annotation.Keep
import androidx.core.content.ContextCompat
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.jstasks.HeadlessJsTaskConfig
import com.facebook.react.jstasks.HeadlessJsTaskContext
import com.facebook.react.modules.core.PermissionAwareActivity
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.Promise
import java.util.concurrent.CopyOnWriteArrayList
import kotlinx.serialization.builtins.nullable
import me.palmdevs.isocord.core.decodeOrNull
import me.palmdevs.isocord.notifications.gateway.AppVisibility
import me.palmdevs.isocord.voice.CallEngine
import me.palmdevs.isocord.voice.VoiceEvent
import me.palmdevs.isocord.voice.audio.DEFAULT_THRESHOLD_DBFS
import me.palmdevs.isocord.voice.audio.DEFAULT_VOLUME
import me.palmdevs.isocord.voice.audio.InputMode
import me.palmdevs.isocord.voice.audio.LEVEL_FLOOR_DBFS
import me.palmdevs.isocord.voice.audio.MAX_VOLUME
import me.palmdevs.isocord.voice.audio.PreferredDevices
import me.palmdevs.isocord.voice.rtc.ConnectRequest
import me.palmdevs.isocord.voice.rtc.SinkWants
import me.palmdevs.isocord.voice.stream.STREAM_PRESETS_JSON
import me.palmdevs.isocord.voice.telecom.CallDetails
import me.palmdevs.isocord.voice.video.CameraDevice
import me.palmdevs.isocord.voice.video.Cameras

/** Headless JS task that keeps JS timers, and so the gateway's heartbeat, running in the background during a call. */
private const val CALL_TASK_KEY = "IsocordCall"

/** No timeout: the task runs until the call ends. */
private const val CALL_TASK_NO_TIMEOUT = 0L

private const val SCREEN_CONSENT_REQUEST = 4242
private const val CAMERA_PERMISSION_REQUEST = 4243

/**
 * The JS side of CallEngine (src/native/specs/IsocordVoice.nitro.ts). Methods are fire-and-forget, results arrive
 * as events. Calls come on the JS thread. CallEngine queues its work on its own dispatcher.
 */
@DoNotStrip
@Keep
class HybridIsocordVoice : HybridIsocordVoiceSpec() {
  private val context: ReactApplicationContext =
    NitroModules.applicationContext ?: error("NitroModules.applicationContext is null")
  private val listeners = CopyOnWriteArrayList<(String) -> Unit>()
  private var callTask: Int? = null
  private val events: (VoiceEvent) -> Unit = { emit(it) }

  private val consentListener = object : BaseActivityEventListener() {
    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
      if (requestCode != SCREEN_CONSENT_REQUEST) return
      val granted = resultCode == Activity.RESULT_OK && data != null
      // Android 14 wants the mediaProjection service type before the projection starts.
      if (granted) CallEngine.setScreenConsent(data!!)
      emit(VoiceEvent.ScreenConsent(granted))
    }
  }

  init {
    // Nitro never disposes on a JS reload. The new runtime's instance retires the old one.
    current?.release()
    current = this
    CallEngine.events = events
    context.addActivityEventListener(consentListener)
  }

  /** Ends the call and drops the listeners. A JS reload loses the call's state, so the call ends with it. */
  private fun release() {
    // A new instance may have taken over already.
    if (CallEngine.events === events) CallEngine.events = null
    context.removeActivityEventListener(consentListener)
    listeners.clear()
    // Safe without a call.
    endCall()
  }

  override fun dispose() {
    if (current === this) current = null
    release()
    super.dispose()
  }

  override fun getConstants() = VoiceConstants(
    callTaskKey = CALL_TASK_KEY,
    defaultVolume = DEFAULT_VOLUME,
    maxVolume = MAX_VOLUME,
    defaultThreshold = DEFAULT_THRESHOLD_DBFS,
    inputLevelFloor = LEVEL_FLOOR_DBFS,
    streamPresets = STREAM_PRESETS_JSON,
  )

  override fun beginCall(details: String) {
    val call = decodeOrNull(CallDetails.serializer(), details) ?: return
    CallEngine.beginCall(context.applicationContext, call)
    AppVisibility.setCall(true)
    startCallTask()
  }

  override fun endCall() {
    CallEngine.endCall()
    AppVisibility.setCall(false)
    finishCallTask()
  }

  override fun connect(request: String) {
    val server = decodeOrNull(ConnectRequest.serializer(), request) ?: return
    CallEngine.connect(context.applicationContext, server)
  }

  override fun disconnect(context: String) {
    CallEngine.disconnect(context)
  }

  override fun setSelfMute(muted: Boolean) {
    CallEngine.setSelfMute(muted)
  }

  override fun setSelfDeaf(deafened: Boolean) {
    CallEngine.setSelfDeaf(deafened)
  }

  override fun setServerMute(muted: Boolean) {
    CallEngine.setServerMute(muted)
  }

  override fun setServerDeaf(deafened: Boolean) {
    CallEngine.setServerDeaf(deafened)
  }

  override fun setVideo(on: Boolean) {
    if (on && !cameraAllowed()) requestCamera() else CallEngine.setVideo(on)
  }

  override fun switchCamera() {
    CallEngine.switchCamera(context)
  }

  override fun setCamera(camera: String) {
    CallEngine.setCamera(decodeOrNull(CameraDevice.serializer().nullable, camera))
  }

  override fun setCameraReporting(on: Boolean) {
    Cameras.setReporting(context, on)
  }

  override fun setSinkWants(context: String, wants: String) {
    val parsed = decodeOrNull(SinkWants.serializer(), wants) ?: return
    CallEngine.setSinkWants(context, parsed)
  }

  /** Asks for screen capture consent. The user answers Android's dialog. */
  override fun requestScreen() {
    val activity = context.currentActivity ?: return emit(VoiceEvent.ScreenConsent(false))
    val projection = context.getSystemService(MediaProjectionManager::class.java)
    activity.startActivityForResult(projection.createScreenCaptureIntent(), SCREEN_CONSENT_REQUEST)
  }

  override fun setEndpoint(id: String) {
    CallEngine.setEndpoint(id)
  }

  override fun setPreferredDevices(devices: String) {
    val parsed = decodeOrNull(PreferredDevices.serializer(), devices) ?: return
    CallEngine.setPreferredDevices(context, parsed)
  }

  override fun setAudioDeviceReporting(on: Boolean) {
    CallEngine.setAudioDeviceReporting(context, on)
  }

  override fun setInputMode(mode: String) {
    val parsed = decodeOrNull(InputMode.serializer(), mode) ?: return
    CallEngine.setInputMode(parsed)
  }

  override fun setPushToTalk(down: Boolean) {
    CallEngine.setPushToTalk(down)
  }

  override fun setInputVolume(volume: Double) {
    CallEngine.setInputVolume(volume)
  }

  override fun setOutputVolume(volume: Double) {
    CallEngine.setOutputVolume(volume)
  }

  override fun setLocalVolume(context: String, userId: String, volume: Double) {
    CallEngine.setLocalVolume(context, userId, volume)
  }

  override fun setLocalMute(context: String, userId: String, muted: Boolean) {
    CallEngine.setLocalMute(context, userId, muted)
  }

  override fun setInputLevelReporting(on: Boolean) {
    CallEngine.setInputLevelReporting(context.applicationContext, on)
  }

  /** Resolves with our stream's preview as base64 JPEG, or undefined. */
  override fun captureStreamPreview(): Promise<String?> {
    val promise = Promise<String?>()
    CallEngine.captureStreamPreview { jpeg -> promise.resolve(jpeg?.let { Base64.encodeToString(it, Base64.NO_WRAP) }) }
    return promise
  }

  override fun onVoiceEvent(listener: (payload: String) -> Unit): () -> Unit {
    listeners.add(listener)
    return { listeners.remove(listener) }
  }

  private fun emit(event: VoiceEvent) {
    val payload = event.toJson()
    for (listener in listeners) listener(payload)
  }

  private fun cameraAllowed() =
    ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED

  /** Asks for the camera permission, then turns the camera on. The user answers Android's dialog. */
  private fun requestCamera() {
    val activity = context.currentActivity as? PermissionAwareActivity
      ?: return emit(VoiceEvent.Error("camera", "no activity"))
    activity.requestPermissions(arrayOf(Manifest.permission.CAMERA), CAMERA_PERMISSION_REQUEST) { _, _, results ->
      val granted = results.firstOrNull() == PackageManager.PERMISSION_GRANTED
      if (granted) CallEngine.setVideo(true) else emit(VoiceEvent.Error("camera", "permission denied"))
      true
    }
  }

  /** Keeps JS timers running in the background while the call lasts. */
  private fun startCallTask() = UiThreadUtil.runOnUiThread {
    if (callTask != null) return@runOnUiThread
    callTask = HeadlessJsTaskContext.getInstance(context)
      .startTask(HeadlessJsTaskConfig(CALL_TASK_KEY, Arguments.createMap(), CALL_TASK_NO_TIMEOUT, true))
  }

  private fun finishCallTask() = UiThreadUtil.runOnUiThread {
    callTask?.let { HeadlessJsTaskContext.getInstance(context).finishTask(it) }
    callTask = null
  }

  companion object {
    /** The instance of the running JS runtime. */
    @Volatile private var current: HybridIsocordVoice? = null
  }
}
