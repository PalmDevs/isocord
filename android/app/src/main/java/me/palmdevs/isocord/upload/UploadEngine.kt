package me.palmdevs.isocord.upload

import android.content.Context
import android.net.Uri
import com.facebook.react.modules.network.OkHttpClientProvider
import java.io.FileInputStream
import java.io.IOException
import java.io.InputStream
import java.util.concurrent.TimeUnit
import kotlin.coroutines.coroutineContext
import kotlin.math.min
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive
import okhttp3.Call
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okio.BufferedSink

/** A response the upload cannot recover from (a 4xx other than 408 and 429). */
class UploadFailedException(val status: Int) : IOException("Upload failed with HTTP $status")

/**
 * Sends one file to a signed Google Cloud Storage resumable upload url (lib/uploader/CloudUpload.tsx).
 * One PUT of the whole file. After an interruption, a status check (`Content-Range` of "bytes star/total")
 * learns what the server has: 308 with `Range: bytes=0-N`, or 200/201 when complete.
 * Then PUTs the rest with `Content-Range: bytes start-end/total`.
 */
class UploadEngine(private val context: Context) {
  // React Native's client (IsocordNetwork), as the reference uploads through XHR.
  private val client =
    OkHttpClientProvider.getOkHttpClient().newBuilder()
      .connectTimeout(30, TimeUnit.SECONDS)
      .readTimeout(60, TimeUnit.SECONDS)
      .writeTimeout(60, TimeUnit.SECONDS)
      .callTimeout(0, TimeUnit.SECONDS)
      .retryOnConnectionFailure(true)
      .build()

  /** Calls in flight per upload id, so cancel() can interrupt a blocked socket. */
  private val calls = java.util.concurrent.ConcurrentHashMap<String, Call>()

  fun cancel(id: String) {
    calls.remove(id)?.cancel()
  }

  suspend fun upload(
    id: String,
    uri: Uri,
    uploadUrl: String,
    mimeType: String,
    total: Long,
    onProgress: (Long) -> Unit,
  ) {
    val type = contentType(mimeType)
    if (total == 0L) {
      // GCS accepts an empty single request without a range.
      execute(id, Request.Builder().url(uploadUrl).put(ByteArray(0).toRequestBody(type)).build()).use {
        if (it.code !in 200..201) throw UploadFailedException(it.code)
      }
      onProgress(0)
      return
    }

    var offset = 0L
    var failures = 0
    var delayMs = INITIAL_BACKOFF_MS
    while (offset < total) {
      coroutineContext.ensureActive()
      try {
        offset = sendChunk(id, uri, uploadUrl, type, offset, total, onProgress)
        failures = 0
        delayMs = INITIAL_BACKOFF_MS
      } catch (e: CancellationException) {
        throw e
      } catch (e: UploadFailedException) {
        throw e
      } catch (e: IOException) {
        coroutineContext.ensureActive() // a cancelled call surfaces as an IOException
        if (++failures > MAX_RETRIES) throw e
        delay(delayMs)
        delayMs = min(delayMs * 2, MAX_BACKOFF_MS)
        // Ask the server how much it has committed; a failed check just means trying again.
        offset = try {
          committedOffset(id, uploadUrl, total)
        } catch (e: UploadFailedException) {
          throw e
        } catch (e: IOException) {
          offset
        }
        onProgress(offset)
      }
    }
  }

  /** Sends the file from [offset] to its end; returns the offset to continue from. */
  private fun sendChunk(
    id: String,
    uri: Uri,
    uploadUrl: String,
    type: okhttp3.MediaType?,
    offset: Long,
    total: Long,
    onProgress: (Long) -> Unit,
  ): Long {
    // One PUT of everything left; a resumed one says which part it carries.
    val length = total - offset
    val body = ChunkBody(context, uri, type, offset, length) { onProgress(offset + it) }
    val builder = Request.Builder().url(uploadUrl).put(body)
    if (offset > 0) builder.header("Content-Range", "bytes $offset-${total - 1}/$total")
    execute(id, builder.build()).use { response ->
      return when (response.code) {
        200, 201 -> total
        308 -> parseCommitted(response.header("Range"))
        else -> throwFor(response.code)
      }
    }
  }

