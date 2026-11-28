package me.palmdevs.isocord
import expo.modules.ReactActivityDelegateWrapper

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.SystemClock
import androidx.activity.OnBackPressedCallback
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.uimanager.util.ReactFindViewUtil
import me.palmdevs.isocord.core.FontScale
import me.palmdevs.isocord.core.Perf
import me.palmdevs.isocord.notifications.Handover
import me.palmdevs.isocord.notifications.gateway.AppVisibility
import me.palmdevs.isocord.share.SharedContentInbox
import me.palmdevs.isocord.voice.overlay.VoiceOverlay

class MainActivity : ReactActivity() {
  internal var panelBackCallback: OnBackPressedCallback? = null

  /**
   * Back with nothing left to close: moves the task behind, as Android 12+ does for a launcher's root activity.
   * The reference gets that default (BackPressManager turns RN's callback off when JS has no handler). React
   * Native's own fallback finishes the activity, which unmounts the app and ended a call with it.
   */
  private val rootBackCallback =
    object : OnBackPressedCallback(true) {
      override fun handleOnBackPressed() {
        if (!moveTaskToBack(false)) finish()
      }
    }

  override fun invokeDefaultOnBackPressed() {
    val panelCallback = panelBackCallback
    val wasEnabled = panelCallback?.isEnabled == true
    panelCallback?.isEnabled = false
    try {
      super.invokeDefaultOnBackPressed()
    } finally {
      panelCallback?.isEnabled = wasEnabled
    }
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "Isocord"

  /** The activity's views (Compose chat, chat input) read text sizes from its own resources, not the application's. */
  override fun attachBaseContext(newBase: Context) {
    super.attachBaseContext(FontScale.wrap(newBase))
  }

  /**
   * react-native-screens fragments can't be restored from saved state; React Navigation rebuilds the
   * screens from JS instead. Without this, restoring the activity throws in ScreenFragment's constructor.
   */
  override fun onCreate(savedInstanceState: Bundle?) {
    // The initial React screen must be attached and laid out before Android draws it.
    val start = SystemClock.uptimeMillis()
    installSplashScreen().setKeepOnScreenCondition {
      val content = ReactFindViewUtil.findView(window.decorView, SPLASH_CONTENT_NATIVE_ID)
      when {
        content != null && content.width > 0 && content.height > 0 ->
          Perf.span("startup:splash-content-ready") { false }
        SystemClock.uptimeMillis() - start >= SPLASH_TIMEOUT_MS ->
          Perf.span("startup:splash-timeout") { false }
        else -> true
      }
    }
    // Added first, so every other callback (React Native's, panels, screens) runs before it.
    onBackPressedDispatcher.addCallback(rootBackCallback)
    super.onCreate(null)
    // A restored activity or one reopened from recents would share the same content again.
    if (savedInstanceState == null && !SharedContentInbox.isReplay(intent)) SharedContentInbox.receive(intent, this)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    SharedContentInbox.receive(intent, this)
  }

  // On resume and pause, as JS's AppState turns active and background: while the app is in front, JS forwards the
  // app session's dispatches (AppSession) and the background gateway session is paused.
  override fun onResume() {
    super.onResume()
    Handover.shared.returned()
    AppVisibility.set(true)
  }

  override fun onPause() {
    Handover.shared.left()
    AppVisibility.set(false)
    super.onPause()
  }

  // On start and stop, not resume and pause: a system dialog over the app (a permission, screen capture consent)
  // pauses it but leaves it on screen, and the call bubble stays away.
  override fun onStart() {
    super.onStart()
    VoiceOverlay.setAppVisible(this, true)
  }

  override fun onStop() {
    super.onStop()
    VoiceOverlay.setAppVisible(this, false)
  }

  companion object {
    internal const val SPLASH_CONTENT_NATIVE_ID = "isocord-splash-content"

    /** Recovery limit when the initial screen never mounts. */
    private const val SPLASH_TIMEOUT_MS = 5_000L
  }

  /**
   * Returns the instance of the [ReactActivityDelegate].
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      ReactActivityDelegateWrapper(this, BuildConfig.IS_NEW_ARCHITECTURE_ENABLED, DefaultReactActivityDelegate(this, mainComponentName))
}
