package com.margelo.nitro.isocord

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.bridge.UiThreadUtil
import com.margelo.nitro.NitroModules
import me.palmdevs.isocord.expressions.ExpressionFlightRegistry

/** Exposes [ExpressionFlightRegistry] to JS so pending sends bind to tapped picker tiles. */
@DoNotStrip
@Keep
class HybridIsocordExpressionFlight : HybridIsocordExpressionFlightSpec() {
  override fun bind(flightId: String, nonce: String) {
    UiThreadUtil.runOnUiThread {
      ExpressionFlightRegistry.bind(flightId, nonce, NitroModules.applicationContext?.currentActivity)
    }
  }
}
