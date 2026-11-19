package me.palmdevs.isocord.share

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import me.palmdevs.isocord.specs.NativeIsocordShareSpec

/** Hands JS what other apps share to Isocord (src/native/NativeIsocordShare.ts). */
@ReactModule(name = ShareModule.NAME)
class ShareModule(context: ReactApplicationContext) : NativeIsocordShareSpec(context) {
  private val listener = { emitOnShared() }

  init {
    SharedContentInbox.onReceived = listener
  }

  override fun getName() = NAME

  override fun takeShared(promise: Promise) = promise.resolve(SharedContentInbox.take())

  override fun invalidate() {
    if (SharedContentInbox.onReceived === listener) SharedContentInbox.onReceived = null
    super.invalidate()
  }

  companion object {
    const val NAME = "IsocordShare"
  }
}
