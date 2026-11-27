package com.margelo.nitro.isocord

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.bridge.ReactApplicationContext
import com.jakewharton.processphoenix.ProcessPhoenix
import com.margelo.nitro.NitroModules
import me.palmdevs.isocord.core.FontScale

/** The reference's FontModule: JS reads the saved scale and saves a new one, which restarts the app. */
@DoNotStrip
@Keep
class HybridIsocordFontScale : HybridIsocordFontScaleSpec() {
  private val context: ReactApplicationContext
    get() = NitroModules.applicationContext ?: error("NitroModules.applicationContext is null")

  override fun getCustomFontScale(): Double = FontScale.custom(context).toDouble()

  // FontModule.setCustomFontScale: persist, then restart so every cached metric picks up the new scale.
  override fun setCustomFontScale(scale: Double) {
    val appContext = context
    FontScale.save(appContext, scale.toFloat())
    ProcessPhoenix.triggerRebirth(appContext)
  }
}
