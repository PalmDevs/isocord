package com.margelo.nitro.isocord

import android.util.Log
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.websocket.WebSocketModule
import com.margelo.nitro.NitroModules
import java.util.concurrent.ConcurrentHashMap
import me.palmdevs.isocord.compression.ZstdStream
import me.palmdevs.isocord.core.Perf
import okio.ByteString

private const val TAG = "IsocordFastConnect"

/**
 * Decompresses the gateway's zstd-stream inside the native WebSocket, so the JS thread only parses
 * the payloads. Also sends a prepared IDENTIFY from the socket's reader thread.
 * References: CompressionModule, ZstdContentHandler and FastConnectModule in the official client.
 */
@DoNotStrip
@Keep
class HybridIsocordGateway : HybridIsocordGatewaySpec() {
  private val context: ReactApplicationContext =
    NitroModules.applicationContext ?: error("NitroModules.applicationContext is null")

  /** One handler per socket: the gateway's frames continue each other. */
  private val handlers = ConcurrentHashMap<Int, ContentHandler>()

  override val supportsZstd: Boolean = true

  private fun webSocketModule() = context.getNativeModule(WebSocketModule::class.java)

  override fun enableZstdStreamSupport(socketId: Double) {
    val id = socketId.toInt()
    val handler = handlers.getOrPut(id) { ContentHandler(id) }
    webSocketModule()?.setContentHandler(id, handler)
  }

  override fun disableZstdStreamSupport(socketId: Double) {
    val id = socketId.toInt()
    webSocketModule()?.setContentHandler(id, null)
    handlers.remove(id)?.close()
  }

  override fun prepareIdentify(socketId: Double, payload: String): Boolean =
    handlers[socketId.toInt()]?.prepareIdentify(payload) ?: false

  override fun dispose() {
    handlers.values.forEach { it.close() }
    handlers.clear()
    super.dispose()
  }

  /** Turns a binary zstd frame into the text the JS WebSocket delivers. */
  private inner class ContentHandler(private val id: Int) : WebSocketModule.ContentHandler, AutoCloseable {
    private val stream = ZstdStream()
    private val openedNs = System.nanoTime()
    /** IDENTIFY waiting for the first frame. */
    private var identify: String? = null
    private var firstFrame = false
    private var identified = false

    /** FastConnectModule `prepareIdentify`: sends now if HELLO is already in, else on the first frame. */
    @Synchronized
    fun prepareIdentify(payload: String): Boolean {
      if (webSocketModule() == null) return false
      if (!firstFrame) identify = payload
      else if (!identified) {
        Log.i(TAG, "IDENTIFY sent on prepare, HELLO came first")
        send(payload)
      }
      return true
    }

    override fun onMessage(text: String, params: WritableMap) {
      params.putString("data", text)
    }

    override fun onMessage(bytes: ByteString, params: WritableMap) {
      params.putString("type", "text")
      params.putString("data", stream.decompress(bytes))
      if (!firstFrame) onFirstFrame()
    }

    /**
     * FastConnectModule `sendIdentify`, on HELLO. Stock WebSocketModule has no `onOpen` hook.
     * Logs the handshake time, which excludes any wait for the JS thread.
     */
    @Synchronized
    private fun onFirstFrame() {
      firstFrame = true
      val waitedNs = System.nanoTime() - openedNs
      if (Perf.recording) Perf.record("gateway:hello received", openedNs, waitedNs)
      val payload = identify
      Log.i(TAG, "HELLO received ${waitedNs / 1_000_000} ms after opening, IDENTIFY sent: ${payload != null}")
      if (payload != null) send(payload)
    }

    private fun send(payload: String) {
      identify = null
      identified = true
      webSocketModule()?.send(payload, id.toDouble())
    }

    override fun close() = stream.close()
  }
}
