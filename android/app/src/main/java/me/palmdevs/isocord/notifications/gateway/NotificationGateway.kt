package me.palmdevs.isocord.notifications.gateway

import android.util.Log
import com.facebook.react.modules.network.OkHttpClientProvider
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit
import java.util.zip.DataFormatException
import java.util.zip.Inflater
import kotlin.random.Random
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.decodeFromStream
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject
import me.palmdevs.isocord.core.AppJson
import me.palmdevs.isocord.network.Discord
import me.palmdevs.isocord.network.GatewayClose
import me.palmdevs.isocord.network.GatewayOp
import me.palmdevs.isocord.network.IsocordNetwork
import me.palmdevs.isocord.network.Status
import me.palmdevs.isocord.notifications.Handover
import me.palmdevs.isocord.notifications.notify.AccountConfig
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString

private const val TAG = "IsocordGateway"
/**
 * zlib-stream, unlike the app's zstd-stream (socket.ts): the JDK inflates zlib, and zstd would need a native library.
 */
private const val COMPRESSION = "zlib-stream"
private const val QUERY = "/?encoding=json&v=${Discord.API_VERSION}&compress=$COMPRESSION"
/** Reconnect backoff, doubling between these. The app's socket reads them too. */
const val MIN_BACKOFF_MS = 1_000L
const val MAX_BACKOFF_MS = 60_000L
/** SessionHeartbeatScheduler's QoS payload version. The app's socket reads it too. */
const val QOS_VERSION = 31
/**
 * IDENTIFY presence `afk`: true, unlike the app's. This session is never the one in use (as its QoS heartbeat says).
 */
private const val IDENTIFY_AFK = true
/** Every zlib-stream message ends in a sync flush. */
private val ZLIB_SUFFIX = byteArrayOf(0, 0, 0xff.toByte(), 0xff.toByte())

interface GatewayListener {
  fun onConnected(connected: Boolean)
  /** Called on the gateway thread. */
  fun onDispatch(dispatch: GatewayDispatch)
  fun onAuthenticationFailed()
}

/** A dispatch whose `d` is decoded on demand, so events nobody handles are never parsed past their type. */
class GatewayDispatch(val type: String, private val body: ByteArray) {
  @OptIn(ExperimentalSerializationApi::class)
  fun <T> decode(serializer: KSerializer<T>): T =
    AppJson.decodeFromStream(Payload.serializer(serializer), ByteArrayInputStream(body)).d

  companion object {
    /** A dispatch heard by another connection, from its `d` as JSON. */
    fun ofPayload(type: String, d: String) = GatewayDispatch(type, "{\"d\":$d}".toByteArray())
  }
}

/**
 * The background session: one gateway connection, separate from the app's (src/core/gateway/socket.ts), kept open by [GatewayService].
 * JSON over zlib-stream, with heartbeats, resume and reconnect backoff like the JS socket.
 * Runs on one thread. OkHttp callbacks hop onto it.
 */
class NotificationGateway(private val account: AccountConfig, private val listener: GatewayListener) {
  val userId get() = account.userId
  val token get() = account.token

  private val thread = Executors.newSingleThreadScheduledExecutor { Thread(it, "isocord-gateway") }
  private val client =
    OkHttpClientProvider.getOkHttpClient().newBuilder().dns(IsocordNetwork.Ipv4FirstDns).build()
  private var socket: WebSocket? = null
  private var inflater = Inflater()
  private val pending = ByteArrayOutputStream()
  private var seq = 0L
  private var sessionId: String? = null
  private var resumeUrl: String? = null
  private var heartbeatInterval = 0L
  private var heartbeatAcked = true
  private var heartbeat: ScheduledFuture<*>? = null
  private var reconnect: ScheduledFuture<*>? = null
  private var backoff = MIN_BACKOFF_MS
  @Volatile private var closed = true
  /** The app is in front: the socket is closed but the session kept, to resume when the app leaves. */
  private var paused = false
  private var unpause: ScheduledFuture<*>? = null

  fun connect(paused: Boolean) =
    thread.execute {
      closed = false
      this.paused = paused
      if (!paused) open()
    }

  /**
   *   Pauses while the app is in front. Resumes (or identifies again) a moment after it leaves,
   *   so a system dialog over the app doesn't connect for nothing. The resume replays what arrived between.
   */
  fun setPaused(value: Boolean) {
    // No early `closed` check: `connect` clears it on the thread, so a pause sent right after it would be lost.
    execute {
      unpause?.cancel(false)
      unpause = null
      if (closed || paused == value) return@execute
      if (value) {
        paused = true
        teardown(GatewayClose.RESUMABLE)
      } else
        unpause =
          thread.schedule(
            {
              unpause = null
              paused = false
              backoff = MIN_BACKOFF_MS
              Handover.shared.backgroundResumes(sessionId != null)
              if (!closed) open()
            },
            Handover.TAKEOVER_DELAY_MS,
            TimeUnit.MILLISECONDS,
          )
    }
  }

