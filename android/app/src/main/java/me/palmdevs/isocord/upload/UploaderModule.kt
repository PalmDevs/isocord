package me.palmdevs.isocord.upload

import android.net.Uri
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.module.annotations.ReactModule
import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import me.palmdevs.isocord.specs.NativeIsocordUploaderSpec

/** What JS reads from the uploader's ids, rejections and progress events. */
object UploaderWire {
  /** An upload id is `<channelId>:<n>`: JS tells a progress event's channel by the text before the separator. */
  const val ID_SEPARATOR = ":"
  const val ERROR_CANCELLED = "ECANCELLED"
  const val ERROR_FAILED = "EFAILED"
  /** A rejection `EHTTP_<status>` when the storage answered with an error status. */
  const val ERROR_HTTP_PREFIX = "EHTTP_"
  /** Progress `phase`: `done` is a percent while compressing, bytes while uploading. */
  const val PHASE_COMPRESS = "compress"
  const val PHASE_UPLOAD = "upload"
}

/**
 * Uploads picked files without their bytes reaching JS. Runs on a background dispatcher.
 * JS asks per file and gets throttled progress through `onProgress`.
 * Plain in-process work, not WorkManager or a foreground service: survives a short background stay, not a process kill.
 * The chunked resume in [UploadEngine] makes a restart cheap, but JS must start it again.
 */
@ReactModule(name = UploaderModule.NAME)
class UploaderModule(context: ReactApplicationContext) : NativeIsocordUploaderSpec(context) {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
  private val jobs = ConcurrentHashMap<String, Job>()
  private val engine = UploadEngine(context.applicationContext)
  private val prep = MediaPrep(context.applicationContext)
  /** At most this many files are sent at once; the rest wait, so a big batch does not starve each file. */
  private val uploadSlots = Semaphore(MAX_PARALLEL_UPLOADS)
  private val compressSlots = Semaphore(1)

  override fun getName() = NAME

  override fun prepare(id: String, uri: String, options: ReadableMap, promise: Promise) {
    val maxBytes = if (options.hasKey("maxBytes")) options.getDouble("maxBytes").toLong() else 0L
    val filename = if (options.hasKey("filename")) options.getString("filename") else null
    val throttle = Throttle()
    launchTracked(id, promise) {
      compressSlots.withPermit {
        val result =
          prep.prepare(Uri.parse(uri), filename, maxBytes) { percent ->
            throttle.run { emit(id, UploaderWire.PHASE_COMPRESS, percent.toDouble(), 100.0) }
          }
        promise.resolve(
          Arguments.createMap().apply {
            putString("uri", result.uri)
            putString("filename", result.filename)
            putString("mimeType", result.mimeType)
            putDouble("size", result.size.toDouble())
            putInt("width", result.width)
            putInt("height", result.height)
            putDouble("durationSecs", result.durationSecs)
            putBoolean("compressed", result.compressed)
          }
        )
      }
    }
  }

  override fun upload(id: String, uri: String, uploadUrl: String, mimeType: String, size: Double, promise: Promise) {
    val total = size.toLong()
    val throttle = Throttle()
    launchTracked(id, promise) {
      uploadSlots.withPermit {
        engine.upload(id, Uri.parse(uri), uploadUrl, mimeType, total) { done ->
          throttle.run { emit(id, UploaderWire.PHASE_UPLOAD, done.toDouble(), total.toDouble()) }
        }
        emit(id, UploaderWire.PHASE_UPLOAD, total.toDouble(), total.toDouble())
        promise.resolve(null)
      }
    }
  }

  override fun cancel(id: String) {
    jobs.remove(id)?.cancel()
    engine.cancel(id)
  }

  override fun deleteFile(uri: String) = prep.delete(uri)

  override fun invalidate() {
    scope.coroutineContext[Job]?.cancel()
    super.invalidate()
  }

  /** Runs [block] on the background dispatcher and settles the promise; a cancel rejects with ECANCELLED. */
  private fun launchTracked(id: String, promise: Promise, block: suspend () -> Unit) {
    jobs.remove(id)?.cancel()
    val job =
      scope.launch {
        try {
          block()
        } catch (e: CancellationException) {
          promise.reject(UploaderWire.ERROR_CANCELLED, "Cancelled")
        } catch (e: UploadFailedException) {
          promise.reject("${UploaderWire.ERROR_HTTP_PREFIX}${e.status}", "Upload failed with HTTP ${e.status}")
        } catch (e: Exception) {
          // The message is the exception's own text: never file contents or the upload url, but it can name a local
          // content URI or path, so JS logs only the code.
          promise.reject(UploaderWire.ERROR_FAILED, e.message ?: "Failed")
        }
      }
    jobs[id] = job
    job.invokeOnCompletion { jobs.remove(id, job) }
  }

  private fun emit(id: String, phase: String, done: Double, total: Double) {
    emitOnProgress(
      Arguments.createMap().apply {
        putString("id", id)
        putString("phase", phase)
        putDouble("done", done)
        putDouble("total", total)
      }
    )
  }

  /** Lets an action through at most every [PROGRESS_INTERVAL_MS]. */
  private class Throttle {
    private var last = 0L

    inline fun run(action: () -> Unit) {
      val now = System.nanoTime() / 1_000_000
      if (now - last < PROGRESS_INTERVAL_MS) return
      last = now
      action()
    }
  }

  companion object {
    const val NAME = "IsocordUploader"
    private const val MAX_PARALLEL_UPLOADS = 3
    private const val PROGRESS_INTERVAL_MS = 100L
  }
}
