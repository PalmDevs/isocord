package me.palmdevs.isocord.chat.list

import com.facebook.react.bridge.ReadableMap
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.IsocordChatViewManagerDelegate
import com.facebook.react.viewmanagers.IsocordChatViewManagerInterface
import me.palmdevs.isocord.chat.rows.parseTheme

/** Exposes [ChatView] to React as `IsocordChatView` (src/native/ChatViewNativeComponent.ts). */
@ReactModule(name = ChatViewManager.NAME)
class ChatViewManager : SimpleViewManager<ChatView>(), IsocordChatViewManagerInterface<ChatView> {
  private val delegate = IsocordChatViewManagerDelegate<ChatView, ChatViewManager>(this)

  override fun getDelegate(): ViewManagerDelegate<ChatView> = delegate

  override fun getName(): String = NAME

  override fun createViewInstance(context: ThemedReactContext): ChatView = ChatView(context)

  @ReactProp(name = "rows")
  override fun setRows(view: ChatView, value: String?) {
    view.rowsJson = value
  }

  override fun onAfterUpdateTransaction(view: ChatView) {
    super.onAfterUpdateTransaction(view)
    view.updateRows()
  }

  override fun onDropViewInstance(view: ChatView) {
    view.disposeRows()
    super.onDropViewInstance(view)
  }

  @ReactProp(name = "theme")
  override fun setTheme(view: ChatView, value: String?) {
    view.theme = parseTheme(value)
  }

  @ReactProp(name = "scrollKey")
  override fun setScrollKey(view: ChatView, value: String?) {
    view.scrollKey = value.orEmpty()
  }

  @ReactProp(name = "scrollTarget")
  override fun setScrollTarget(view: ChatView, value: ReadableMap?) {
    view.scrollTarget = value?.let(::parseScrollTarget)
  }

  @ReactProp(name = "jumpTarget")
  override fun setJumpTarget(view: ChatView, value: String?) {
    view.jumpTarget = value?.takeIf { it.isNotEmpty() }
  }

  @ReactProp(name = "composerTargetId")
  override fun setComposerTargetId(view: ChatView, value: String?) {
    view.composerTarget = value?.takeIf { it.isNotEmpty() }
  }

  @ReactProp(name = "bottomInset", defaultFloat = 0f)
  override fun setBottomInset(view: ChatView, value: Float) {
    view.bottomInset = value
  }

  @ReactProp(name = "composerNativeId")
  override fun setComposerNativeId(view: ChatView, value: String?) {
    view.composerNativeId = value?.takeIf { it.isNotEmpty() }
  }

  @ReactProp(name = "typingInset", defaultFloat = 0f)
  override fun setTypingInset(view: ChatView, value: Float) {
    view.typingInset = value
  }

  override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> =
    listOf("LoadOlder", "LoadNewer", "JumpToPresent", "LinkPress", "MessageLongPress", "MessageSwipe", "RowsDrawn", "AtBottomChange", "TopInsetChange").associate {
      "top$it" to mapOf("registrationName" to "on$it")
    }

  companion object {
    const val NAME = "IsocordChatView"
  }
}
