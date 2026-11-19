package me.palmdevs.isocord.expressions

import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.IsocordExpressionGridViewManagerDelegate
import com.facebook.react.viewmanagers.IsocordExpressionGridViewManagerInterface
import me.palmdevs.isocord.chat.rows.parseTheme

/** Exposes [ExpressionGridView] to React as `IsocordExpressionGridView` (src/native/ExpressionGridViewNativeComponent.ts). */
@ReactModule(name = ExpressionGridViewManager.NAME)
class ExpressionGridViewManager :
  SimpleViewManager<ExpressionGridView>(),
  IsocordExpressionGridViewManagerInterface<ExpressionGridView> {
  private val delegate = IsocordExpressionGridViewManagerDelegate<ExpressionGridView, ExpressionGridViewManager>(this)

  override fun getDelegate(): ViewManagerDelegate<ExpressionGridView> = delegate

  override fun getName(): String = NAME

  override fun createViewInstance(context: ThemedReactContext): ExpressionGridView = ExpressionGridView(context)

  @ReactProp(name = "sections")
  override fun setSections(view: ExpressionGridView, value: String?) {
    view.setSectionsJson(value)
  }

  @ReactProp(name = "kind")
  override fun setKind(view: ExpressionGridView, value: String?) {
    view.kind = if (value == GridKindName.STICKER) GridKind.Sticker else GridKind.Emoji
  }

  @ReactProp(name = "theme")
  override fun setTheme(view: ExpressionGridView, value: String?) {
    view.theme = parseTheme(value)
  }

  @ReactProp(name = "animate", defaultBoolean = true)
  override fun setAnimate(view: ExpressionGridView, value: Boolean) {
    view.animate = value
  }

  @ReactProp(name = "bottomPadding", defaultFloat = 0f)
  override fun setBottomPadding(view: ExpressionGridView, value: Float) {
    view.bottomPadding = value
  }

  override fun scrollToSection(view: ExpressionGridView, index: Int) {
    view.scrollToSection(index)
  }

  override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> =
    listOf("PressItem", "LongPressItem", "ActiveSection", "AtTop").associate { "top$it" to mapOf("registrationName" to "on$it") }

  companion object {
    const val NAME = "IsocordExpressionGridView"
  }
}
