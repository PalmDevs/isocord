package com.margelo.nitro.isocord

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.util.Log
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.Promise
import me.palmdevs.isocord.MainActivity
import me.palmdevs.isocord.voice.overlay.OVERLAY_COMPONENT
import me.palmdevs.isocord.voice.overlay.PIP_WINDOW_OFFSET_DP
import me.palmdevs.isocord.voice.overlay.VoiceOverlay

private const val TAG = "IsocordVoice"

/** MobileVoiceOverlayModule.OVERLAY_REQUEST_CODE. */
private const val OVERLAY_REQUEST = 234780

/**
 * The call bubble's setting, call and permission (src/native/specs/IsocordVoiceOverlay.nitro.ts). Reference:
 * MobileVoiceOverlayModule.
 */
@DoNotStrip
@Keep
class HybridIsocordVoiceOverlay : HybridIsocordVoiceOverlaySpec() {
  private val context: ReactApplicationContext =
    NitroModules.applicationContext ?: error("NitroModules.applicationContext is null")
  private var pending: Promise<Boolean>? = null

  private val permissionListener = object : BaseActivityEventListener() {
    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
      if (requestCode != OVERLAY_REQUEST) return
      pending?.resolve(VoiceOverlay.canDraw(context))
      pending = null
    }
  }

  init {
    // Nitro never disposes on a JS reload. The new runtime's instance retires the old one.
    current?.release()
    current = this
    context.addActivityEventListener(permissionListener)
  }

  /** Drops the listener and the bubble. A JS reload ends the call, so its bubble goes too. */
  private fun release() {
    context.removeActivityEventListener(permissionListener)
    UiThreadUtil.runOnUiThread { VoiceOverlay.setChannel(context, null) }
  }

  override fun dispose() {
    if (current === this) current = null
    release()
    super.dispose()
  }

  override fun getConstants() = VoiceOverlayConstants(
    componentName = OVERLAY_COMPONENT,
    pipWindowOffset = PIP_WINDOW_OFFSET_DP.toDouble(),
  )

  override fun setEnabled(enabled: Boolean) {
    UiThreadUtil.runOnUiThread { VoiceOverlay.setEnabled(context, enabled) }
  }

  override fun setChannel(channelId: String?) {
    UiThreadUtil.runOnUiThread { VoiceOverlay.setChannel(context, channelId) }
  }

  override fun canDrawOverlays(): Boolean = VoiceOverlay.canDraw(context)

  /**
   * enableOverlay: resolves true when drawing over apps is allowed. Otherwise opens the system page for it and
   * resolves with the answer once the user comes back.
   */
  override fun requestPermission(): Promise<Boolean> {
    if (VoiceOverlay.canDraw(context)) return Promise.resolved(true)
    val activity = context.currentActivity ?: return Promise.resolved(false)
    val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${context.packageName}"))
    try {
      activity.startActivityForResult(intent, OVERLAY_REQUEST)
    } catch (e: ActivityNotFoundException) {
      Log.e(TAG, "No overlay permission page", e)
      return Promise.resolved(false)
    }
    val promise = Promise<Boolean>()
    pending?.resolve(false)
    pending = promise
    return promise
  }

  /** Brings the app to the front, from a tap in the bubble (OverlayMenuBubbleDialog's Open Discord). */
  override fun openApp() {
    val intent = Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    context.startActivity(intent)
  }

  companion object {
    /** The instance of the running JS runtime. */
    @Volatile private var current: HybridIsocordVoiceOverlay? = null
  }
}
