package com.margelo.nitro.isocord

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.NitroModules

/** Length of the pulse where no predefined effect exists (below API 29). */
private const val PULSE_MS = 30L

/**
 * Haptic feedback (src/native/specs/IsocordHaptics.nitro.ts). Reference: HapticUtils `IMPACT_MEDIUM`
 * (react-native-haptic-feedback's `effectTick`). Departure: the heavy click through the vibrator, not the view's
 * tick. Budget motors barely play the tick, and the view's feedback also follows the touch feedback setting. Needs
 * the VIBRATE permission.
 */
@DoNotStrip
@Keep
class HybridIsocordHaptics : HybridIsocordHapticsSpec() {
  private val context: Context =
    NitroModules.applicationContext ?: error("NitroModules.applicationContext is null")

  private val vibrator: Vibrator? by lazy {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      context.getSystemService(VibratorManager::class.java)?.defaultVibrator
    } else {
      @Suppress("DEPRECATION")
      context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
    }
  }

  override fun impactMedium() {
    val vibrator = vibrator?.takeIf { it.hasVibrator() } ?: return
    when {
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ->
        vibrator.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_HEAVY_CLICK))
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ->
        vibrator.vibrate(VibrationEffect.createOneShot(PULSE_MS, VibrationEffect.DEFAULT_AMPLITUDE))
      else -> @Suppress("DEPRECATION") vibrator.vibrate(PULSE_MS)
    }
  }
}
