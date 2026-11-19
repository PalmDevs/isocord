package me.palmdevs.isocord.core

import android.content.Context
import android.content.res.Configuration
import android.content.res.Resources
import com.facebook.react.bridge.ReactApplicationContext
import com.jakewharton.processphoenix.ProcessPhoenix
import me.palmdevs.isocord.specs.NativeIsocordFontScaleSpec

/**
 * The app's own font scale, applied on top of the system one (pf.a in the reference). Everything sizes text in sp,
 * so overriding the configuration's fontScale scales React Native text and the Compose chat together.
 */
object FontScale {
  private const val PREFS = "font_scale"
  private const val KEY = "FONT_SCALE_KEY"

  // Read once: changing the scale restarts the process.
  @Volatile private var custom: Float? = null

  /** The scale picked in settings, 1 by default. */
  fun custom(context: Context): Float =
    custom ?: context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getFloat(KEY, 1f).also { custom = it }

  /** The system font scale times the custom one (pf.a.c). */
  fun effective(context: Context): Float = Resources.getSystem().configuration.fontScale * custom(context)

  /** [base] with the custom scale applied, for an activity's attachBaseContext. */
  fun wrap(base: Context): Context {
    if (custom(base) == 1f) return base
    val config = Configuration(base.resources.configuration)
    config.fontScale = effective(base)
    return base.createConfigurationContext(config)
  }

  internal fun save(context: Context, scale: Float) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putFloat(KEY, scale).commit()
  }
}

/** The reference's FontModule: JS reads the saved scale and saves a new one, which restarts the app. */
class FontScaleModule(context: ReactApplicationContext) : NativeIsocordFontScaleSpec(context) {
  override fun getName() = NAME

  override fun getCustomFontScale(): Double = FontScale.custom(reactApplicationContext).toDouble()

  // FontModule.setCustomFontScale: persist, then restart so every cached metric picks up the new scale.
  override fun setCustomFontScale(scale: Double) {
    FontScale.save(reactApplicationContext, scale.toFloat())
    ProcessPhoenix.triggerRebirth(reactApplicationContext)
  }

  companion object {
    const val NAME = "IsocordFontScale"
  }
}
