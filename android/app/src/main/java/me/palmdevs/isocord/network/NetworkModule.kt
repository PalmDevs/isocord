package me.palmdevs.isocord.network

import android.os.LocaleList
import android.webkit.CookieManager
import android.webkit.WebStorage
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil
import me.palmdevs.isocord.specs.NativeIsocordNetworkSpec

/** JS side of [ScopedCookieJar], and the device values the official client reads natively. */
class NetworkModule(context: ReactApplicationContext) : NativeIsocordNetworkSpec(context) {
  override fun getName() = NAME

  /** DeviceLocaleModule's `Language` in the reference: the first of the adjusted system locales. */
  override fun getSystemLanguage(): String = LocaleList.getAdjustedDefault()[0].toLanguageTag()

  override fun moveCookieScope(from: String, to: String) = ScopedCookieJar.move(from, to)

  override fun deleteCookieScope(scope: String) = ScopedCookieJar.delete(scope)

  /** Forgets the cookies and storage of every WebView (the captcha's), so one account's captcha state never reaches another's. */
  override fun clearWebViewData(promise: Promise) {
    UiThreadUtil.runOnUiThread {
      WebStorage.getInstance().deleteAllData()
      CookieManager.getInstance().removeAllCookies { CookieManager.getInstance().flush(); promise.resolve(null) }
    }
  }

  companion object {
    const val NAME = "IsocordNetwork"
  }
}
