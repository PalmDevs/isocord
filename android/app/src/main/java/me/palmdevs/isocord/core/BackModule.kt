package me.palmdevs.isocord.core

import androidx.activity.BackEventCompat
import androidx.activity.OnBackPressedCallback
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.PixelUtil
import me.palmdevs.isocord.MainActivity
import me.palmdevs.isocord.specs.NativeIsocordBackSpec

/** AndroidX Back progress for panels managed by JS. */
@ReactModule(name = BackModule.NAME)
class BackModule(context: ReactApplicationContext) : NativeIsocordBackSpec(context), LifecycleEventListener {
  private val owners = linkedMapOf<String, Boolean>()
  private var activity: MainActivity? = null
  private var gestureOwner: String? = null
  private var startX = 0f
  private var fromRight = false
  private val callback = object : OnBackPressedCallback(false) {
    override fun handleOnBackStarted(backEvent: BackEventCompat) {
      gestureOwner = owners.entries.lastOrNull { it.value }?.key ?: owners.keys.lastOrNull()
      startX = backEvent.touchX
      fromRight = backEvent.swipeEdge == BackEventCompat.EDGE_RIGHT
      emitFrame(0f, false)
    }

    override fun handleOnBackProgressed(backEvent: BackEventCompat) {
      val delta = backEvent.touchX - startX
      emitFrame(if (fromRight) delta.coerceAtMost(0f) else delta.coerceAtLeast(0f), false)
    }

    override fun handleOnBackCancelled() = finish()

    @Suppress("DEPRECATION")
    override fun handleOnBackPressed() {
      if (gestureOwner != null) {
        finish(committed = true)
        return
      }
      // ReactActivity: hardware Back without a gesture preview.
      isEnabled = false
      try {
        activity?.onBackPressed()
      } finally {
        isEnabled = owners.isNotEmpty()
      }
    }
  }

  init {
    context.addLifecycleEventListener(this)
  }

  override fun getName() = NAME

  override fun watch(owner: String, enabled: Boolean, overlay: Boolean) {
    UiThreadUtil.runOnUiThread {
      if (enabled) owners[owner] = overlay else owners.remove(owner)
      if (gestureOwner == owner && !enabled) finish()
      syncCallback()
    }
  }

  private fun syncCallback() {
    val next = (reactApplicationContext.currentActivity as? MainActivity).takeIf { owners.isNotEmpty() }
    if (next === activity) return
    onHostDestroy()
    activity = next
    if (next != null) {
      callback.isEnabled = true
      next.panelBackCallback = callback
      next.onBackPressedDispatcher.addCallback(next, callback)
    }
  }

  private fun emitFrame(offset: Float, finished: Boolean, committed: Boolean = false) {
    val owner = gestureOwner ?: return
    emitOnBackPreview(Arguments.createMap().apply {
      putString("owner", owner)
      putDouble("offset", PixelUtil.toDIPFromPixel(offset).toDouble())
      putBoolean("finished", finished)
      putBoolean("committed", committed)
    })
  }

  private fun finish(committed: Boolean = false) {
    emitFrame(0f, true, committed)
    gestureOwner = null
  }

  override fun onHostResume() = syncCallback()
  override fun onHostPause() = finish()
  override fun onHostDestroy() {
    if (activity?.panelBackCallback === callback) activity?.panelBackCallback = null
    callback.isEnabled = false
    callback.remove()
    activity = null
  }

  override fun invalidate() {
    reactApplicationContext.removeLifecycleEventListener(this)
    UiThreadUtil.runOnUiThread {
      owners.clear()
      gestureOwner = null
      onHostDestroy()
    }
    super.invalidate()
  }

  companion object {
    const val NAME = "IsocordBack"
  }
}
