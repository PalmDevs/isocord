package me.palmdevs.isocord.voice.rtc

import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sqrt
import me.palmdevs.isocord.voice.stream.GO_LIVE_BITRATE_MAX

/** Media Sink Wants scale (docs.discord.food, Media Sink Wants): 0 turns a stream off, 100 wants the best layer. */
const val WANT_NONE = 0
const val WANT_ALL = 100

/** Camera layer qualities the reference announces (Constants.tsx `SIMULCAST_HQ_QUALITY`, `SIMULCAST_LQ_QUALITY`). */
const val QUALITY_HIGH = 100
const val QUALITY_LOW = 50

/** Bitrate cap of a full-quality layer, bits per second (Constants.tsx `defaultVideoQualityOptions`). */
const val VIDEO_BITRATE_MAX = 2_500_000

/** Lowest cap a wanted layer gets (`defaultVideoQualityOptions.videoBitrateFloor`). */
private const val VIDEO_BITRATE_FLOOR = 150_000

/** A low-quality layer gets a quarter of the cap (BaseConnection.tsx `initializeStreamParameters`). */
private const val LOW_BITRATE_DIVISOR = 4

/** Largest size of the low-quality layer (Constants.tsx `VIDEO_QUALITY_LOW_WIDTH`, `VIDEO_QUALITY_LOW_HEIGHT`). */
private const val LOW_WIDTH = 640
private const val LOW_HEIGHT = 360

/** Bits per pixel below which a Go Live bitrate cap isn't lowered (Constants.tsx `BIT_FLOOR_PER_PIXEL`). */
private const val BIT_FLOOR_PER_PIXEL = 0.02

/** Pixel budget the ladder shares between video tiles (Constants.tsx `defaultVideoQualityOptions.videoBudget`). */
private const val BUDGET_WIDTH = 1280
private const val BUDGET_HEIGHT = 720

/** Tiles the ladder plans for, and the want each new size takes off (MediaSinkWantsLadder.tsx `calculateLadder`). */
private const val LADDER_MAX_TILES = 25
private const val LADDER_STEP = 10
private const val LADDER_MAX_HEIGHT = 4096
private const val ASPECT_WIDTH = 16
private const val ASPECT_HEIGHT = 9

/** Width and height must both have one of these remainders modulo 16, for encoder alignment. */
private val LADDER_ALIGNMENTS = setOf(0, 4, 8, 10)
private const val ALIGNMENT = 16

/** One size of the ladder: the largest 16:9 size that fits [want]'s tile count in the pixel budget. */
data class LadderStep(val width: Int, val height: Int, val want: Int) {
  /** The share of the budget this size uses, which scales the bitrate. */
  val budgetPortion get() = width.toDouble() * height / (BUDGET_WIDTH * BUDGET_HEIGHT)
}

/**
 * What one send layer does for the wants it got: whether it sends, at which height and with which bitrate cap.
 * [height] is the encoded height, the capture height divided by the downscale.
 */
data class LayerTarget(val active: Boolean, val height: Int, val maxBitrate: Int) {
  fun scaleDownBy(captureHeight: Int) = max(1.0, captureHeight.toDouble() / height)

  companion object {
    val OFF = LayerTarget(active = false, height = 0, maxBitrate = 0)
  }
}

/** Ladder steps from the smallest want to the largest, rebuilt from MediaSinkWantsLadder.tsx `calculateLadder`. */
private val LADDER: List<LadderStep> by lazy {
  val sizes = (1 until LADDER_MAX_HEIGHT)
    .filter { it % ASPECT_HEIGHT == 0 }
    .map { it * ASPECT_WIDTH / ASPECT_HEIGHT to it }
    .filter { (width, height) -> width % ALIGNMENT in LADDER_ALIGNMENTS && height % ALIGNMENT in LADDER_ALIGNMENTS }
  val budget = BUDGET_WIDTH * BUDGET_HEIGHT
  val steps = mutableListOf<LadderStep>()
  var want = WANT_ALL
  var lastWidth = 0
  for (tiles in 1..LADDER_MAX_TILES) {
    val (width, height) = sizes.lastOrNull { (w, h) -> w * h * tiles <= budget } ?: continue
    if (width == lastWidth) continue
    steps += LadderStep(width, height, want)
    want -= LADDER_STEP
    lastWidth = width
  }
  steps.filter { it.want > WANT_NONE }.reversed()
}

/** Returns the step for a want: the largest ladder want not above it (MediaSinkWantsLadder.tsx `getResolution`). */
fun ladderStep(want: Int): LadderStep = LADDER.lastOrNull { want >= it.want } ?: LADDER.first()

/**
 * Returns the target of a camera layer. The size follows the ladder, the low layer stays within 640x360 and
 * `full` quality mode never goes below the budget size (VideoQualityManager.tsx `getVideoQuality`, `frozen`).
 */
fun cameraTarget(layerQuality: Int, want: Int, full: Boolean): LayerTarget {
  if (want <= WANT_NONE) return LayerTarget.OFF
  val step = if (full) LadderStep(BUDGET_WIDTH, BUDGET_HEIGHT, WANT_ALL) else ladderStep(want)
  val low = layerQuality < QUALITY_HIGH
  val height = if (low) min(step.height, LOW_HEIGHT) else step.height
  val width = if (low) min(step.width, LOW_WIDTH) else step.width
  val cap = max(VIDEO_BITRATE_MAX * LadderStep(width, height, want).budgetPortion, VIDEO_BITRATE_FLOOR.toDouble())
  return LayerTarget(true, height, (if (low) cap / LOW_BITRATE_DIVISOR else cap).roundToInt())
}

/**
 * Returns the target of a Go Live layer, capped at [GO_LIVE_BITRATE_MAX] (`getDefaultGoliveQuality`). A viewer's
 * [pixelCount] scales the bitrate down linearly, never below a floor per pixel at the stream's [framerate]
 * (VideoQualityManager.tsx `getGoliveQuality`). The size follows the pixels.
 */
fun screenTarget(want: Int, pixelCount: Long, captureWidth: Int, captureHeight: Int, framerate: Int): LayerTarget {
  if (want <= WANT_NONE) return LayerTarget.OFF
  val full = captureWidth.toLong() * captureHeight
  if (pixelCount <= 0 || pixelCount >= full) return LayerTarget(true, captureHeight, GO_LIVE_BITRATE_MAX)
  val ratio = pixelCount.toDouble() / full
  val floor = min(BIT_FLOOR_PER_PIXEL * full * framerate, GO_LIVE_BITRATE_MAX.toDouble())
  val bitrate = max(ceil(GO_LIVE_BITRATE_MAX * ratio), floor)
  return LayerTarget(true, max(1, (captureHeight * sqrt(ratio)).roundToInt()), bitrate.roundToInt())
}
