package me.palmdevs.isocord.chat.list

import me.palmdevs.isocord.chat.rows.ChatRow
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class LoadNewerAnchorTest {
  private fun loading(placeholder: Boolean = false) = ChatRow.Loading(key = "loading-newer", placeholder = placeholder)
  private fun message(id: String) = ChatRow.Message(key = id, id = id)

  @Test
  fun anchorsToPreviousNewestWhenNewerMessagesArrive() {
    val prev = listOf(loading(), message("10"), message("9"))
    val next = listOf(loading(), message("12"), message("11"), message("10"), message("9"))
    assertEquals(3, newerAnchorIndex(prev, next))
  }

  @Test
  fun anchorsWhenLastPageRemovesLoadingNewer() {
    val prev = listOf(loading(), message("10"), message("9"))
    val next = listOf(message("12"), message("11"), message("10"), message("9"))
    assertEquals(2, newerAnchorIndex(prev, next))
  }

  @Test
  fun returnsNullWhenNoNewerRowsInserted() {
    val prev = listOf(loading(), message("10"), message("9"))
    val next = listOf(loading(), message("10"), message("9"))
    assertNull(newerAnchorIndex(prev, next))
  }

  @Test
  fun returnsNullForLiveChatAndPlaceholder() {
    assertNull(newerAnchorIndex(listOf(message("10")), listOf(message("11"), message("10"))))
    assertNull(newerAnchorIndex(listOf(loading(placeholder = true)), listOf(message("10"))))
  }

  @Test
  fun returnsMinusOneWhenWindowReplaced() {
    val prev = listOf(loading(), message("10"), message("9"))
    val next = listOf(message("50"), message("49"))
    assertEquals(-1, newerAnchorIndex(prev, next))
  }

  @Test
  fun usesLazyKeyAliases() {
    val aliases = mapOf("hidden-10b" to "hidden-10")
    val prev = listOf(loading(), ChatRow.HiddenGroup(key = "hidden-10", text = "1", revealed = false, url = ""))
    val next = listOf(loading(), message("11"), ChatRow.HiddenGroup(key = "hidden-10b", text = "1", revealed = false, url = ""))
    assertEquals(2, newerAnchorIndex(prev, next) { aliases[it] ?: it })
  }
}
