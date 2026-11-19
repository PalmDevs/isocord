package me.palmdevs.isocord.notifications

/**
 * The app coming back after the background session took over. Owns when the app left and returned, and the replay
 * state of both sessions. [now] is the clock in ms.
 */
class Handover(private val now: () -> Long = System::currentTimeMillis) {
  /** When the app last left the front (ms). Starts at the process start. */
  @Volatile private var leftAt = now()

  /** Set when the app comes back after the takeover delay. Messages sent before it came while the app was away. */
  @Volatile private var returnedAt = 0L

  /**
   * The app session's resume is replaying what the background session notified, up to RESUMED or READY. Events
   * that carry no time to compare with [returnedAt] skip it.
   */
  @Volatile var appReplaying = false
    private set

  /**
   * The background session's resume is replaying what the app's session heard in front, up to RESUMED or READY.
   * Events that carry no time to compare with [leftAt] skip it.
   */
  @Volatile var backgroundReplaying = false
    private set

  /** MainActivity paused. */
  fun left() {
    leftAt = now()
    appReplaying = false
  }

  /** MainActivity resumed. Counts as a return only after the takeover delay, as shorter trips never connected. */
  fun returned() {
    backgroundReplaying = false
    if (now() - leftAt < TAKEOVER_DELAY_MS) return
    returnedAt = now()
    appReplaying = true
  }

  /** The background session resumes its session after the delay. [resuming] is false for a fresh IDENTIFY. */
  fun backgroundResumes(resuming: Boolean) {
    backgroundReplaying = resuming
  }

  /** The app session's gateway sent RESUMED or READY. */
  fun appSettled() {
    appReplaying = false
  }

  /** The background session's gateway sent RESUMED or READY. */
  fun backgroundSettled() {
    backgroundReplaying = false
  }

  /**
   * Returns whether a message sent at [sentAt] (ms) is one the other session notified: for the app's session, sent
   * before the return, and for the background one, sent before the app left.
   */
  fun replayed(sentAt: Long, inApp: Boolean) = sentAt < if (inApp) returnedAt else leftAt

  /** Returns whether a session replays events without a time. */
  fun replaying(inApp: Boolean) = if (inApp) appReplaying else backgroundReplaying

  companion object {
    /** How long the app must stay out of front before the background session connects. */
    const val TAKEOVER_DELAY_MS = 3_000L

    val shared = Handover()
  }
}
