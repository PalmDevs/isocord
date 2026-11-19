package me.palmdevs.isocord.notifications

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

private const val START = 1_000_000L
private const val BRIEF_TRIP_MS = 2_000L
private const val LONG_TRIP_MS = 4_000L
private const val BEFORE_LEAVING = START - 1
private const val WHILE_AWAY = START + 1_000L

class HandoverTest {
  private var clock = START
  private val handover = Handover { clock }

  @Test
  fun briefTripIsNoTakeover() {
    handover.left()
    clock += BRIEF_TRIP_MS
    handover.returned()
    assertFalse(handover.appReplaying)
    assertFalse(handover.replayed(WHILE_AWAY, inApp = true))
  }

  @Test
  fun longTripReplaysUntilResumed() {
    handover.left()
    clock += LONG_TRIP_MS
    handover.returned()
    assertTrue(handover.replaying(inApp = true))
    handover.appSettled()
    assertFalse(handover.replaying(inApp = true))
  }

  @Test
  fun appSessionDropsMessagesSentBeforeTheReturn() {
    handover.left()
    clock += LONG_TRIP_MS
    handover.returned()
    assertTrue(handover.replayed(WHILE_AWAY, inApp = true))
    assertFalse(handover.replayed(clock + 1, inApp = true))
  }

  @Test
  fun backgroundSessionDropsMessagesSentBeforeTheAppLeft() {
    handover.left()
    assertTrue(handover.replayed(BEFORE_LEAVING, inApp = false))
    assertFalse(handover.replayed(START + 1, inApp = false))
  }

  @Test
  fun backgroundResumeReplaysUntilSettledOrTheAppReturns() {
    handover.left()
    handover.backgroundResumes(resuming = true)
    assertTrue(handover.replaying(inApp = false))
    handover.backgroundSettled()
    assertFalse(handover.replaying(inApp = false))
    handover.backgroundResumes(resuming = true)
    clock += BRIEF_TRIP_MS
    handover.returned()
    assertFalse(handover.backgroundReplaying)
  }

  @Test
  fun leavingEndsTheAppReplay() {
    handover.left()
    clock += LONG_TRIP_MS
    handover.returned()
    handover.left()
    assertFalse(handover.appReplaying)
  }

  @Test
  fun freshIdentifyDoesNotReplay() {
    handover.backgroundResumes(resuming = false)
    assertEquals(false, handover.backgroundReplaying)
  }
}
