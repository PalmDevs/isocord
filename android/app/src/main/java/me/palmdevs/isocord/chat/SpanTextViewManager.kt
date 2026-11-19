package me.palmdevs.isocord.chat

import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.IsocordSpanTextViewManagerDelegate
import com.facebook.react.viewmanagers.IsocordSpanTextViewManagerInterface
import me.palmdevs.isocord.chat.rows.ChatTheme
import me.palmdevs.isocord.chat.rows.Span
import me.palmdevs.isocord.chat.rows.parseTheme
import me.palmdevs.isocord.core.decodeOrNull
import kotlinx.serialization.builtins.ListSerializer

/** Exposes [SpanTextView] to React as `IsocordSpanTextView` (src/native/SpanTextViewNativeComponent.ts). */
@ReactModule(name = SpanTextViewManager.NAME)
class SpanTextViewManager :
  SimpleViewManager<SpanTextView>(),
  IsocordSpanTextViewManagerInterface<SpanTextView> {
  private var lastThemeJson: String? = null
  private var lastTheme = ChatTheme()

  private val delegate = IsocordSpanTextViewManagerDelegate<SpanTextView, SpanTextViewManager>(this)

  override fun getDelegate(): ViewManagerDelegate<SpanTextView> = delegate

  override fun getName(): String = NAME

  override fun createViewInstance(context: ThemedReactContext): SpanTextView = SpanTextView(context)

  @ReactProp(name = "spans")
  override fun setSpans(view: SpanTextView, value: String?) {
    view.spans = if (value.isNullOrEmpty()) emptyList() else decodeOrNull(ListSerializer(Span.serializer()), value) ?: emptyList()
  }

  @ReactProp(name = "theme")
  override fun setTheme(view: SpanTextView, value: String?) {
    // Every row gets the same theme string: decode it once.
    if (value != lastThemeJson) {
      lastThemeJson = value
      lastTheme = parseTheme(value)
    }
    view.theme = lastTheme
  }

  @ReactProp(name = "color", customType = "Color")
  override fun setColor(view: SpanTextView, value: Int?) {
    view.color = value
  }

  @ReactProp(name = "fontSize", defaultFloat = 0f)
  override fun setFontSize(view: SpanTextView, value: Float) {
    view.fontSize = value
  }

  @ReactProp(name = "lineHeight", defaultFloat = 0f)
  override fun setLineHeight(view: SpanTextView, value: Float) {
    view.lineHeight = value
  }

  @ReactProp(name = "prefix")
  override fun setPrefix(view: SpanTextView, value: String?) {
    view.prefix = value
  }

  @ReactProp(name = "lineClamp")
  override fun setLineClamp(view: SpanTextView, value: Int) {
    view.lineClamp = value
  }

  @ReactProp(name = "trailingIcon")
  override fun setTrailingIcon(view: SpanTextView, value: String?) {
    view.trailingIcon = value
  }

  @ReactProp(name = "markdown")
  override fun setMarkdown(view: SpanTextView, value: Boolean) {
    view.markdown = value
  }

  override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> = mapOf(
    "topContentHeight" to mapOf("registrationName" to "onContentHeight"),
    "topLinkPress" to mapOf("registrationName" to "onLinkPress"),
  )

  companion object {
    const val NAME = "IsocordSpanTextView"
  }
}
