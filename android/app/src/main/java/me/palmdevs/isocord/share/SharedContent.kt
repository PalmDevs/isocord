package me.palmdevs.isocord.share

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.core.content.IntentCompat
import kotlinx.serialization.Serializable
import me.palmdevs.isocord.core.AppJson
import me.palmdevs.isocord.upload.displayName

private const val TAG = "IsocordShare"

/** A file shared to the app (ShareProps.Attachment). */
@Serializable
data class SharedFile(val uri: String, val filename: String?, val mimeType: String?)

/** What another app shared (ShareProps): its text and files. JS reads it as JSON (NativeIsocordShare.ts). */
@Serializable
data class SharedContent(val text: String, val files: List<SharedFile>)

/** Holds the last share until JS takes it, and tells the module one arrived. */
object SharedContentInbox {
  @Volatile private var pending: String? = null
  @Volatile var onReceived: (() -> Unit)? = null

  /** Keeps the content of a SEND or SEND_MULTIPLE intent. Other intents are ignored. */
  fun receive(intent: Intent?, context: Context) {
    if (intent?.action != Intent.ACTION_SEND && intent?.action != Intent.ACTION_SEND_MULTIPLE) return
    pending = AppJson.encodeToString(SharedContent.serializer(), parse(intent, context))
    onReceived?.invoke()
  }

  /** Returns the pending share as JSON once, then forgets it. */
  fun take(): String? = pending.also { pending = null }

  /**
   * ShareProps.createShareProps: EXTRA_TEXT and the EXTRA_STREAM uris with their names and types.
   * Each uri's read grant is kept for the package, as ShareActivity does, so uploads can read it later.
   */
  private fun parse(intent: Intent, context: Context): SharedContent {
    val resolver = context.contentResolver
    val files =
      streamUris(intent).mapNotNull { uri ->
        // A uri the sender gave no grant for is left out, not the whole share.
        try {
          context.grantUriPermission(context.packageName, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
          SharedFile(uri.toString(), displayName(resolver, uri), resolver.getType(uri))
        } catch (e: SecurityException) {
          Log.w(TAG, "shared file unreadable: ${e.javaClass.simpleName}")
          null
        }
      }
    return SharedContent(intent.getStringExtra(Intent.EXTRA_TEXT) ?: "", files)
  }

  /** ShareProps.getUriExtras: a list for SEND_MULTIPLE, else the single stream. */
  private fun streamUris(intent: Intent): List<Uri> =
    IntentCompat.getParcelableArrayListExtra(intent, Intent.EXTRA_STREAM, Uri::class.java)
      ?: listOfNotNull(IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri::class.java))

  /** Activities started from recents replay their old intent. */
  fun isReplay(intent: Intent?): Boolean =
    intent != null && intent.flags and Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY != 0
}
