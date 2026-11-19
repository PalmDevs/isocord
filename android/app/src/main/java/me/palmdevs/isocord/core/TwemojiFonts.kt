package me.palmdevs.isocord.core

import android.content.res.AssetManager
import android.graphics.Typeface
import android.graphics.fonts.Font
import android.graphics.fonts.FontFamily
import android.os.Build
import com.facebook.react.common.assets.ReactFontManager

/**
 * The app fonts with the bundled Twemoji font (scripts/fetch-twemoji.sh) as first fallback.
 * Emoji in any text (React Native, Compose, composer) are then Twemoji, not system emoji.
 * Minikin prefers a developer-given fallback over system fonts (FontCollection::isPrimaryFamily).
 * Typeface.CustomFallbackBuilder needs Android 10. Older versions keep system emoji.
 */
object TwemojiFonts {
  /** The families React Native text uses: the generated text tokens and the few literal `fontFamily` styles. */
  private val REACT_FAMILIES = listOf(
    "ggsans-Normal", "ggsans-Medium", "ggsans-Semibold", "ggsans-Bold", "ggsans-ExtraBold",
    "ggmono-Normal", "ggmono-Bold", "ABCGintoDiscordNord-Bold", "ABCGintoDiscordNord-BoldItalic",
  )

  private val typefaces = HashMap<String, Typeface>()
  private var twemoji: FontFamily? = null

  /** `fonts/<name>.ttf`, falling back to Twemoji. */
  fun typeface(assets: AssetManager, name: String): Typeface = synchronized(this) {
    typefaces.getOrPut(name) {
      val path = "fonts/$name.ttf"
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return@getOrPut Typeface.createFromAsset(assets, path)
      val font = Font.Builder(assets, path).build()
      val emoji = twemoji ?: FontFamily.Builder(Font.Builder(assets, "twemoji/Twemoji.ttf").build()).build().also { twemoji = it }
      Typeface.CustomFallbackBuilder(FontFamily.Builder(font).build())
        .addCustomFallback(emoji)
        .setStyle(font.style)
        .build()
    }
  }

  /** Puts the React Native families in its font cache before any text is laid out. */
  fun registerReactFonts(assets: AssetManager) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return
    for (name in REACT_FAMILIES) ReactFontManager.getInstance().setTypeface(name, Typeface.NORMAL, typeface(assets, name))
  }
}
