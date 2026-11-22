package me.palmdevs.isocord.compression

import com.squareup.zstd.ZstdDecompressor
import com.squareup.zstd.getErrorName
import com.squareup.zstd.zstdDecompressor
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.nio.charset.StandardCharsets
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock
import okio.ByteString

/**
 * Decompresses a gateway zstd-stream. One instance per socket, since its frames continue each other.
 * References: CompressionModule$ZstdInflater in the official client, ZstdDecompressSource in zstd-kmp-okio.
 */
class ZstdStream : AutoCloseable {
  private val decompressor: ZstdDecompressor = zstdDecompressor()
  /** [decompress] runs on the socket's reader thread, [close] on the JS thread. */
  private val lock = ReentrantLock()
  private var closed = false

  /** Decompresses one WebSocket frame and returns the UTF-8 text it carries. */
  fun decompress(frame: ByteString): String = lock.withLock {
    // A frame delivered while the socket closes has no payload to hand over.
    if (closed) return ""
    val input = frame.toByteArray()
    val text = ByteArrayOutputStream(maxOf(input.size * 2, MIN_BUFFER_SIZE))
    var output = ByteArray(maxOf(input.size * 2, MIN_BUFFER_SIZE))
    var inputStart = 0
    while (true) {
      val result = decompressor.decompressStream(
        outputByteArray = output,
        outputEnd = output.size,
        outputStart = 0,
        inputByteArray = input,
        inputEnd = input.size,
        inputStart = inputStart,
      )
      getErrorName(result)?.let { throw IOException("zstd decompress failed: $it") }
      val produced = decompressor.outputBytesProcessed
      if (produced > 0) text.write(output, 0, produced)
      inputStart += decompressor.inputBytesProcessed
      // The frame is consumed and the stream has nothing more for it.
      if (inputStart >= input.size && (result == 0L || produced == 0)) break
      // A frame waiting for the next one, or no progress at all.
      if (decompressor.inputBytesProcessed == 0 && produced == 0) break
      // The output buffer filled before the frame ended: the rest goes in a larger one.
      if (produced == output.size) output = ByteArray(output.size * 2)
    }
    text.toString(StandardCharsets.UTF_8.name())
  }

  override fun close() {
    lock.withLock {
      if (closed) return
      closed = true
      decompressor.close()
    }
  }

  private companion object {
    /** Small frames still need room to decompress into. */
    const val MIN_BUFFER_SIZE = 1024
  }
}
