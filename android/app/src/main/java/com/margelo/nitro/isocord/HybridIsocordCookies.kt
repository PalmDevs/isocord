package com.margelo.nitro.isocord

import android.webkit.CookieManager
import android.webkit.WebStorage
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.bridge.UiThreadUtil
import com.margelo.nitro.core.Promise
import com.margelo.nitro.core.resolve
import me.palmdevs.isocord.network.ScopedCookieJar

/** JS side of [ScopedCookieJar] and WebView cookie/storage cleanup. */
@DoNotStrip
@Keep
class HybridIsocordCookies : HybridIsocordCookiesSpec() {
  override fun moveCookieScope(from: String, to: String) = ScopedCookieJar.move(from, to)

  override fun deleteCookieScope(scope: String) = ScopedCookieJar.delete(scope)

  /** Forgets the cookies and storage of every WebView (the captcha's), so one account's captcha state never reaches another's. */
  override fun clearWebViewData(): Promise<Unit> {
    val promise = Promise<Unit>()
    UiThreadUtil.runOnUiThread {
      try {
        WebStorage.getInstance().deleteAllData()
        CookieManager.getInstance().removeAllCookies {
          CookieManager.getInstance().flush()
          promise.resolve()
        }
      } catch (e: Throwable) {
        promise.reject(e)
      }
    }
    return promise
  }
}
