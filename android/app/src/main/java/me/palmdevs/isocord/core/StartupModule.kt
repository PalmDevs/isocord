package me.palmdevs.isocord.core

import com.facebook.react.bridge.ReactApplicationContext
import me.palmdevs.isocord.MainActivity
import me.palmdevs.isocord.specs.NativeIsocordStartupSpec

/** Lets JS dismiss the launch splash once the real UI is on screen. */
class StartupModule(context: ReactApplicationContext) : NativeIsocordStartupSpec(context) {
  override fun getName() = NAME

  override fun hideSplash() {
    MainActivity.splashDone = true
  }

  companion object {
    const val NAME = "IsocordStartup"
  }
}
