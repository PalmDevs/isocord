package me.palmdevs.isocord.input

import android.view.ActionMode
import android.view.Menu
import android.view.MenuItem
import android.widget.EditText
import me.palmdevs.isocord.notifications.notify.title

/** "Mark as spoiler" in the selection menu: wraps the selection in `||`. */
internal class SpoilerMenu(
  private val editText: EditText,
  private val title: () -> String?,
  private val replace: (location: Int, length: Int, text: String, blocksJson: String?, keepCursor: Boolean, expectedEditId: Int) -> Unit,
) : ActionMode.Callback {
  private companion object {
    const val SPOILER_ITEM = 0x5b01
  }

  override fun onCreateActionMode(mode: ActionMode, menu: Menu): Boolean {
    title()?.let { menu.add(Menu.NONE, SPOILER_ITEM, Menu.FIRST, it) }
    return true
  }

  override fun onPrepareActionMode(mode: ActionMode, menu: Menu): Boolean = false

  override fun onActionItemClicked(mode: ActionMode, item: MenuItem): Boolean {
    if (item.itemId != SPOILER_ITEM) return false
    val start = editText.selectionStart
    val end = editText.selectionEnd
    if (start < 0 || end <= start) return false
    val selected = editText.text?.subSequence(start, end) ?: return false
    replace(start, end - start, "||$selected||", null, false, -1)
    mode.finish()
    return true
  }

  override fun onDestroyActionMode(mode: ActionMode) {}
}
