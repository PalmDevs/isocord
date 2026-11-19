package me.palmdevs.isocord.chat

import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.IsocordReactionsViewManagerDelegate
import com.facebook.react.viewmanagers.IsocordReactionsViewManagerInterface
import me.palmdevs.isocord.chat.rows.parseReactions
import me.palmdevs.isocord.chat.rows.parseTheme

/** Exposes [ReactionsView] to React as `IsocordReactionsView` (src/native/ReactionsViewNativeComponent.ts). */
@ReactModule(name = ReactionsViewManager.NAME)
class ReactionsViewManager :
  SimpleViewManager<ReactionsView>(),
  IsocordReactionsViewManagerInterface<ReactionsView> {
  private val delegate = IsocordReactionsViewManagerDelegate<ReactionsView, ReactionsViewManager>(this)

  override fun getDelegate(): ViewManagerDelegate<ReactionsView> = delegate

  override fun getName(): String = NAME

  override fun createViewInstance(context: ThemedReactContext): ReactionsView = ReactionsView(context)

  @ReactProp(name = "messageId")
  override fun setMessageId(view: ReactionsView, value: String?) {
    view.messageId = value.orEmpty()
  }

  @ReactProp(name = "reactions")
  override fun setReactions(view: ReactionsView, value: String?) {
    view.reactions = parseReactions(value)
  }

  @ReactProp(name = "theme")
  override fun setTheme(view: ReactionsView, value: String?) {
    view.theme = parseTheme(value)
  }

  override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> =
    mapOf(
      ReactionsView.SIZE_EVENT to mapOf("registrationName" to "onContentSize"),
      ReactionsView.LINK_EVENT to mapOf("registrationName" to "onLinkPress"),
    )

  companion object {
    const val NAME = "IsocordReactionsView"
  }
}
