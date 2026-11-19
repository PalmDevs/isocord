package me.palmdevs.isocord.chat.media

import coil3.ImageLoader
import coil3.asImage
import coil3.decode.DecodeResult
import coil3.decode.Decoder
import coil3.decode.ImageSource
import coil3.fetch.SourceFetchResult
import coil3.request.Options
import com.github.penfeizhou.animation.apng.APNGDrawable
import com.github.penfeizhou.animation.loader.ByteBufferLoader
import me.palmdevs.isocord.network.StickerLimit
import okio.BufferedSource
import okio.ByteString.Companion.decodeHex
import okio.ByteString.Companion.encodeUtf8
import java.nio.ByteBuffer

/*
 * Animated PNGs (APNG stickers) as APNG4Android's APNGDrawable. Coil's own decoders read only their first frame.
 * Unlike the official client's LINE ApngDrawable (FrescoApngImage), it decodes one frame at a time at the drawn size.
 * LINE's keeps every frame decoded, ~24MB a sticker, and a picker page of them ran out of memory.
 */
/** Loop limit that APNG4Android reads as forever. */
private const val LOOP_FOREVER = 0

private val PNG_SIGNATURE = "89504e470d0a1a0a".decodeHex()
private val IHDR = "IHDR".encodeUtf8()
/** Chunk that marks a PNG as animated; it comes before the first IDAT. */
private val ACTL = "acTL".encodeUtf8()
private val IDAT = "IDAT".encodeUtf8()
/** Bytes of a chunk's CRC, after its data. */
private const val CRC_BYTES = 4L
/** Largest chunk skipped while looking for acTL. Larger ones end the search. */
private const val MAX_SKIPPED_CHUNK = 64L * 1024

/**
 * Returns whether [source] is an APNG no larger than a sticker, reading a peek of it up to the first IDAT.
 * Larger animated PNGs (attachments) keep Coil's sampled first frame.
 */
private fun isStickerApng(source: BufferedSource): Boolean {
  val peek = source.peek()
  if (!peek.rangeEquals(0, PNG_SIGNATURE)) return false
  peek.skip(PNG_SIGNATURE.size.toLong())
  while (peek.request(8)) {
    val length = peek.readInt().toLong() and 0xFFFFFFFFL
    val type = peek.readByteString(4)
    if (type == ACTL) return true
    if (type == IDAT || length > MAX_SKIPPED_CHUNK || !peek.request(length + CRC_BYTES)) return false
    if (type == IHDR) {
      val width = peek.readInt()
      val height = peek.readInt()
      if (width !in 1..StickerLimit.SIZE || height !in 1..StickerLimit.SIZE) return false
      peek.skip(length - 8 + CRC_BYTES)
    } else {
      peek.skip(length + CRC_BYTES)
    }
  }
  return false
}

class ApngDecoder(private val source: ImageSource) : Decoder {
  override suspend fun decode(): DecodeResult {
    val bytes = ByteBuffer.wrap(source.source().use { it.readByteArray() })
    val drawable = APNGDrawable(object : ByteBufferLoader() {
      override fun getByteBuffer(): ByteBuffer = bytes.duplicate()
    })
    // Loops whatever its own loop count, as FrescoApngDrawable plays elapsed time modulo duration.
    drawable.setLoopLimit(LOOP_FOREVER)
    // Parsed here, off the main thread: the first size query blocks until the header is read.
    drawable.intrinsicWidth
    // Not shared from the memory cache: each view starts, stops and redraws its own copy.
    return DecodeResult(image = drawable.asImage(shareable = false), isSampled = false)
  }

  class Factory : Decoder.Factory {
    override fun create(result: SourceFetchResult, options: Options, imageLoader: ImageLoader): Decoder? =
      if (isStickerApng(result.source.source())) ApngDecoder(result.source) else null
  }
}
