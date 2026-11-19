package me.palmdevs.isocord.upload

import android.content.ContentResolver
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageDecoder
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import android.util.Log
import android.webkit.MimeTypeMap
import androidx.annotation.OptIn
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.Presentation
import androidx.media3.transformer.Composition
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.ProgressHolder
import androidx.media3.transformer.Transformer
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.util.UUID
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext

private const val TAG = "IsocordMediaPrep"

/** Returns the name a content uri shows (OpenableColumns.DISPLAY_NAME), or null when it has none. */
fun displayName(resolver: ContentResolver, uri: Uri): String? =
  resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
    val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
    if (cursor.moveToFirst() && index >= 0) cursor.getString(index) else null
  }

class Prepared(
  val uri: String,
  val filename: String,
  val mimeType: String,
  val size: Long,
  val width: Int,
  val height: Int,
  val durationSecs: Double,
  val compressed: Boolean,
)

/**
 * Reads a picked file's metadata and shrinks it when the upload needs it.
 * The reference's native compressor is not in the datamine. Its JS shows HEIC to JPEG at quality 80
 * (lib/uploader/imageConversion.tsx) and compression only over the user's limit (UploaderBase.tsx compressAndCheckFileSize).
 */
class MediaPrep(private val context: Context) {
  private val cacheDir = File(context.cacheDir, CACHE_DIR).apply { mkdirs() }

  fun owns(uri: String): Boolean {
    val path = Uri.parse(uri).takeIf { it.scheme == "file" }?.path ?: return false
    return File(path).canonicalFile.parentFile == cacheDir.canonicalFile
  }

  suspend fun prepare(
    uri: Uri,
    filenameHint: String?,
    maxBytes: Long,
    onProgress: (Int) -> Unit,
  ): Prepared {
    val meta = stat(uri)
    val name = filenameHint?.takeIf { it.isNotBlank() } ?: meta.name
    val mime = meta.mime ?: guessMime(name)
    val isHeic = mime == "image/heic" || mime == "image/heif"
    val oversized = maxBytes > 0 && meta.size > maxBytes

    if (mime.startsWith("image/") && mime != "image/gif" && mime != "image/svg+xml" &&
      (isHeic || oversized)
    ) {
      withContext(Dispatchers.IO) { reencodeImage(uri, name, meta.size, maxBytes, isHeic) }?.let { return it }
    }
    if (mime.startsWith("video/") && oversized) {
      compressVideo(uri, name, maxBytes, onProgress)?.let { return it }
    }

    val dims = dimensions(uri, mime)
    return Prepared(uri.toString(), name, mime, meta.size, dims.first, dims.second, dims.third, false)
  }

  fun delete(uri: String) {
    if (!owns(uri)) return
    Uri.parse(uri).path?.let { File(it).delete() }
  }

  private class Meta(val name: String, val size: Long, val mime: String?)

  private fun stat(uri: Uri): Meta {
    if (uri.scheme == "file") {
      val file = File(uri.path ?: "")
      return Meta(file.name, file.length(), null)
    }
    val name = displayName(context.contentResolver, uri) ?: "file"
    var size = -1L
    context.contentResolver.query(uri, arrayOf(OpenableColumns.SIZE), null, null, null)?.use { cursor ->
      if (cursor.moveToFirst()) {
        val sizeIdx = cursor.getColumnIndex(OpenableColumns.SIZE)
        if (sizeIdx >= 0 && !cursor.isNull(sizeIdx)) size = cursor.getLong(sizeIdx)
      }
    }
    if (size < 0) {
      size = context.contentResolver.openAssetFileDescriptor(uri, "r")?.use { it.length } ?: 0L
    }
    return Meta(name, size, context.contentResolver.getType(uri))
  }

