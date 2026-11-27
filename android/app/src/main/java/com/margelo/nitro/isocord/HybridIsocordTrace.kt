package com.margelo.nitro.isocord

import android.content.ContentValues
import android.os.Build
import android.os.Environment
import android.os.Trace
import android.provider.MediaStore
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.Promise
import java.io.File
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import me.palmdevs.isocord.core.Perf

/**
 * Lets JS mark sections in system traces (Perfetto), so startup work on the JS thread shows by name.
 * Synchronous, so a section covers exactly the work between calls. A call costs microseconds, and nothing records without a trace.
 * Also the bridge to the perf monitor ([Perf]).
 */
@DoNotStrip
@Keep
class HybridIsocordTrace : HybridIsocordTraceSpec(), LifecycleEventListener {
  private val context: ReactApplicationContext =
    NitroModules.applicationContext ?: error("NitroModules.applicationContext is null")
  private val ioScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

  init {
    context.addLifecycleEventListener(this)
  }

  override fun onHostResume() {
    context.currentActivity?.let(Perf::attach)
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
    UiThreadUtil.runOnUiThread { Perf.setRecording(enabled, context.currentActivity) }
    return System.nanoTime() / 1e6
  }

  override fun snapshot(): String = Perf.snapshot()

  /** Saves an exported trace to Downloads (the app's external files folder before Android 10); resolves where. */
  override fun saveTrace(name: String, json: String): Promise<String> =
    Promise.async(ioScope) {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        val values = ContentValues().apply {
          put(MediaStore.Downloads.DISPLAY_NAME, name)
          put(MediaStore.Downloads.MIME_TYPE, "application/json")
        }
        val resolver = context.contentResolver
        val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values) ?: error("Cannot create $name")
        try {
          resolver.openOutputStream(uri)!!.use { it.write(json.toByteArray()) }
        } catch (e: Exception) {
          resolver.delete(uri, null, null)
          throw e
        }
        "${Environment.DIRECTORY_DOWNLOADS}/$name"
      } else {
        val file = File(context.getExternalFilesDir(null), name)
        file.writeText(json)
        file.absolutePath
      }
    }

  override fun dispose() {
    context.removeLifecycleEventListener(this)
    ioScope.cancel()
    super.dispose()
  }
}