  /** Ends the session on Discord's side and stops for good. */
  fun close() {
    closed = true
    thread.execute {
      teardown(GatewayClose.NORMAL)
      sessionId = null
      listener.onConnected(false)
    }
    thread.shutdown()
  }

  /** The network came back: a reconnect waiting out its backoff happens now. */
  fun networkAvailable() {
    // Called from ConnectivityManager's thread, which may still hold a gateway that was just closed.
    if (closed) return
    execute {
      if (closed || paused || reconnect == null) return@execute
      reconnect?.cancel(false)
      reconnect = null
      backoff = MIN_BACKOFF_MS
      open()
    }
  }

  private fun open() {
    val base = sessionId?.let { resumeUrl } ?: Discord.GATEWAY_URL
    inflater.end()
    inflater = Inflater()
    pending.reset()
    val request = Request.Builder().url(base + QUERY).header("Origin", Discord.WEBSOCKET_ORIGIN).build()
    socket =
      client.newWebSocket(
        request,
        object : WebSocketListener() {
          override fun onMessage(webSocket: WebSocket, bytes: ByteString) {
            val frame = bytes.toByteArray()
            onThread(webSocket) { receive(frame) }
          }

          override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
            webSocket.close(code, null)
            onThread(webSocket) { handleClose(code) }
          }

          override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
            Log.w(TAG, "connection failed: ${t.javaClass.simpleName}")
            onThread(webSocket) { handleClose(GatewayClose.ABNORMAL) }
          }
        },
      )
  }

  /** Runs [block] on the gateway thread, unless the gateway has shut down meanwhile. */
  private fun execute(block: () -> Unit) {
    try {
      thread.execute(block)
    } catch (e: RejectedExecutionException) {
      Log.w(TAG, "gateway thread is shut down", e)
    }
  }

  /** Runs `block` on the gateway thread if `ws` is still the current socket. */
  private fun onThread(ws: WebSocket, block: () -> Unit) {
    if (thread.isShutdown) return
    execute { if (socket === ws && !closed) block() }
  }

  private fun receive(frame: ByteArray) {
    pending.write(frame)
    // The suffix ends the buffered message, not each frame: a frame may stop partway through it.
    val input = pending.toByteArray()
    val end = input.size - ZLIB_SUFFIX.size
    if (end < 0 || !input.copyOfRange(end, input.size).contentEquals(ZLIB_SUFFIX)) return
    pending.reset()
    inflater.setInput(input)
    val out = ByteArrayOutputStream()
    val buffer = ByteArray(64 * 1024)
    try {
      while (true) {
        val n = inflater.inflate(buffer)
        if (n == 0) break
        out.write(buffer, 0, n)
      }
    } catch (error: DataFormatException) {
      // The stream's context is lost; only a new connection starts a new one.
      Log.w(TAG, "inflate failed")
      reconnectNow()
      return
    }
    val body = out.toByteArray()
    try {
      handle(body)
    } catch (error: Exception) {
      // kotlinx's messages end in a quote of the JSON input, which is private (socket.ts logs no contents either).
      Log.w(TAG, "payload failed: ${error.javaClass.simpleName}: ${error.message?.substringBefore("JSON input")}")
    }
  }

  @OptIn(ExperimentalSerializationApi::class)
  private fun handle(body: ByteArray) {
    val envelope = AppJson.decodeFromStream<Envelope>(ByteArrayInputStream(body))
    when (envelope.op) {
      GatewayOp.HELLO -> {
        val hello = GatewayDispatch("HELLO", body).decode(Hello.serializer())
        startHeartbeat(hello.heartbeat_interval)
        if (sessionId != null) resume() else identify()
      }
      GatewayOp.DISPATCH -> {
        envelope.s?.let { seq = it }
        val type = envelope.t ?: return
        val dispatch = GatewayDispatch(type, body)
        if (type == "READY") {
          val ready = dispatch.decode(SessionInfo.serializer())
          sessionId = ready.session_id
          resumeUrl = ready.resume_gateway_url
        }
        if (type == "READY" || type == "RESUMED") {
          backoff = MIN_BACKOFF_MS
          Handover.shared.backgroundSettled()
          listener.onConnected(true)
        }
        listener.onDispatch(dispatch)
      }
      GatewayOp.HEARTBEAT -> sendHeartbeat()
      GatewayOp.HEARTBEAT_ACK -> heartbeatAcked = true
      GatewayOp.RECONNECT -> reconnectNow()
      GatewayOp.INVALID_SESSION -> {
        // `d` says whether the session can still be resumed.
        val resumable =
          try {
            GatewayDispatch("", body).decode(Boolean.serializer())
          } catch (e: SerializationException) {
            Log.w(TAG, "INVALID_SESSION without a resumable flag: ${e.javaClass.simpleName}")
            false
          }
        if (!resumable) sessionId = null
        reconnectNow()
      }
    }
  }

  private fun send(op: Int, d: JsonElement) {
    socket?.send(buildJsonObject { put("op", op); put("d", d) }.toString())
  }

  /** Subscribes to `threads` for [guildIds] so THREAD_CREATE arrives for new forum posts. */
  fun subscribeThreads(guildIds: Collection<String>) {
    if (guildIds.isEmpty()) return
    send(
      GatewayOp.GUILD_SUBSCRIPTIONS_BULK,
      buildJsonObject {
        putJsonObject("subscriptions") {
          for (id in guildIds) putJsonObject(id) { put("threads", true) }
        }
      },
    )
  }

  /** GatewaySocket's IDENTIFY, as the app sends it (socket.ts), with the background's properties and an idle presence. */
  private fun identify() {
    seq = 0
    send(
      GatewayOp.IDENTIFY,
      buildJsonObject {
        put("token", account.token)
        put("capabilities", account.capabilities)
        put("properties", AppJson.parseToJsonElement(account.properties))
        putJsonObject("presence") {
          put("status", Status.UNKNOWN)
          put("since", 0)
          putJsonArray("activities") {}
          put("afk", IDENTIFY_AFK)
        }
        put("compress", false)
        putJsonObject("client_state") { putJsonObject("guild_versions") {} }
      },
    )
  }

  private fun resume() {
    send(
      GatewayOp.RESUME,
      buildJsonObject {
        put("token", account.token)
        put("session_id", sessionId)
        put("seq", seq)
      },
    )
  }

  private fun startHeartbeat(interval: Long) {
    heartbeatInterval = interval
    heartbeatAcked = true
    heartbeat?.cancel(false)
    heartbeat =
      thread.scheduleWithFixedDelay(
        {
          // A missed ack means the connection is dead even if the socket is open.
          if (!heartbeatAcked) reconnectNow() else sendHeartbeat()
        },
        (interval * Random.nextDouble()).toLong(),
        interval,
        TimeUnit.MILLISECONDS,
      )
  }

  /** SessionHeartbeatScheduler's QoS heartbeat; this session is never the one in use. */
  private fun sendHeartbeat() {
    heartbeatAcked = false
    send(
      GatewayOp.QOS_HEARTBEAT,
      buildJsonObject {
        put("seq", if (seq > 0) JsonPrimitive(seq) else JsonNull)
        putJsonObject("qos") {
          put("ver", QOS_VERSION)
          put("active", false)
          put("reasons", buildJsonArray {})
        }
      },
    )
  }

  private fun handleClose(code: Int) {
    teardown()
    listener.onConnected(false)
    if (closed) return
    if (code == GatewayClose.AUTHENTICATION_FAILED || code in GatewayClose.FATAL) {
      Log.w(TAG, "closed for good: $code")
      closed = true
      if (code == GatewayClose.AUTHENTICATION_FAILED) listener.onAuthenticationFailed()
      return
    }
    if (code == GatewayClose.INVALID_SEQ || code == GatewayClose.SESSION_TIMED_OUT) sessionId = null
    val delay = (backoff * (0.5 + Random.nextDouble() / 2)).toLong()
    backoff = (backoff * 2).coerceAtMost(MAX_BACKOFF_MS)
    reconnect = thread.schedule({ reconnect = null; open() }, delay, TimeUnit.MILLISECONDS)
  }

  /** Drops the connection without ending the session, then reconnects (and resumes). */
  private fun reconnectNow() {
    teardown(GatewayClose.RESUMABLE)
    listener.onConnected(false)
    if (!closed) open()
  }

  private fun teardown(code: Int? = null) {
    heartbeat?.cancel(false)
    reconnect?.cancel(false)
    heartbeat = null
    reconnect = null
    val ws = socket
    socket = null
    if (ws != null && code != null) ws.close(code, null)
  }
}

@Serializable
private class SessionInfo(val session_id: String, val resume_gateway_url: String? = null)
