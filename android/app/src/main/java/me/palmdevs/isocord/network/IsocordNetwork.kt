package me.palmdevs.isocord.network

import android.content.Context
import com.facebook.react.modules.network.OkHttpClientProvider
import com.facebook.react.modules.websocket.WebSocketModule
import java.net.Inet6Address
import java.net.InetAddress
import okhttp3.Dispatcher
import okhttp3.Dns
import okhttp3.OkHttpClient

/**
 * The official client's HTTP stack (353.11): React Native's OkHttp client, as its MainApplication sets it up.
 * Everything on OkHttpClientProvider uses it: fetch/XHR, the gateway WebSocket, expo-image, Coil, the uploader.
 */
object IsocordNetwork {
  /** ClientInfo's user agent in the reference (`oa.a.c`). */
  const val USER_AGENT = "Discord-Android/${ClientBuild.VERSION_CODE};RNA"

  /** Call before React Native starts, so its NetworkingModule is built with this client. */
  fun install(context: Context) {
    ScopedCookieJar.init(context)
    OkHttpClientProvider.setOkHttpClientFactory { createClient(context.applicationContext) }
    // The reference's WebSocket builder (`j60.e` case 19): resolve the gateway IPv4 first.
    WebSocketModule.setCustomClientBuilder { builder -> builder.dns(Ipv4FirstDns) }
  }

  /** Also used by the background notification gateway (NotificationGateway). */
  object Ipv4FirstDns : Dns {
    override fun lookup(hostname: String): List<InetAddress> = Dns.SYSTEM.lookup(hostname).sortedBy { it is Inet6Address }
  }

  /**
   *   The reference's OkHttpClientFactory (`c2.b.g`): React Native's default builder with twice the dispatcher limits.
   *   An interceptor replaces any User-Agent with the client's own, after the headers JS set.
   *   The cookie jar is [ScopedCookieJar], not React Native's shared one.
   */
  private fun createClient(context: Context): OkHttpClient {
    val dispatcher = Dispatcher()
    dispatcher.maxRequests *= 2
    dispatcher.maxRequestsPerHost = dispatcher.maxRequests
    return OkHttpClientProvider.createClientBuilder(context)
      .cookieJar(ScopedCookieJar)
      .dispatcher(dispatcher)
      .addInterceptor(ScopedCookieJar.ScopeInterceptor)
      .addInterceptor { chain ->
        chain.proceed(chain.request().newBuilder().removeHeader("User-Agent").addHeader("User-Agent", USER_AGENT).build())
      }
      .build()
  }
}
