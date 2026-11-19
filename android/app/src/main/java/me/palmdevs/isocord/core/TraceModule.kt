package me.palmdevs.isocord.core

import android.content.ContentValues
import android.os.Build
import android.os.Environment
import android.os.Trace
import android.provider.MediaStore
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil
import java.io.File
import me.palmdevs.isocord.specs.NativeIsocordTraceSpec

/**
 * Lets JS mark sections in system traces (Perfetto), so startup work on the JS thread shows by name.
 * Synchronous, so a section covers exactly the work between calls. A call costs microseconds, and nothing records without a trace.
 * Also the bridge to the perf monitor ([Perf]).
 */
class TraceModule(context: ReactApplicationContext) :
  NativeIsocordTraceSpec(context), LifecycleEventListener {
  init {
    context.addLifecycleEventListener(this)
  }

  override fun getName() = NAME

  override fun onHostResume() {
    reactApplicationContext.currentActivity?.let(Perf::attach)
  }

  override fun onHostPause() = Unit

  /** Lets go of the destroyed activity's window; the next resume attaches again. */
  override fun onHostDestroy() = Perf.detach()

  override fun beginSection(name: String): Boolean {
    Trace.beginSection(name.take(127))
    return true
  }

  override fun endSection(): Boolean {
    Trace.endSection()
    return true
  }

  /** Starts or stops [Perf]; returns the native clock in ms, so JS can put native spans on its own timeline. */
  override fun setRecording(enabled: Boolean): Double {
    UiThreadUtil.runOnUiThread { Perf.setRecording(enabled, reactApplicationContext.currentActivity) }
    return System.nanoTime() / 1e6
  }

  override fun snapshot(): String = Perf.snapshot()

  /** Saves an exported trace to Downloads (the app's external files folder before Android 10); resolves where. */
  override fun saveTrace(name: String, json: String, promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        val values = ContentValues().apply {
          put(MediaStore.Downloads.DISPLAY_NAME, name)
          put(MediaStore.Downloads.MIME_TYPE, "application/json")
        }
        val resolver = reactApplicationContext.contentResolver
        val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values) ?: error("Cannot create $name")
        try {
          resolver.openOutputStream(uri)!!.use { it.write(json.toByteArray()) }
        } catch (e: Exception) {
          resolver.delete(uri, null, null)
          throw e
        }
        promise.resolve("${Environment.DIRECTORY_DOWNLOADS}/$name")
      } else {
        val file = File(reactApplicationContext.getExternalFilesDir(null), name)
        file.writeText(json)
        promise.resolve(file.absolutePath)
      }
    } catch (e: Exception) {
      promise.reject("save_failed", e)
    }
  }

  companion object {
    const val NAME = "IsocordTrace"
  }
}
