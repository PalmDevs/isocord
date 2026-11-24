package me.palmdevs.isocord.chat

import android.content.Context
import android.content.res.AssetManager
import androidx.compose.ui.text.font.AndroidFont
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontLoadingStrategy
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import me.palmdevs.isocord.core.TwemojiFonts

/** Discord's typefaces, loaded from the same asset files React Native uses, with the Twemoji fallback. */
class ChatFonts(assets: AssetManager) {
  val sans: FontFamily = FontFamily(
    listOf("Normal" to FontWeight.Normal, "Medium" to FontWeight.Medium, "Semibold" to FontWeight.SemiBold, "Bold" to FontWeight.Bold)
      .flatMap { (name, weight) ->
        listOf(
          AssetFont(assets, "ggsans-$name", weight, FontStyle.Normal),
          AssetFont(assets, "ggsans-${name}Italic", weight, FontStyle.Italic),
        )
      },
  )

  val mono: FontFamily = FontFamily(
    AssetFont(assets, "ggmono-Normal", FontWeight.Normal, FontStyle.Normal),
    AssetFont(assets, "ggmono-Bold", FontWeight.Bold, FontStyle.Normal),
  )

  companion object {
    private var shared: ChatFonts? = null

    /** Returns one instance for views outside a composition, so they share font lookups. Main thread only. */
    fun shared(context: Context): ChatFonts = shared ?: ChatFonts(context.applicationContext.assets).also { shared = it }
  }
}

/** `fonts/<name>.ttf` as [TwemojiFonts] builds it. Each weight and style keeps its own file. */
private class AssetFont(
  val assets: AssetManager,
  val name: String,
  override val weight: FontWeight,
  override val style: FontStyle,
) : AndroidFont(FontLoadingStrategy.Blocking, Loader, FontVariation.Settings()) {
  private object Loader : TypefaceLoader {
    override fun loadBlocking(context: Context, font: AndroidFont) =
      (font as AssetFont).let { TwemojiFonts.typeface(it.assets, it.name) }

    override suspend fun awaitLoad(context: Context, font: AndroidFont) = loadBlocking(context, font)
  }
}
