package me.palmdevs.isocord.baselineprofile

import androidx.benchmark.macro.MacrobenchmarkScope
import androidx.benchmark.macro.junit4.BaselineProfileRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.uiautomator.By
import androidx.test.uiautomator.Until
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

private const val PACKAGE = "me.palmdevs.isocord"

/** The Servers tab's accessibility label (tabs.servers). Needs an English device. */
private const val SERVERS_TAB = "Servers"
private const val LAUNCH_TIMEOUT_MS = 15_000L
private const val SWIPE_STEPS = 20
private const val CHAT_SCROLLS = 3
private const val PANEL_PASSES = 2

/**
 * Records startup and the chat paths into the app's baseline profile.
 * Needs the release app installed and logged in. Read-only by design: it taps only the Servers tab and swipes.
 * It never taps a channel, message, reaction or the composer. The last open chat is shown by swiping,
 * so it is marked read if it had unread messages, as opening it by hand would.
 */
@RunWith(AndroidJUnit4::class)
class BaselineProfileGenerator {
  @get:Rule val rule = BaselineProfileRule()

  @Test
  fun startup() = rule.collect(PACKAGE, includeInStartupProfile = true) {
    pressHome()
    startActivityAndWait()
    awaitTabs()
  }

  @Test
  fun chat() = rule.collect(PACKAGE) {
    pressHome()
    startActivityAndWait()
    awaitTabs()
    // The chat panel covers the tab bar when it was left open.
    swipeHorizontally(toRight = true)
    device.findObject(By.desc(SERVERS_TAB)).click()
    device.waitForIdle()
    repeat(PANEL_PASSES) {
      // ChatPanels: swiping the tab left shows the last open chat. Swiping the chat right reveals the tab.
      // No leftward swipe inside the chat: on a message it starts a reply or an edit (SwipeToReply.kt).
      swipeHorizontally(toRight = false)
      repeat(CHAT_SCROLLS) { swipeVertically(toOlder = true) }
      repeat(CHAT_SCROLLS) { swipeVertically(toOlder = false) }
      swipeHorizontally(toRight = true)
    }
  }
}

private fun MacrobenchmarkScope.awaitTabs() {
  check(device.wait(Until.hasObject(By.desc(SERVERS_TAB)), LAUNCH_TIMEOUT_MS)) {
    "No Servers tab. Log in on the device first and use an English locale."
  }
}

/** Swipes across the middle of the screen, clear of the system back gesture edges. */
private fun MacrobenchmarkScope.swipeHorizontally(toRight: Boolean) {
  val (left, right) = device.displayWidth / 5 to device.displayWidth * 4 / 5
  val y = device.displayHeight / 2
  if (toRight) device.swipe(left, y, right, y, SWIPE_STEPS) else device.swipe(right, y, left, y, SWIPE_STEPS)
  device.waitForIdle()
}

/** Drags the chat down to older messages, or back up to newer ones. */
private fun MacrobenchmarkScope.swipeVertically(toOlder: Boolean) {
  val x = device.displayWidth / 2
  val (top, bottom) = device.displayHeight / 4 to device.displayHeight * 3 / 4
  if (toOlder) device.swipe(x, top, x, bottom, SWIPE_STEPS) else device.swipe(x, bottom, x, top, SWIPE_STEPS)
  device.waitForIdle()
}
