package me.palmdevs.isocord.core

import android.app.Activity
import android.os.Build
import android.os.Debug
import android.os.Handler
import android.os.HandlerThread
import android.os.Trace
import android.view.FrameMetrics
import android.view.Window
import me.palmdevs.isocord.chat.rows.Span
import org.json.JSONArray
import org.json.JSONObject

/**
 * The in-app perf monitor's native half (Settings, Performance).
 * While recording, counts frames from the window's FrameMetrics and keeps native [span]s. JS drains both each second through [TraceModule.snapshot].
 * Otherwise a span is only a system trace section and frames are not observed.
 */
object Perf {
  @Volatile var recording = false
    private set

  private const val MAX_SPANS = 1000

  /** A janky frame took over twice its deadline: JankStats' default heuristic (jankHeuristicMultiplier). */
  private const val JANK_MULTIPLIER = 2

  private val lock = Any()
  private val spans = ArrayDeque<Span>()
  private var frames = 0
  private var jank = 0
  private var worstNs = 0L

  private class Span(val name: String, val startNs: Long, val durationNs: Long, val thread: String)

  private var window: Window? = null
  private var frameThread: HandlerThread? = null

  private val frameListener = Window.OnFrameMetricsAvailableListener { _, metrics, _ ->
    if (metrics.getMetric(FrameMetrics.FIRST_DRAW_FRAME) == 1L) return@OnFrameMetricsAvailableListener
    val total = metrics.getMetric(FrameMetrics.TOTAL_DURATION)
    val deadline =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) metrics.getMetric(FrameMetrics.DEADLINE) else 16_666_667L
    synchronized(lock) {
      frames++
      if (total > worstNs) worstNs = total
      if (total > deadline * JANK_MULTIPLIER) {
        jank++
        // So janky frames line up with spans in the exported trace.
        val start =
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) metrics.getMetric(FrameMetrics.INTENDED_VSYNC_TIMESTAMP)
          else System.nanoTime() - total
        push(Span("jank frame", start, total, "frames"))
      }
    }
  }

  /** Runs [block] as a system trace section, and also records it while recording. */
  inline fun <T> span(name: String, block: () -> T): T {
    Trace.beginSection(name.take(127))
    val start = if (recording) System.nanoTime() else 0L
    try {
      return block()
    } finally {
      Trace.endSection()
      if (start != 0L) record(name, start, System.nanoTime() - start)
    }
  }

  fun record(name: String, startNs: Long, durationNs: Long) {
    val thread = Thread.currentThread().name
    synchronized(lock) { push(Span(name, startNs, durationNs, thread)) }
  }

  private fun push(span: Span) {
    if (spans.size == MAX_SPANS) spans.removeFirst()
    spans.addLast(span)
  }

  /** Must run on the main thread: the frame listener attaches to the activity's window. */
  fun setRecording(enabled: Boolean, activity: Activity?) {
    recording = enabled
    detach()
    synchronized(lock) {
      spans.clear()
      frames = 0
      jank = 0
      worstNs = 0
    }
    if (activity != null) attach(activity)
  }

  /** Observes [activity]'s frames while recording. Also called on resume, as recording can start before there's an activity. */
  fun attach(activity: Activity) {
    if (!recording || window === activity.window) return
    detach()
    val thread = HandlerThread("IsocordFrameMetrics").apply { start() }
    activity.window.addOnFrameMetricsAvailableListener(frameListener, Handler(thread.looper))
    window = activity.window
    frameThread = thread
  }

  /** Must run on the main thread. */
  fun detach() {
    window?.removeOnFrameMetricsAvailableListener(frameListener)
    window = null
    frameThread?.quitSafely()
    frameThread = null
  }

  /** Frame counts and native spans since the last call (times in ms on System.nanoTime's clock), and memory now. */
  fun snapshot(): String {
    val out = JSONObject()
    synchronized(lock) {
      out.put("frames", frames)
      out.put("jank", jank)
      out.put("worstMs", worstNs / 1e6)
      out.put(
        "spans",
        JSONArray().apply {
          for (span in spans) {
            put(JSONArray().put(span.name).put(span.startNs / 1e6).put(span.durationNs / 1e6).put(span.thread))
          }
        },
      )
      spans.clear()
      frames = 0
      jank = 0
      worstNs = 0
    }
    val runtime = Runtime.getRuntime()
    out.put("javaHeapMb", (runtime.totalMemory() - runtime.freeMemory()) / 1_048_576.0)
    out.put("nativeHeapMb", Debug.getNativeHeapAllocatedSize() / 1_048_576.0)
    return out.toString()
  }
}
