package me.palmdevs.isocord.chat

import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.IsocordMessagePreviewViewManagerDelegate
import com.facebook.react.viewmanagers.IsocordMessagePreviewViewManagerInterface
import me.palmdevs.isocord.chat.rows.parseMessage
import me.palmdevs.isocord.chat.rows.parseTheme

/** Exposes [MessagePreviewView] to React as `IsocordMessagePreviewView` (src/native/MessagePreviewViewNativeComponent.ts). */
@ReactModule(name = MessagePreviewViewManager.NAME)
class MessagePreviewViewManager :
  SimpleViewManager<MessagePreviewView>(),
  IsocordMessagePreviewViewManagerInterface<MessagePreviewView> {
  private val delegate = IsocordMessagePreviewViewManagerDelegate<MessagePreviewView, MessagePreviewViewManager>(this)

  override fun getDelegate(): ViewManagerDelegate<MessagePreviewView> = delegate

  override fun getName(): String = NAME

  override fun createViewInstance(context: ThemedReactContext): MessagePreviewView = MessagePreviewView(context)

  @ReactProp(name = "message")
  override fun setMessage(view: MessagePreviewView, value: String?) {
    view.row = parseMessage(value)
  }

  @ReactProp(name = "theme")
  override fun setTheme(view: MessagePreviewView, value: String?) {
    view.theme = parseTheme(value)
  }

  @ReactProp(name = "lineClamp", defaultInt = 2)
  override fun setLineClamp(view: MessagePreviewView, value: Int) {
    view.lineClamp = value
  }

  @ReactProp(name = "maxHeight", defaultFloat = 0f)
  override fun setMaxHeight(view: MessagePreviewView, value: Float) {
    view.maxHeight = value
  }

  override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> =
    mapOf("topContentHeight" to mapOf("registrationName" to "onContentHeight"))

  companion object {
    const val NAME = "IsocordMessagePreviewView"
  }
}
