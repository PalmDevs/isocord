package me.palmdevs.isocord.input

import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.IsocordChatInputManagerDelegate
import com.facebook.react.viewmanagers.IsocordChatInputManagerInterface

/** Exposes [ChatInputView] to React as `IsocordChatInput` (src/native/ChatInputNativeComponent.ts). */
@ReactModule(name = ChatInputViewManager.NAME)
class ChatInputViewManager : SimpleViewManager<ChatInputView>(), IsocordChatInputManagerInterface<ChatInputView> {
  private val delegate = IsocordChatInputManagerDelegate<ChatInputView, ChatInputViewManager>(this)

  override fun getDelegate(): ViewManagerDelegate<ChatInputView> = delegate

  override fun getName(): String = NAME

  override fun createViewInstance(context: ThemedReactContext): ChatInputView = ChatInputView(context)

  @ReactProp(name = "textColor", customType = "Color")
  override fun setTextColor(view: ChatInputView, value: Int?) = view.setTextColorValue(value ?: 0xFFFFFFFF.toInt())

  @ReactProp(name = "editable", defaultBoolean = true)
  override fun setEditable(view: ChatInputView, value: Boolean) = view.setEditableValue(value)

  @ReactProp(name = "shouldShowCursor", defaultBoolean = true)
  override fun setShouldShowCursor(view: ChatInputView, value: Boolean) = view.setShouldShowCursor(value)

  @ReactProp(name = "placeholder")
  override fun setPlaceholder(view: ChatInputView, value: String?) = view.setPlaceholder(value)

  @ReactProp(name = "placeholderColor", customType = "Color")
  override fun setPlaceholderColor(view: ChatInputView, value: Int?) = view.setPlaceholderColor(value ?: 0x80FFFFFF.toInt())

  @ReactProp(name = "markAsSpoilerTitle")
  override fun setMarkAsSpoilerTitle(view: ChatInputView, value: String?) = view.setMarkAsSpoilerTitle(value)

  // The Android keyboard has no light or dark appearance of its own; the value is accepted for parity.
  @ReactProp(name = "keyboardAppearance")
  override fun setKeyboardAppearance(view: ChatInputView, value: String?) {}

  @ReactProp(name = "selectionColor", customType = "Color")
  override fun setSelectionColor(view: ChatInputView, value: Int?) = view.setSelectionColor(value ?: 0x66FFFFFF)

  @ReactProp(name = "setNoExtractUI")
  override fun setSetNoExtractUI(view: ChatInputView, value: Boolean) = view.setNoExtractUI(value)

  @ReactProp(name = "keyboardType")
  override fun setKeyboardType(view: ChatInputView, value: String?) = view.setKeyboardTypeValue(value ?: "default")

  @ReactProp(name = "maxHeight", defaultFloat = 0f)
  override fun setMaxHeight(view: ChatInputView, value: Float) = view.setMaxHeightDp(value)

  @ReactProp(name = "verticalInset", defaultFloat = 8f)
  override fun setVerticalInset(view: ChatInputView, value: Float) = view.setVerticalInsetDp(value)

  @ReactProp(name = "showFormatMenu")
  override fun setShowFormatMenu(view: ChatInputView, value: Boolean) = view.setShowFormatMenu(value)

  override fun backspace(view: ChatInputView) = view.backspace()

  override fun blur(view: ChatInputView) = view.blurInput()

  override fun focus(view: ChatInputView) = view.focusInput()

  override fun openCustomKeyboard(view: ChatInputView) = view.openCustomKeyboard()

  override fun closeCustomKeyboard(view: ChatInputView) {}

  override fun openSystemKeyboard(view: ChatInputView) = view.openSystemKeyboard()

  override fun replaceRange(
    view: ChatInputView,
    location: Int,
    length: Int,
    text: String,
    styleBlocks: String,
    keepCursorPosition: Boolean,
    editId: Int,
  ) = view.replaceRange(location, length, text, styleBlocks, keepCursorPosition, editId)

  override fun setSelectedRange(view: ChatInputView, location: Int, length: Int) = view.setSelectedRange(location, length)

  override fun setText(view: ChatInputView, text: String) = view.setText(text)

  override fun flushText(view: ChatInputView, requestId: String) = view.flushText(requestId)

  override fun updateTextBlocks(view: ChatInputView, styleBlocks: String, editId: Int) = view.updateTextBlocks(styleBlocks, editId)

  override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> =
    listOf(
      "ChangeContentSize", "EndBlur", "BeginFocus", "SelectionOrTextChange", "TextFlushed",
      "PasteImage", "PasteCommand", "RequestSend",
    ).associate { "top$it" to mapOf("registrationName" to "on$it") }

  companion object {
    const val NAME = "IsocordChatInput"
  }
}
