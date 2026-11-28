package me.palmdevs.isocord.voice.video

import android.content.Context
import android.hardware.camera2.CameraAccessException
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.UiThreadUtil
import kotlinx.serialization.Serializable
import me.palmdevs.isocord.voice.CallEngine
import me.palmdevs.isocord.voice.VoiceEvent

private const val TAG = "IsocordVoice"

/** Where a camera faces (`CameraDevice.facing`, voiceTypes.ts). */
object CameraFacing {
  const val FRONT = "front"
  const val BACK = "back"
  /** A USB camera: Camera2 `LENS_FACING_EXTERNAL`. */
  const val EXTERNAL = "external"
}

/**
 * A camera, and its identity across calls (voiceTypes.ts `CameraDevice`). `id` is the Camera2 id, which a
 * USB camera may change when plugged in again. `name` is its model where Camera2 reports one, else empty.
 */
@Serializable
data class CameraDevice(val id: String, val facing: String, val name: String)

/**
 * The phone's cameras, the remembered one, and the camera capture runs on. One per process: the cameras are
 * the device's, not an account's.
 */
object Cameras {
  /** The camera to capture with, from the voice settings. Null picks the front camera. */
  @Volatile var preferred: CameraDevice? = null

  /** What capture runs on now, for `camera` events. */
  @Volatile var current: CameraDevice? = null
    private set

  private var reporting: CameraManager.AvailabilityCallback? = null
  private var reported: List<CameraDevice>? = null

  /** Returns every camera Camera2 lists. Logical multi-cameras show as one, as webrtc opens them. */
  fun list(context: Context): List<CameraDevice> {
    val manager = context.getSystemService(CameraManager::class.java)
    return try {
      manager.cameraIdList.mapNotNull { id -> describe(manager, id) }
    } catch (e: CameraAccessException) {
      Log.w(TAG, "camera list failed", e)
      emptyList()
    }
  }

  private fun describe(manager: CameraManager, id: String): CameraDevice? {
    val characteristics = try {
      manager.getCameraCharacteristics(id)
    } catch (e: IllegalArgumentException) {
      // Unplugged while listing.
      Log.w(TAG, "camera $id gone", e)
      return null
    }
    val facing = when (characteristics.get(CameraCharacteristics.LENS_FACING)) {
      CameraCharacteristics.LENS_FACING_FRONT -> CameraFacing.FRONT
      CameraCharacteristics.LENS_FACING_BACK -> CameraFacing.BACK
      else -> CameraFacing.EXTERNAL
    }
    val name = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      characteristics.get(CameraCharacteristics.INFO_VERSION).orEmpty()
    } else {
      ""
    }
    return CameraDevice(id, facing, name)
  }

  /**
   * Returns the camera to capture with: [wanted] by id, or by name for a USB camera whose id changed. Else the
   * front camera, else the first. Null without a camera.
   */
  fun resolve(context: Context, wanted: CameraDevice? = preferred): CameraDevice? {
    val cameras = list(context)
    return wanted?.let { want -> cameras.firstOrNull { it.id == want.id && it.facing == want.facing } }
      ?: wanted?.takeIf { it.name.isNotEmpty() }?.let { want ->
        cameras.firstOrNull { it.name == want.name && it.facing == want.facing }
      }
      ?: cameras.firstOrNull { it.facing == CameraFacing.FRONT }
      ?: cameras.firstOrNull()
  }

  /** Remembers the camera after the one capture runs on (VoicePanelHeader: the first that isn't the current one). */
  fun pickNext(context: Context): CameraDevice? {
    val next = list(context).firstOrNull { it.id != current?.id } ?: return null
    preferred = next
    CallEngine.events?.invoke(VoiceEvent.Camera(current, next))
    return next
  }

  /** Records what capture runs on, null once it stops, and tells JS. */
  fun setCurrent(camera: CameraDevice?) {
    current = camera
    CallEngine.events?.invoke(VoiceEvent.Camera(camera, null))
  }

  /** Emits `cameras` now and whenever a camera comes or goes, such as a USB camera, while on. */
  fun setReporting(context: Context, on: Boolean) = UiThreadUtil.runOnUiThread {
    val manager = context.getSystemService(CameraManager::class.java)
    reporting?.let(manager::unregisterAvailabilityCallback)
    reporting = null
    reported = null
    if (!on) return@runOnUiThread
    val callback = object : CameraManager.AvailabilityCallback() {
      // Opening a camera makes it unavailable too: the list is Camera2's, and only changes are sent.
      override fun onCameraAvailable(cameraId: String) = report(context)

      override fun onCameraUnavailable(cameraId: String) = report(context)
    }
    reporting = callback
    // A null handler calls back on this thread's looper, the main one.
    manager.registerAvailabilityCallback(callback, null)
    report(context)
  }

  private fun report(context: Context) {
    val cameras = list(context)
    if (cameras == reported) return
    reported = cameras
    CallEngine.events?.invoke(VoiceEvent.Cameras(cameras))
  }
}
