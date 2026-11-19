package me.palmdevs.isocord.network

import android.content.Context
import android.content.SharedPreferences
import com.facebook.react.modules.network.CookieJarContainer
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.Interceptor
import okhttp3.Response
import org.json.JSONArray

/**
 * Cookies kept apart per account, so one account's cookie (such as `__dcfduid`) never goes out with another's.
 * The official client shares one cookie store, which links accounts. This jar replaces React Native's.
 * JS names the jar per request with the [SCOPE_HEADER] header, which [ScopeInterceptor] strips.
 * Requests without it (images, uploads) neither send nor keep cookies.
 * Jars named `account:<id>` are saved to disk. Others (a login in progress) stay in memory until [move]d.
 */
object ScopedCookieJar : CookieJarContainer {
  const val SCOPE_HEADER = "X-Isocord-Cookie-Scope"
  /** The scope name of an account's jar, followed by its user id. */
  const val ACCOUNT_PREFIX = "account:"

  // FrescoModule and expo's ExpoFetchModule cast the client's jar to CookieJarContainer to put the WebView's
  // cookie store behind it. Ignore that: these jars stay the only cookie store, apart from the WebView's.
  override fun setCookieJar(cookieJar: CookieJar) {}

  override fun removeCookieJar() {}

  /** The scope of the call running on this thread; OkHttp runs a call's whole interceptor chain on one thread. */
  private val current = ThreadLocal<String?>()
  private val jars = HashMap<String, MutableList<Cookie>>()
  private lateinit var prefs: SharedPreferences

  fun init(context: Context) {
    prefs = context.getSharedPreferences("isocord_cookies", Context.MODE_PRIVATE)
  }

  override fun loadForRequest(url: HttpUrl): List<Cookie> {
    val scope = current.get() ?: return emptyList()
    synchronized(this) {
      val jar = jar(scope)
      val now = System.currentTimeMillis()
      if (jar.removeAll { it.expiresAt <= now }) save(scope)
      return jar.filter { it.matches(url) }
    }
  }

  override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
    val scope = current.get() ?: return
    synchronized(this) {
      val jar = jar(scope)
      val now = System.currentTimeMillis()
      for (cookie in cookies) {
        jar.removeAll { it.name == cookie.name && it.domain == cookie.domain && it.path == cookie.path }
        // An expiry in the past is how a server deletes a cookie.
        if (cookie.expiresAt > now) jar.add(cookie)
      }
      save(scope)
    }
  }

  /** Hands the cookies of a finished login to the account it logged into, replacing what that account had. */
  @Synchronized
  fun move(from: String, to: String) {
    val cookies = jars.remove(from) ?: load(from)
    prefs.edit().remove(from).apply()
    jars[to] = cookies
    save(to)
  }

  @Synchronized
  fun delete(scope: String) {
    jars.remove(scope)
    prefs.edit().remove(scope).apply()
  }

  private fun jar(scope: String): MutableList<Cookie> = jars.getOrPut(scope) { load(scope) }

  private fun load(scope: String): MutableList<Cookie> {
    val saved = prefs.getString(scope, null) ?: return mutableListOf()
    val array = JSONArray(saved)
    return MutableList(array.length()) { array.getJSONObject(it) }.mapNotNullTo(mutableListOf()) {
      // Parsed back against its own domain, so host-only and domain cookies keep their scope.
      Cookie.parse("https://${it.getString("domain")}/".toHttpUrl(), it.getString("cookie"))
    }
  }

  private fun save(scope: String) {
    if (!scope.startsWith(ACCOUNT_PREFIX)) return
    val array = JSONArray()
    for (cookie in jars[scope].orEmpty()) {
      array.put(org.json.JSONObject().put("domain", cookie.domain).put("cookie", cookie.toString()))
    }
    prefs.edit().putString(scope, array.toString()).apply()
  }

  /** Reads and strips [SCOPE_HEADER], and makes it the jar for the rest of the call. */
  object ScopeInterceptor : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
      val request = chain.request()
      val scope = request.header(SCOPE_HEADER)
      val previous = current.get()
      current.set(scope)
      try {
        return chain.proceed(if (scope == null) request else request.newBuilder().removeHeader(SCOPE_HEADER).build())
      } finally {
        current.set(previous)
      }
    }
  }
}