  private fun guessMime(name: String): String {
    val ext = name.substringAfterLast('.', "").lowercase()
    return MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext) ?: "application/octet-stream"
  }

  /** Width, height and duration in seconds; zeros for anything that is not media. */
  private fun dimensions(uri: Uri, mime: String): Triple<Int, Int, Double> {
    try {
      if (mime.startsWith("image/")) {
        val opts = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, opts) }
        return Triple(maxOf(opts.outWidth, 0), maxOf(opts.outHeight, 0), 0.0)
      }
      if (mime.startsWith("video/") || mime.startsWith("audio/")) {
        val retriever = MediaMetadataRetriever()
        try {
          retriever.setDataSource(context, uri)
          fun field(key: Int) = retriever.extractMetadata(key)?.toDoubleOrNull() ?: 0.0
          val rotated = field(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION).toInt() % 180 != 0
          val w = field(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH).toInt()
          val h = field(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT).toInt()
          val secs = field(MediaMetadataRetriever.METADATA_KEY_DURATION) / 1000.0
          return if (rotated) Triple(h, w, secs) else Triple(w, h, secs)
        } finally {
          retriever.release()
        }
      }
    } catch (e: IOException) {
      // Unreadable metadata is not worth failing the upload for.
      Log.w(TAG, "metadata unreadable: ${e.javaClass.simpleName}")
    } catch (e: RuntimeException) {
      Log.w(TAG, "metadata unreadable: ${e.javaClass.simpleName}")
    }
    return Triple(0, 0, 0.0)
  }

  private suspend fun reencodeImage(
    uri: Uri,
    name: String,
    originalSize: Long,
    maxBytes: Long,
    heic: Boolean,
  ): Prepared? {
    val scales = if (maxBytes > 0 && originalSize > maxBytes) floatArrayOf(1f, 0.75f, 0.5f, 0.35f, 0.25f) else floatArrayOf(1f)
    var out: File? = null
    for (scale in scales) {
      kotlinx.coroutines.currentCoroutineContext().ensureActive()
      val bitmap = decode(uri, scale) ?: return null
      val alpha = bitmap.hasAlpha()
      val format =
        if (alpha) (if (Build.VERSION.SDK_INT >= 30) Bitmap.CompressFormat.WEBP_LOSSY else Bitmap.CompressFormat.WEBP)
        else Bitmap.CompressFormat.JPEG
      val ext = if (alpha) "webp" else "jpg"
      val file = File(cacheDir, "${UUID.randomUUID()}.$ext")
      try {
        FileOutputStream(file).use { bitmap.compress(format, 80, it) }
      } finally {
        bitmap.recycle()
      }
      out?.delete()
      out = file
      if (maxBytes <= 0 || file.length() <= maxBytes) break
    }
    val file = out ?: return null
    // Keep the original only when re-encoding a non-HEIC image made it bigger than before.
    if (!heic && file.length() >= originalSize) {
      file.delete()
      return null
    }
    val opts = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(file.path, opts)
    val ext = file.extension
    val mime = if (ext == "webp") "image/webp" else "image/jpeg"
    return Prepared(
      Uri.fromFile(file).toString(),
      name.substringBeforeLast('.', name) + "." + ext,
      mime,
      file.length(),
      maxOf(opts.outWidth, 0),
      maxOf(opts.outHeight, 0),
      0.0,
      true,
    )
  }

  private fun decode(uri: Uri, scale: Float): Bitmap? =
    try {
      if (Build.VERSION.SDK_INT >= 28) {
        val source = ImageDecoder.createSource(context.contentResolver, uri)
        ImageDecoder.decodeBitmap(source) { decoder, info, _ ->
          // Software allocation: hardware bitmaps cannot be compressed.
          decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
          if (scale < 1f) decoder.setTargetSize(
            maxOf(1, (info.size.width * scale).toInt()),
            maxOf(1, (info.size.height * scale).toInt()),
          )
        }
      } else {
        val opts = BitmapFactory.Options().apply { inSampleSize = if (scale >= 1f) 1 else Integer.highestOneBit((1f / scale).toInt().coerceAtLeast(1)) }
        context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, opts) }
      }
    } catch (e: IOException) {
      Log.w(TAG, "decode failed: ${e.javaClass.simpleName}")
      null
    } catch (e: OutOfMemoryError) {
      Log.w(TAG, "decode ran out of memory")
      null
    }

  /** Tries 720p, then 480p and 360p, until the result fits [maxBytes]. */
  @OptIn(UnstableApi::class)
  private suspend fun compressVideo(
    uri: Uri,
    name: String,
    maxBytes: Long,
    onProgress: (Int) -> Unit,
  ): Prepared? {
    var best: File? = null
    for (height in intArrayOf(720, 480, 360)) {
      val file = File(cacheDir, "${UUID.randomUUID()}.mp4")
      try {
        export(uri, file, height, onProgress)
      } catch (e: CancellationException) {
        file.delete()
        best?.delete()
        throw e
      } catch (e: Exception) {
        Log.w(TAG, "export at ${height}p failed: ${e.javaClass.simpleName}")
        file.delete()
        break
      }
      best?.delete()
      best = file
      if (file.length() <= maxBytes) break
    }
    val file = best ?: return null
    val dims = dimensions(Uri.fromFile(file), "video/mp4")
    return Prepared(
      Uri.fromFile(file).toString(),
      name.substringBeforeLast('.', name) + ".mp4",
      "video/mp4",
      file.length(),
      dims.first,
      dims.second,
      dims.third,
      true,
    )
  }

  /** Transformer must be built, started and polled from one looper thread: the main thread. */
  @OptIn(UnstableApi::class)
  private suspend fun export(uri: Uri, out: File, height: Int, onProgress: (Int) -> Unit) =
    withContext(Dispatchers.Main) {
      coroutineScope {
        var transformer: Transformer? = null
        var poller: Job? = null
        try {
          suspendCancellableCoroutine<Unit> { cont ->
            val t =
              Transformer.Builder(context)
                .setVideoMimeType(MimeTypes.VIDEO_H264)
                .setAudioMimeType(MimeTypes.AUDIO_AAC)
                .addListener(
                  object : Transformer.Listener {
                    override fun onCompleted(composition: Composition, exportResult: ExportResult) {
                      if (cont.isActive) cont.resume(Unit)
                    }

                    override fun onError(composition: Composition, exportResult: ExportResult, exportException: ExportException) {
                      if (cont.isActive) cont.resumeWithException(exportException)
                    }
                  }
                )
                .build()
            transformer = t
            val item =
              EditedMediaItem.Builder(MediaItem.fromUri(uri))
                .setEffects(Effects(emptyList(), listOf(Presentation.createForHeight(height))))
                .build()
            t.start(item, out.path)
            val holder = ProgressHolder()
            poller = launch {
              while (true) {
                delay(PROGRESS_POLL_MS)
                if (t.getProgress(holder) != Transformer.PROGRESS_STATE_NOT_STARTED) onProgress(holder.progress)
              }
            }
          }
        } catch (e: CancellationException) {
          transformer?.cancel()
          throw e
        } finally {
          poller?.cancel()
        }
      }
    }

  companion object {
    private const val CACHE_DIR = "uploads"
    private const val PROGRESS_POLL_MS = 250L
  }
}
