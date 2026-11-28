package me.palmdevs.isocord.voice.rtc

import android.util.Log
import java.nio.ByteBuffer
import kotlin.time.Duration
import kotlin.time.Duration.Companion.seconds
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import me.palmdevs.isocord.voice.VOICE_GATEWAY_VERSION
import me.palmdevs.isocord.voice.VoiceCloseCode
import me.palmdevs.isocord.voice.VoiceOp
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString
import okio.ByteString.Companion.toByteString
import org.json.JSONObject

/** Resume attempts before giving up (RTCControlSocket.tsx handleClose, `backoff.fails > 3`). */
private const val RESUME_ATTEMPTS = 3
private val RESUME_BACKOFF = 1.seconds

/** Normal closure, sent when we leave. */
private const val CLOSE_NORMAL = 1000

/** Binary frames carry unsigned 16-bit sequences and transition ids, and an unsigned 8-bit opcode. */
private const val UNSIGNED_SHORT = 0xFFFF
private const val UNSIGNED_BYTE = 0xFF

/** What a voice gateway reports to its connection. Called on the connection's serial dispatcher. */
interface VoiceGatewayListener {
  /** Returns the IDENTIFY payload for a new session. */
  fun identify(): JSONObject
  suspend fun onMessage(op: Int, d: JSONObject?)
  fun onBinary(op: Int, payload: ByteBuffer)
  fun onResuming()
  fun onResumed()
  /** The socket is gone for good: a final close code, too many failed resumes, or not resumable yet. */
  fun onGone(code: Int?)
}

/**
 * One voice gateway socket: HELLO, IDENTIFY or RESUME, heartbeats with `seq_ack`, and resuming after a drop
 * (RTCControlSocket.tsx). Everything runs on [scope], which must be serial.
 */
