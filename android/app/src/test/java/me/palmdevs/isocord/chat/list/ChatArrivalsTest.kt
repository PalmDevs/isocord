package me.palmdevs.isocord.chat.list

import me.palmdevs.isocord.chat.rows.ChatRow
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ChatArrivalsTest {
  private fun message(id: String, status: String? = null) = ChatRow.Message(key = id, id = id, status = status)

  @Test
  fun singleArrivalEntersAndIsConsumed() {
    val arrivals = ChatArrivals()
    val initial = listOf(message("1"), message("0"))
    assertEquals(emptySet<String>(), arrivals.update(initial))

    val updated = listOf(message("2"), message("1"), message("0"))
    val entering = arrivals.update(updated)
    assertTrue(arrivals.fresh)
    assertEquals(setOf("2"), entering)

    assertTrue(arrivals.consume("2"))
    assertFalse(arrivals.consume("2"))
  }

  @Test
  fun rapidMultipleArrivalsAccumulate() {
    val arrivals = ChatArrivals()
    val r0 = listOf(message("0"))
    arrivals.update(r0)

    val r1 = listOf(message("1"), message("0"))
    arrivals.update(r1)

    val r2 = listOf(message("2"), message("1"), message("0"))
    val entering = arrivals.update(r2)
    assertEquals(setOf("1", "2"), entering)

    assertTrue(arrivals.consume("2"))
    assertTrue(arrivals.consume("1"))
    assertFalse(arrivals.consume("1"))
  }

  @Test
  fun reactionOrEditDoesNotClearEntering() {
    val arrivals = ChatArrivals()
    val r0 = listOf(message("1"), message("0"))
    arrivals.update(r0)

    val r1 = listOf(message("2"), message("1"), message("0"))
    arrivals.update(r1)

    val r2 = listOf(message("2"), message("1").copy(content = emptyList()), message("0"))
    val entering = arrivals.update(r2)
    assertEquals(setOf("2"), entering)
    assertTrue(arrivals.consume("2"))
  }

  @Test
  fun windowReplacementClearsEntering() {
    val arrivals = ChatArrivals()
    val r0 = listOf(message("1"), message("0"))
    arrivals.update(r0)

    val r1 = listOf(message("2"), message("1"), message("0"))
    arrivals.update(r1)

    val rJump = listOf(message("50"), message("49"))
    val entering = arrivals.update(rJump)
    assertTrue(entering.isEmpty())
    assertFalse(arrivals.consume("2"))
  }

  @Test
  fun aliasedKeyPreservesArrivals() {
    val arrivals = ChatArrivals()
    val r0 = listOf(message("0"))
    arrivals.update(r0)

    val pending = message("nonce-1", status = "sending")
    arrivals.update(listOf(pending, message("0")))

    val aliases = mapOf("server-1" to "nonce-1")
    val confirmed = message("server-1")
    val nextFromOther = message("2")
    val r2 = listOf(nextFromOther, confirmed, message("0"))

    val entering = arrivals.update(r2) { aliases[it] ?: it }
    assertTrue(entering.contains("2"))
    assertTrue(arrivals.consume("2"))
  }
}
