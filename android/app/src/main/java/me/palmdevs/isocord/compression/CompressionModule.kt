package me.palmdevs.isocord.compression

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.websocket.WebSocketModule
import java.util.concurrent.ConcurrentHashMap
import me.palmdevs.isocord.specs.NativeIsocordCompressionSpec
import okio.ByteString

/**
 * Decompresses the gateway's zstd-stream inside the native WebSocket, so the JS thread only parses
 * the payloads. References: CompressionModule and ZstdContentHandler in the official client.
 */
class CompressionModule(context: ReactApplicationContext) : NativeIsocordCompressionSpec(context) {
  override fun getName() = NAME

  /** One stream per socket: the gateway's frames continue each other. */
  private val streams = ConcurrentHashMap<Int, ZstdStream>()

  private fun webSocketModule() = reactApplicationContext.getNativeModule(WebSocketModule::class.java)

  override fun enableZstdStreamSupport(socketId: Double) {
    val id = socketId.toInt()
    val stream = streams.getOrPut(id) { ZstdStream() }
    webSocketModule()?.setContentHandler(id, ContentHandler(stream))
  }

  override fun disableZstdStreamSupport(socketId: Double) {
    val id = socketId.toInt()
    webSocketModule()?.setContentHandler(id, null)
    streams.remove(id)?.close()
  }

  override fun getTypedExportedConstants(): Map<String, Any> = mapOf("supportsZstd" to true)

  /** Turns a binary zstd frame into the text the JS WebSocket delivers. */
  private class ContentHandler(private val stream: ZstdStream) : WebSocketModule.ContentHandler {
    override fun onMessage(text: String, params: WritableMap) {
      params.putString("data", text)
    }

    override fun onMessage(bytes: ByteString, params: WritableMap) {
      params.putString("type", "text")
      params.putString("data", stream.decompress(bytes))
    }
  }

  companion object {
    const val NAME = "IsocordCompression"
  }
}
