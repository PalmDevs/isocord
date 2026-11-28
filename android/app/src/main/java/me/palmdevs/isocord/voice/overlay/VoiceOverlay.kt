package me.palmdevs.isocord.voice.overlay

import android.content.Context
import android.provider.Settings
import android.util.Log
import android.view.ContextThemeWrapper
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.ReactContext
import com.swmansion.reanimated.ReanimatedModule
import me.palmdevs.isocord.R
import me.palmdevs.isocord.core.FontScale

private const val TAG = "IsocordVoice"

/** The overlay's React root, registered with AppRegistry (MobileVoiceOverlay.tsx). */
const val OVERLAY_COMPONENT = "IsocordVoiceOverlay"

/**
 * The call bubble over other apps (MobileVoiceOverlayLifecycleManager and MobileVoiceOverlay). It shows while the
 * setting is on, a call runs, the app is in the background and drawing over apps is allowed. The reference shows
 * it in front too. Main thread only.
 */
object VoiceOverlay {
  private var app: Context? = null
  private var enabled = false
  private var channelId: String? = null
  /** MobileVoiceOverlayManager.trashedVoiceChannelId: a bubble dropped in the trash stays away for that call. */
  private var trashedChannelId: String? = null
  private var appVisible = false
  private var bubble: OverlayBubble? = null
  /** Where the bubble last came to rest, for its next show in this process. */
  private var rest: BubbleRest? = null
  /** The React context whose rendering the bubble resumed while the activity was paused. */
  private var resumed: ReactContext? = null

  /** The voice overlay setting (MobileVoiceOverlayStore.enabled). */
  fun setEnabled(context: Context, on: Boolean) {
    app = context.applicationContext
    enabled = on
    update()
  }

  /** The call's channel, or null without a call. A new channel forgets a trashed bubble. */
  fun setChannel(context: Context, id: String?) {
    app = context.applicationContext
    if (id != channelId) trashedChannelId = null
    channelId = id
    update()
  }

  /** Called as the activity starts and stops: whether the app is on screen. */
  fun setAppVisible(context: Context, visible: Boolean) {
    app = context.applicationContext
    appVisible = visible
    update()
  }

  fun canDraw(context: Context): Boolean = Settings.canDrawOverlays(context)

  private fun update() {
    val context = app ?: return
    val id = channelId
    val show = enabled && id != null && id != trashedChannelId && !appVisible && canDraw(context)
    if (show && bubble == null) bubble = showBubble(context)
    if (!show) hideBubble()
  }

  private fun showBubble(context: Context): OverlayBubble? {
    val host = (context as ReactApplication).reactHost ?: return null
    val react = host.currentReactContext ?: return null
    // The same theme and text size as the activity's React views.
    val themed = ContextThemeWrapper(FontScale.wrap(context), R.style.AppTheme)
    val surface = host.createSurface(themed, OVERLAY_COMPONENT, null)
    val shown = OverlayBubble(
      themed,
      surface,
      rest,
      onRest = { rest = it },
      onTrashed = {
        trashedChannelId = channelId
        hideBubble()
      },
    )
    if (!shown.attach()) {
      shown.remove()
      return null
    }
    resumeRendering(react)
    return shown
  }

  private fun hideBubble() {
    bubble?.remove()
    bubble = null
    resumed?.let { if (!appVisible) pauseRendering(it) }
    resumed = null
  }

  /**
   * Restarts the frame loops a paused activity stops: Fabric's mounting (FabricUIManager.onHostPause) and
   * Reanimated's (NodesManager.onHostPause). Without them the bubble never draws a JS update. AppState stays
   * background, since the host itself stays paused.
   */
  private fun resumeRendering(react: ReactContext) {
    if (appVisible) return
    (react.getFabricUIManager() as? LifecycleEventListener)?.onHostResume()
    reanimated(react)?.onHostResume()
    resumed = react
  }

  /** Stops the frame loops again, as the paused activity left them. */
  private fun pauseRendering(react: ReactContext) {
    (react.getFabricUIManager() as? LifecycleEventListener)?.onHostPause()
    reanimated(react)?.onHostPause()
  }

  private fun reanimated(react: ReactContext): ReanimatedModule? {
    val module = react.getNativeModule(ReanimatedModule::class.java)
    if (module == null) Log.w(TAG, "Reanimated is missing: overlay animations stay paused")
    return module
  }
}
