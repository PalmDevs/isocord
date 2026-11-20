package me.palmdevs.isocord
import expo.modules.ReactActivityDelegateWrapper

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.SystemClock
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import me.palmdevs.isocord.core.FontScale
import me.palmdevs.isocord.notifications.Handover
import me.palmdevs.isocord.notifications.gateway.AppVisibility
import me.palmdevs.isocord.share.SharedContentInbox

class MainActivity : ReactActivity() {

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
    // The splash stays until JS reports the first real frame, or a few seconds at most.
    // Reset per activity. The process outlives a swiped-away task while the notifications gateway runs.
    splashDone = false
    val start = SystemClock.uptimeMillis()
    installSplashScreen().setKeepOnScreenCondition {
      !splashDone && SystemClock.uptimeMillis() - start < SPLASH_TIMEOUT_MS
    }
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

  companion object {
    private const val SPLASH_TIMEOUT_MS = 3000L
    @Volatile var splashDone = false
  }

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      ReactActivityDelegateWrapper(this, BuildConfig.IS_NEW_ARCHITECTURE_ENABLED, DefaultReactActivityDelegate(this, mainComponentName))
}
