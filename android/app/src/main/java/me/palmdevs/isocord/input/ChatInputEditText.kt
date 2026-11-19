package me.palmdevs.isocord.input

import android.content.Context
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputConnection
import android.view.inputmethod.InputConnectionWrapper
import androidx.appcompat.widget.AppCompatEditText

/**
 * The composer's text field (reference DCDChatInput): reports selection changes, pastes plain text only.
 * Touching it stops ancestors (the chat panel's swipe) taking the touch. Backspace can remove a whole styled node.
 */
class ChatInputEditText(context: Context) : AppCompatEditText(context) {
  var selectionListener: ((start: Int, end: Int) -> Unit)? = null

  /** Called for a backspace at [cursor]; returns true when it deleted a whole node instead. */
  var backspaceNode: ((cursor: Int) -> Boolean)? = null

  override fun onSelectionChanged(selStart: Int, selEnd: Int) {
    super.onSelectionChanged(selStart, selEnd)
    selectionListener?.invoke(selStart, selEnd)
  }

  // Pasting formatted text (web pages, other apps) must not bring its styles into the composer.
  override fun onTextContextMenuItem(id: Int): Boolean =
    super.onTextContextMenuItem(if (id == android.R.id.paste) android.R.id.pasteAsPlainText else id)

  override fun onTouchEvent(event: MotionEvent): Boolean {
    if (event.actionMasked == MotionEvent.ACTION_DOWN) parent?.requestDisallowInterceptTouchEvent(true)
    return super.onTouchEvent(event)
  }

  override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
    if (keyCode == KeyEvent.KEYCODE_DEL && backspaceNode?.invoke(selectionStart) == true) return true
    return super.onKeyDown(keyCode, event)
  }

  override fun onCreateInputConnection(outAttrs: EditorInfo): InputConnection? {
    val base = super.onCreateInputConnection(outAttrs) ?: return null
    return object : InputConnectionWrapper(base, true) {
      // Soft keyboards usually delete with this call rather than with a key event.
      override fun deleteSurroundingText(beforeLength: Int, afterLength: Int): Boolean {
        if (beforeLength == 1 && afterLength == 0 && backspaceNode?.invoke(selectionStart) == true) return true
        return super.deleteSurroundingText(beforeLength, afterLength)
      }
    }
  }
}