  // The status check (Content-Range: bytes star/star): how many bytes the server holds.
  private fun committedOffset(id: String, uploadUrl: String, total: Long): Long {
    val request =
      Request.Builder()
        .url(uploadUrl)
        .header("Content-Range", "bytes */$total")
        .put(ByteArray(0).toRequestBody(null))
        .build()
    execute(id, request).use { response ->
      return when (response.code) {
        200, 201 -> total
        308 -> parseCommitted(response.header("Range"))
        else -> throwFor(response.code)
      }
    }
  }

  private fun throwFor(code: Int): Nothing {
    // 408, 429 and 5xx are worth retrying; anything else means the signed url or request is wrong.
    if (code == 408 || code == 429 || code >= 500) throw IOException("HTTP $code")
    throw UploadFailedException(code)
  }

  /** `bytes=0-N` means N+1 bytes are stored; no header means none. */
  private fun parseCommitted(range: String?): Long {
    val match = range?.let { Regex("""^bytes=(\d+)-(\d+)""").find(it) } ?: return 0
    return match.groupValues[2].toLong() + 1
  }

  private fun execute(id: String, request: Request): Response {
    val call = client.newCall(request)
    calls[id] = call
    try {
      return call.execute()
    } finally {
      // Left in place only while running; cancel() on a finished call is a no-op anyway.
      calls.remove(id, call)
    }
  }

  private fun contentType(mime: String) =
    (if (mime.isBlank() || mime == "application/json") "application/octet-stream" else mime)
      .toMediaTypeOrNull()

  /** Streams [length] bytes of the file from [offset], reporting how many have been written. */
  private class ChunkBody(
    private val context: Context,
    private val uri: Uri,
    private val type: okhttp3.MediaType?,
    private val offset: Long,
    private val length: Long,
    private val onWritten: (Long) -> Unit,
  ) : RequestBody() {
    override fun contentType() = type

    override fun contentLength() = length

    override fun writeTo(sink: BufferedSink) {
      openAt(context, uri, offset).use { input ->
        val buffer = ByteArray(BUFFER_SIZE)
        var remaining = length
        var written = 0L
        var lastReport = 0L
        while (remaining > 0) {
          val read = input.read(buffer, 0, min(buffer.size.toLong(), remaining).toInt())
          if (read < 0) throw IOException("File ended early")
          sink.write(buffer, 0, read)
          remaining -= read
          written += read
          if (written - lastReport >= PROGRESS_STEP) {
            lastReport = written
            onWritten(written)
          }
        }
        onWritten(written)
      }
    }
  }

  companion object {
    private const val BUFFER_SIZE = 64 * 1024
    private const val PROGRESS_STEP = 128 * 1024
    // The official React Native client retries 12 times, backing off from 0.5 s.
    private const val MAX_RETRIES = 12
    private const val INITIAL_BACKOFF_MS = 500L
    private const val MAX_BACKOFF_MS = 30_000L

    /** Opens the file positioned at [offset], seeking when the source allows it. */
    fun openAt(context: Context, uri: Uri, offset: Long): InputStream {
      val resolver = context.contentResolver
      if (uri.scheme == "file") {
        return FileInputStream(uri.path).also { it.channel.position(offset) }
      }
      val pfd = resolver.openFileDescriptor(uri, "r")
      if (pfd != null) {
        val stream = ParcelStream(pfd)
        try {
          stream.channel.position(offset)
          return stream
        } catch (e: IOException) {
          stream.close() // not seekable: fall back to skipping
        }
      }
      val input = resolver.openInputStream(uri) ?: throw IOException("Cannot open file")
      var left = offset
      while (left > 0) {
        val skipped = input.skip(left)
        if (skipped <= 0) {
          if (input.read() < 0) throw IOException("File ended early")
          left--
        } else left -= skipped
      }
      return input
    }
  }
}

/** A FileInputStream that also closes the ParcelFileDescriptor it came from. */
private class ParcelStream(private val pfd: android.os.ParcelFileDescriptor) :
  FileInputStream(pfd.fileDescriptor) {
  override fun close() {
    try {
      super.close()
    } finally {
      pfd.close()
    }
  }
}
