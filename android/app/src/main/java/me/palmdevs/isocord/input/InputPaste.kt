package me.palmdevs.isocord.input

import android.content.ClipData
import android.graphics.BitmapFactory
import android.util.Log
import android.view.View
import android.webkit.MimeTypeMap
import androidx.core.view.ContentInfoCompat
import java.io.File
import java.io.IOException
import kotlin.math.max
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

private const val TAG = "IsocordChatInput"

/** Copies pasted images off the main thread. */
private val pasteScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

/** Copies the pasted images into the cache and reports each one, on the main thread. */
internal fun reportPastedImages(
view: View,
content: ContentInfoCompat,
onImage: (url: String, width: Int, height: Int, type: String) -> Unit,
) {
  // The grant on a keyboard's content URI may not outlive this call, so the images are copied into the cache.
  // The read grant belongs to the keyboard's InputContentInfo inside `content` and is released when that object
  // is collected, so the thread holds on to `content` until the copies are done.
  pasteScope.launch {
    val clip: ClipData = content.clip
    val uris = (0 until clip.itemCount).mapNotNull { clip.getItemAt(it).uri }
    val directory = File(view.context.cacheDir, "chat_input").apply { mkdirs() }
    directory.listFiles()?.filter { System.currentTimeMillis() - it.lastModified() > 24 * 3600 * 1000L }?.forEach { it.delete() }
    uris.forEachIndexed { index, uri ->
      try {
        val type = view.context.contentResolver.getType(uri) ?: "image/*"
        val extension = MimeTypeMap.getSingleton().getExtensionFromMimeType(type) ?: "bin"
        val file = File(directory, "${System.currentTimeMillis()}-$index.$extension")
        view.context.contentResolver.openInputStream(uri)?.use { input -> file.outputStream().use { input.copyTo(it) } }
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(file.path, bounds)
        // Events go out on the main thread, like every other event of this view.
        view.post { onImage("file://${file.path}", max(bounds.outWidth, 0), max(bounds.outHeight, 0), type) }
      } catch (e: IOException) {
        // An unreadable image is dropped, as the clipboard may have changed under us.
        Log.w(TAG, "pasted image dropped: ${e.javaClass.simpleName}")
      } catch (e: SecurityException) {
        Log.w(TAG, "pasted image dropped: ${e.javaClass.simpleName}")
      }
    }
  }
}
