package me.palmdevs.isocord.expressions

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.module.annotations.ReactModule
import me.palmdevs.isocord.specs.NativeIsocordExpressionFlightSpec

/** Exposes [ExpressionFlightRegistry] to JS so pending sends bind to tapped picker tiles. */
@ReactModule(name = ExpressionFlightModule.NAME)
class ExpressionFlightModule(context: ReactApplicationContext) : NativeIsocordExpressionFlightSpec(context) {
  override fun getName(): String = NAME

  override fun bind(flightId: String, nonce: String) {
    UiThreadUtil.runOnUiThread {
      ExpressionFlightRegistry.bind(flightId, nonce, reactApplicationContext.currentActivity)
    }
  }

  companion object {
    const val NAME = "IsocordExpressionFlight"
  }
}