class VoiceGateway(
  private val request: ConnectRequest,
  private val http: OkHttpClient,
  private val scope: CoroutineScope,
  private val listener: VoiceGatewayListener,
  private val tag: String,
) {
  /** Set once Session Description arrived (RTCControlSocket.tsx `resumable`). */
  var resumable = false

  private var socket: WebSocket? = null
  private var heartbeat: Job? = null
  private var seqAck = -1
  private var closing = false
  private var resuming = false
  private var resumeAttempts = 0
  /** The last heartbeat was acknowledged (op 6). */
  private var acked = true
  private var acks = 0
  private val _healthy = MutableStateFlow(false)

  /** The socket is open and, after a drop, resumed. Messages sent while it is false may be lost. */
  val healthy: StateFlow<Boolean> = _healthy

  /** Socket events, handled one at a time and in order, even when a handler suspends. */
  private val inbox = Channel<suspend () -> Unit>(Channel.UNLIMITED)

  init {
    scope.launch { for (task in inbox) task() }
  }

  fun open() {
    val url = "wss://${request.endpoint}/?v=$VOICE_GATEWAY_VERSION"
    socket = http.newWebSocket(Request.Builder().url(url).build(), Listener())
  }

  /**
   * Checks the socket after a network change: sends a heartbeat now and drops the socket when no ack comes
   * within [timeout], which resumes it (RTCControlSocket.tsx `expeditedHeartbeat`).
   */
  fun expeditedHeartbeat(timeout: Duration) {
    val checked = socket ?: return
    val before = acks
    send(VoiceOp.HEARTBEAT, JSONObject().put("t", System.currentTimeMillis()).put("seq_ack", seqAck))
    scope.launch {
      delay(timeout)
      if (acks == before && checked === socket) {
        Log.w(tag, "heartbeat not acknowledged after a network change")
        checked.cancel()
      }
    }
  }

  fun close() {
    closing = true
    heartbeat?.cancel()
    inbox.close()
    socket?.close(CLOSE_NORMAL, null)
    socket = null
  }

  fun send(op: Int, d: JSONObject) {
    Log.d(tag, "-> op $op")
    socket?.send(JSONObject().put("op", op).put("d", d).toString())
  }

  /** Client binary frames: 1-byte opcode, payload. */
  fun sendBinary(op: Int, payload: ByteArray) {
    Log.d(tag, "-> binary op $op, ${payload.size} bytes")
    socket?.send((byteArrayOf(op.toByte()) + payload).toByteString())
  }

  private inner class Listener : WebSocketListener() {
    override fun onMessage(webSocket: WebSocket, text: String) {
      inbox.trySend { if (webSocket === socket) handleJson(JSONObject(text)) }
    }

    override fun onMessage(webSocket: WebSocket, bytes: ByteString) {
      inbox.trySend { if (webSocket === socket) handleBinary(bytes.toByteArray()) }
    }

    override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
      webSocket.close(code, null)
    }

    override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
      Log.w(tag, "voice gateway closed $code $reason")
      inbox.trySend { onSocketGone(webSocket, code) }
    }

    override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
      Log.e(tag, "voice gateway failed", t)
      inbox.trySend { onSocketGone(webSocket, null) }
    }
  }

  /** Resumes on the same peer connection (RTCControlSocket.tsx handleClose, reconnect, resume). */
  private suspend fun onSocketGone(webSocket: WebSocket, code: Int?) {
    if (webSocket !== socket || closing) return
    heartbeat?.cancel()
    _healthy.value = false
    if (!resumable || code in VoiceCloseCode.FINAL || resumeAttempts >= RESUME_ATTEMPTS) {
      Log.w(tag, "voice gateway gone (code $code), not resuming")
      socket = null
      listener.onGone(code)
      return
    }
    resumeAttempts++
    listener.onResuming()
    delay(RESUME_BACKOFF * resumeAttempts)
    if (closing) return
    Log.i(tag, "resuming, attempt $resumeAttempts")
    resuming = true
    open()
  }

  private suspend fun handleJson(payload: JSONObject) {
    if (payload.has("seq")) seqAck = payload.getInt("seq")
    val op = payload.getInt("op")
    val d = payload.optJSONObject("d")
    Log.d(tag, "<- op $op")
    when (op) {
      VoiceOp.HELLO -> onHello(d!!.getDouble("heartbeat_interval").toLong())
      VoiceOp.HEARTBEAT_ACK -> {
        acked = true
        acks++
      }
      VoiceOp.RESUMED -> {
        Log.i(tag, "resumed")
        resumeAttempts = 0
        _healthy.value = true
        listener.onResumed()
      }
      else -> listener.onMessage(op, d)
    }
  }

  private fun handleBinary(frame: ByteArray) {
    val buffer = ByteBuffer.wrap(frame)
    seqAck = buffer.unsignedShort()
    val op = buffer.get().toInt() and UNSIGNED_BYTE
    Log.d(tag, "<- binary op $op, ${frame.size} bytes")
    listener.onBinary(op, buffer)
  }

  private fun onHello(intervalMs: Long) {
    heartbeat?.cancel()
    acked = true
    heartbeat = scope.launch {
      while (isActive) {
        if (!acked) {
          // A half-dead socket: drop it and resume, as the main gateway does (GatewaySocket.tsx _handleHeartbeatTimeout).
          Log.w(tag, "heartbeat not acknowledged")
          socket?.cancel()
          return@launch
        }
        acked = false
        send(VoiceOp.HEARTBEAT, JSONObject().put("t", System.currentTimeMillis()).put("seq_ack", seqAck))
        delay(intervalMs)
      }
    }
    if (!resuming) {
      _healthy.value = true
      return send(VoiceOp.IDENTIFY, listener.identify())
    }
    resuming = false
    send(
      VoiceOp.RESUME,
      JSONObject()
        .put("server_id", request.serverId)
        .put("channel_id", request.channelId)
        .put("session_id", request.sessionId)
        .put("token", request.token)
        .put("seq_ack", seqAck),
    )
  }
}

/** Reads an unsigned 16-bit value. */
internal fun ByteBuffer.unsignedShort(): Int = short.toInt() and UNSIGNED_SHORT
