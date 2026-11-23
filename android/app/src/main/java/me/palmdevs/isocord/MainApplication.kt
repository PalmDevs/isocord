package me.palmdevs.isocord
import android.content.res.Configuration
import android.content.res.Resources
import android.util.Log
import androidx.compose.foundation.AndroidComposeFoundationFlags
import androidx.compose.foundation.ExperimentalFoundationApi
import com.jakewharton.processphoenix.ProcessPhoenix
import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ExpoReactHostFactory

import android.app.Application
import android.content.pm.ActivityInfo
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.internal.featureflags.ReactNativeFeatureFlags
import com.facebook.react.internal.featureflags.ReactNativeNewArchitectureFeatureFlagsDefaults
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import me.palmdevs.isocord.chat.ChatPackage
import me.palmdevs.isocord.core.ConstantsPackage
import me.palmdevs.isocord.core.CorePackage
import me.palmdevs.isocord.core.FontScale
import me.palmdevs.isocord.core.TwemojiFonts
import me.palmdevs.isocord.input.ChatInputPackage
import me.palmdevs.isocord.network.IsocordNetwork
import me.palmdevs.isocord.notifications.NotificationsPackage
import me.palmdevs.isocord.upload.UploaderPackage

private const val TAG = "IsocordStartup"

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    // Every React Native text layout needs this host, so ReactFontManager has the fonts before any.
    TwemojiFonts.awaitReactFonts()
    ExpoReactHostFactory.getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(ChatPackage())
          add(ChatInputPackage())
          add(UploaderPackage())
          add(NotificationsPackage())
          add(ConstantsPackage())
          add(CorePackage())
        },
      // Expo defaults to its own virtual entry, which only Expo CLI serves. This app uses plain Metro.
      jsMainModulePath = "index",
    )
  }

  @OptIn(ExperimentalFoundationApi::class)
  override fun onCreate() {
    // Rounds the stretch overscroll to whole pixels so text doesn't shift sideways while overscrolling.
    // Must be set before any Compose code loads.
    AndroidComposeFoundationFlags.isOverscrollPixelRoundingEnabled = true
    super.onCreate()
    // The short-lived process that restarts the app after a font scale change runs nothing else.
    if (ProcessPhoenix.isPhoenixProcess(this)) return
    // Before React Native starts, so every module gets the official client's HTTP stack.
    IsocordNetwork.install(this)
    TwemojiFonts.registerReactFonts(assets)
    loadReactNative(this)
    if (BuildConfig.DISCORD_MOUNTING_FLAGS) {
      // Flags read before this keep their stable value, so they are logged.
      ReactNativeFeatureFlags.dangerouslyForceOverride(DiscordMountingFlags)?.let {
        Log.w(TAG, "Feature flags read before the override: $it")
      }
    }
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
    // The reference's PreInitReactHost thread: builds the host while the activity starts.
    CoroutineScope(Dispatchers.Default).launch { reactHost }
  }

  // Volatile as in the reference: the host prewarm reads it off the main thread.
  @Volatile private var scaledResources: Resources? = null

  /**
   * MainApplication.getResources in the reference: the application's resources carry the custom font scale, so React
   * Native (which measures text with the application context) and Dimensions' fontScale follow it.
   */
  @Suppress("DEPRECATION")
  override fun getResources(): Resources {
    val resources = super.getResources()
    if (FontScale.custom(this) == 1f) return resources
    val fontScale = FontScale.effective(this)
    scaledResources?.let {
      if (it.assets === resources.assets && it.configuration.fontScale == fontScale &&
        resources.configuration.diff(it.configuration) and ActivityInfo.CONFIG_FONT_SCALE.inv() == 0
      ) return it
    }
    val config = Configuration(resources.configuration).apply { this.fontScale = fontScale }
    return Resources(resources.assets, resources.displayMetrics, config).also { scaledResources = it }
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}

/**
 * The reference's mounting-mode experiment at mode 3 (MainApplication$reactNativeInitializationTask$1$1).
 * Every other flag keeps the stable value that loadReactNative sets.
 */
private object DiscordMountingFlags : ReactNativeNewArchitectureFeatureFlagsDefaults() {
  override fun enableAccumulatedUpdatesInRawPropsAndroid() = true

  override fun enablePropsUpdateReconciliationAndroid() = true

  // The reference's usePullModelOnAndroid is a fork flag. React Native's own pull model.
  override fun enableMountingCoordinatorPullModelAndroid() = true
}
