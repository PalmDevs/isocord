package com.margelo.nitro.isocord

import android.net.Uri
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.Promise
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import me.palmdevs.isocord.upload.MediaPrep
import me.palmdevs.isocord.upload.UploadEngine
import me.palmdevs.isocord.upload.UploadFailedException

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
@DoNotStrip
@Keep
class HybridIsocordUploader : HybridIsocordUploaderSpec() {
  private val appContext =
    (NitroModules.applicationContext ?: error("NitroModules.applicationContext is null")).applicationContext
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
  private val jobs = ConcurrentHashMap<String, Job>()
  private val engine = UploadEngine(appContext)
  private val prep = MediaPrep(appContext)
  private val listeners = CopyOnWriteArrayList<(ProgressEvent) -> Unit>()
  /** At most this many files are sent at once; the rest wait, so a big batch does not starve each file. */
  private val uploadSlots = Semaphore(MAX_PARALLEL_UPLOADS)
  private val compressSlots = Semaphore(1)

  override fun prepare(id: String, uri: String, options: PrepareOptions): Promise<PreparedFile> {
    val maxBytes = options.maxBytes.toLong()
    val filename = options.filename
    val throttle = Throttle()
    return launchTracked(id) {
      compressSlots.withPermit {
        val result =
          prep.prepare(Uri.parse(uri), filename, maxBytes) { percent ->
            throttle.run { emit(id, UploaderWire.PHASE_COMPRESS, percent.toDouble(), 100.0) }
          }
        PreparedFile(
          uri = result.uri,
          filename = result.filename,
          mimeType = result.mimeType,
          size = result.size.toDouble(),
          width = result.width.toDouble(),
          height = result.height.toDouble(),
          durationSecs = result.durationSecs,
          compressed = result.compressed,
        )
      }
    }
  }

  override fun upload(id: String, uri: String, uploadUrl: String, mimeType: String, size: Double): Promise<Unit> {
    val total = size.toLong()
    val throttle = Throttle()
    return launchTracked(id) {
      uploadSlots.withPermit {
        engine.upload(id, Uri.parse(uri), uploadUrl, mimeType, total) { done ->
          throttle.run { emit(id, UploaderWire.PHASE_UPLOAD, done.toDouble(), total.toDouble()) }
        }
        emit(id, UploaderWire.PHASE_UPLOAD, total.toDouble(), total.toDouble())
      }
    }
  }

  override fun cancel(id: String) {
    jobs.remove(id)?.cancel()
    engine.cancel(id)
  }

  override fun deleteFile(uri: String) = prep.delete(uri)

  override fun onProgress(listener: (event: ProgressEvent) -> Unit): () -> Unit {
    listeners.add(listener)
    return { listeners.remove(listener) }
  }

  override fun dispose() {
    listeners.clear()
    scope.cancel()
    super.dispose()
  }

  /** Runs [block] on the background dispatcher and settles the promise; errors map to [UploaderWire] codes. */
  private fun <T> launchTracked(id: String, block: suspend () -> T): Promise<T> {
    val promise = Promise<T>()
    jobs.remove(id)?.cancel()
    val job =
      scope.launch {
        try {
          promise.resolve(block())
        } catch (_: CancellationException) {
          promise.reject(Error(UploaderWire.ERROR_CANCELLED))
        } catch (e: UploadFailedException) {
          promise.reject(Error("${UploaderWire.ERROR_HTTP_PREFIX}${e.status}"))
        } catch (_: Exception) {
          // Never expose local content URIs or paths in the error text.
          promise.reject(Error(UploaderWire.ERROR_FAILED))
        }
      }
    jobs[id] = job
    job.invokeOnCompletion { jobs.remove(id, job) }
    return promise
  }

  private fun emit(id: String, phase: String, done: Double, total: Double) {
    val event = ProgressEvent(id, phase, done, total)
    for (listener in listeners) listener(event)
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
    private const val MAX_PARALLEL_UPLOADS = 3
    private const val PROGRESS_INTERVAL_MS = 100L
  }
}
