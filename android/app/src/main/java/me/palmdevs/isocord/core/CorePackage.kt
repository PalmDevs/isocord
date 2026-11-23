package me.palmdevs.isocord.core

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import me.palmdevs.isocord.compression.CompressionModule
import me.palmdevs.isocord.network.NetworkModule
import me.palmdevs.isocord.share.ShareModule

/** The small app-wide TurboModules: startup, font scale, tracing, the cookie jars and shared content. */
class CorePackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    when (name) {
      StartupModule.NAME -> StartupModule(reactContext)
      FontScaleModule.NAME -> FontScaleModule(reactContext)
      TraceModule.NAME -> TraceModule(reactContext)
      NetworkModule.NAME -> NetworkModule(reactContext)
      CompressionModule.NAME -> CompressionModule(reactContext)
      ShareModule.NAME -> ShareModule(reactContext)
      BackModule.NAME -> BackModule(reactContext)
      else -> null
    }

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    mapOf(
      StartupModule::class.java to StartupModule.NAME,
      FontScaleModule::class.java to FontScaleModule.NAME,
      TraceModule::class.java to TraceModule.NAME,
      NetworkModule::class.java to NetworkModule.NAME,
      CompressionModule::class.java to CompressionModule.NAME,
      ShareModule::class.java to ShareModule.NAME,
      BackModule::class.java to BackModule.NAME,
    ).entries.associate { (type, name) ->
      name to
        ReactModuleInfo(
          name,
          type.name,
          false, // canOverrideExistingModule
          false, // needsEagerInit
          false, // isCxxModule
          true, // isTurboModule
        )
    }
  }
}
