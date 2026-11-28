package me.palmdevs.isocord.voice.stream

import android.content.Context
import android.graphics.Point
import android.hardware.display.DisplayManager
import android.os.Handler
import android.os.Looper
import android.view.Display

/** The default display as screen capture sees it: its real size in the current rotation, and whether it is on. */
data class ScreenState(val width: Int, val height: Int, val on: Boolean)

/**
 * Watches the default display while we stream. [onChange] gets each new [ScreenState] on the main thread:
 * a rotation or resize, the screen going off or on. Other display changes, such as brightness, are dropped.
 */
class ScreenWatcher(context: Context, private val onChange: (ScreenState) -> Unit) {
  private val displays = context.getSystemService(DisplayManager::class.java)
  @Volatile private var last: ScreenState? = null

  private val listener = object : DisplayManager.DisplayListener {
    override fun onDisplayChanged(displayId: Int) {
      if (displayId != Display.DEFAULT_DISPLAY) return
      val state = current()
      if (state == last) return
      last = state
      onChange(state)
    }

    override fun onDisplayAdded(displayId: Int) = Unit

    override fun onDisplayRemoved(displayId: Int) = Unit
  }

  /** Reads the display now. Any thread. */
  fun current(): ScreenState {
    val display = displays.getDisplay(Display.DEFAULT_DISPLAY)
    val size = Point()
    // The replacement, WindowManager metrics, needs a visual context. The engine has the application's.
    @Suppress("DEPRECATION")
    display.getRealSize(size)
    return ScreenState(size.x, size.y, display.state == Display.STATE_ON)
  }

  /** Starts watching. DisplayManager calls back on a Looper, and the engine's dispatcher has none. */
  fun start() {
    last = current()
    displays.registerDisplayListener(listener, Handler(Looper.getMainLooper()))
  }

  fun stop() = displays.unregisterDisplayListener(listener)
}
