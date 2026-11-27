package com.margelo.nitro.isocord

import android.graphics.Rect
import android.util.Log
import android.view.View
import androidx.activity.BackEventCompat
import androidx.activity.OnBackPressedCallback
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.uimanager.IllegalViewOperationException
import com.facebook.react.uimanager.PixelUtil
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.views.scroll.ReactScrollView
import com.margelo.nitro.NitroModules
import java.util.concurrent.CopyOnWriteArrayList
import me.palmdevs.isocord.MainActivity

/** AndroidX Back progress for panels managed by JS. */
@DoNotStrip
@Keep
class HybridIsocordBack : HybridIsocordBackSpec(), LifecycleEventListener {
  private val context: ReactApplicationContext =
    NitroModules.applicationContext ?: error("NitroModules.applicationContext is null")
  private val owners = linkedMapOf<String, Boolean>()
  private val listeners = CopyOnWriteArrayList<(BackPreviewFrame) -> Unit>()
  private var activity: MainActivity? = null
  private var gestureOwner: String? = null
  private var startX = 0f
  private var fromRight = false
  private val scrollPreviewLayout = View.OnLayoutChangeListener { view, _, _, _, _, _, _, _, _ ->
    extendScrollClip(view)
  }
  private val scrollPreviewAttachment = object : View.OnAttachStateChangeListener {
    override fun onViewAttachedToWindow(view: View) = Unit

    override fun onViewDetachedFromWindow(view: View) {
      updateScrollOverflow(view as ReactScrollView, false)
    }
  }
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

  override fun watch(owner: String, enabled: Boolean, overlay: Boolean) {
    UiThreadUtil.runOnUiThread {
      if (enabled) owners[owner] = overlay else owners.remove(owner)
      if (gestureOwner == owner && !enabled) finish()
      syncCallback()
    }
  }

  override fun setSheetScrollOverflow(reactTag: Double, visible: Boolean) {
    UiThreadUtil.runOnUiThread {
      val tag = reactTag.toInt()
      val manager = UIManagerHelper.getUIManagerForReactTag(context, tag)
      try {
        val view = manager?.resolveView(tag) as? ReactScrollView ?: return@runOnUiThread
        if (visible && !view.isAttachedToWindow) return@runOnUiThread
        updateScrollOverflow(view, visible)
      } catch (error: IllegalViewOperationException) {
        Log.d(LOG_TAG, "Sheet scroll view detached during Back preview", error)
      }
    }
  }

  override fun onBackPreview(listener: (frame: BackPreviewFrame) -> Unit): () -> Unit {
    listeners.add(listener)
    return { listeners.remove(listener) }
  }

  private fun updateScrollOverflow(view: ReactScrollView, visible: Boolean) {
    view.removeOnAttachStateChangeListener(scrollPreviewAttachment)
    view.removeOnLayoutChangeListener(scrollPreviewLayout)
    if (visible) {
      extendScrollClip(view)
      view.addOnAttachStateChangeListener(scrollPreviewAttachment)
      view.addOnLayoutChangeListener(scrollPreviewLayout)
    } else {
      view.clipBounds = null
    }
    // Drawing overflow only. Yoga keeps the scroll layout.
    view.setOverflow(if (visible) "visible" else "scroll")
  }

  private fun extendScrollClip(view: View) {
    // Fixed header and side boundaries. The outer sheet clips the lower edge.
    view.clipBounds = Rect(0, 0, view.width, view.height + view.rootView.height)
  }

  private fun syncCallback() {
    val next = (context.currentActivity as? MainActivity).takeIf { owners.isNotEmpty() }
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
    val frame = BackPreviewFrame(owner, PixelUtil.toDIPFromPixel(offset).toDouble(), finished, committed)
    for (listener in listeners) listener(frame)
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

  override fun dispose() {
    context.removeLifecycleEventListener(this)
    listeners.clear()
    UiThreadUtil.runOnUiThread {
      owners.clear()
      gestureOwner = null
      onHostDestroy()
    }
    super.dispose()
  }

  companion object {
    private const val LOG_TAG = "IsocordBack"
  }
}
