package me.palmdevs.isocord.voice.stream

import android.util.Size
import kotlinx.serialization.Serializable
import me.palmdevs.isocord.core.AppJson

/** Go Live heights (StreamSettingsConstants.tsx `ApplicationStreamResolutions`). [SOURCE] keeps the screen's size. */
object StreamResolution {
  const val R480 = 480
  const val R720 = 720
  const val R1080 = 1080
  const val R1440 = 1440
  const val SOURCE = 0

  val ALL = setOf(R480, R720, R1080, R1440, SOURCE)
}

/** Go Live frame rates (StreamSettingsConstants.tsx `ApplicationStreamFPS`). */
object StreamFramerate {
  const val FPS_5 = 5
  const val FPS_15 = 15
  const val FPS_30 = 30
  const val FPS_60 = 60

  val ALL = setOf(FPS_5, FPS_15, FPS_30, FPS_60)
}

/** Go Live presets (StreamSettingsConstants.tsx `ApplicationStreamPresets`). */
object StreamPreset {
  const val VIDEO = 1
  const val DOCUMENTS = 2
  const val CUSTOM = 3
  const val AUTO = 4
  const val MOBILE_DEFAULT = 5
  const val MOBILE_PERFORMANCE = 6
  const val MOBILE_HIGH_QUALITY = 7
}

/** Nitro levels a setting needs (PremiumConstants.tsx `StreamQualities`). */
object StreamPremiumQuality {
  const val HIGH = "high_streaming_quality"
  const val MID = "mid_streaming_quality"
}

/** Server boost tiers (Constants.tsx `BoostedGuildTiers`). */
private object BoostTier {
  const val TIER_1 = 1
  const val TIER_2 = 2
}

/** `max_resolution.type` of a stream (docs.discord.food, Stream Resolution). */
object StreamResolutionType {
  const val FIXED = "fixed"
  const val SOURCE = "source"
}

/** Go Live bitrate cap, bits per second (media-engine Constants.tsx `defaultVideoQualityOptions.desktopBitrate.max`). */
const val GO_LIVE_BITRATE_MAX = 3_500_000

/** Heights up to this use 4:3, taller ones 16:9 (native Connection.tsx `setGoLiveSource`). */
private const val NARROW_MAX_HEIGHT = 480
private const val NARROW_ASPECT_WIDTH = 4
private const val NARROW_ASPECT_HEIGHT = 3
private const val WIDE_ASPECT_WIDTH = 16
private const val WIDE_ASPECT_HEIGHT = 9

/** Clears the lowest bit: encoders want even sides. */
private const val EVEN = 1.inv()

/** One resolution and frame rate pair. */
@Serializable
data class StreamSetting(val resolution: Int, val fps: Int)

/**
 * One row of `ApplicationStreamSettingRequirements`. A row with [quality] needs that Nitro level, or the server's
 * [guildPremiumTier] when it has one. A row with [preset] belongs to that preset only.
 */
@Serializable
data class StreamRequirement(
  val resolution: Int,
  val fps: Int,
  val quality: String? = null,
  val guildPremiumTier: Int? = null,
  val preset: Int? = null,
)

/** The tables JS picks from (`getConstants().streamPresets`). */
@Serializable
private data class StreamTables(
  val presets: Map<Int, List<StreamSetting>>,
  val requirements: List<StreamRequirement>,
)

/** Settings tried in order per preset (getStreamSettingsForPreset.tsx `getApplicationStreamPresetValues`). */
val STREAM_PRESET_SETTINGS: Map<Int, List<StreamSetting>> = mapOf(
  StreamPreset.DOCUMENTS to listOf(
    StreamSetting(StreamResolution.SOURCE, StreamFramerate.FPS_15),
    StreamSetting(StreamResolution.SOURCE, StreamFramerate.FPS_5),
  ),
  StreamPreset.VIDEO to listOf(
    StreamSetting(StreamResolution.R1440, StreamFramerate.FPS_60),
    StreamSetting(StreamResolution.R1080, StreamFramerate.FPS_60),
    StreamSetting(StreamResolution.R720, StreamFramerate.FPS_60),
    StreamSetting(StreamResolution.R720, StreamFramerate.FPS_30),
  ),
  StreamPreset.AUTO to emptyList(),
  StreamPreset.CUSTOM to emptyList(),
  StreamPreset.MOBILE_DEFAULT to listOf(StreamSetting(StreamResolution.R720, StreamFramerate.FPS_30)),
  StreamPreset.MOBILE_PERFORMANCE to listOf(StreamSetting(StreamResolution.R480, StreamFramerate.FPS_30)),
  StreamPreset.MOBILE_HIGH_QUALITY to listOf(StreamSetting(StreamResolution.R1080, StreamFramerate.FPS_60)),
)

/** What each setting needs (StreamSettingsConstants.tsx `ApplicationStreamSettingRequirements`). */
val STREAM_SETTING_REQUIREMENTS: List<StreamRequirement> = listOf(
  StreamRequirement(StreamResolution.SOURCE, StreamFramerate.FPS_60, StreamPremiumQuality.HIGH),
  StreamRequirement(StreamResolution.SOURCE, StreamFramerate.FPS_30, StreamPremiumQuality.HIGH),
  StreamRequirement(StreamResolution.SOURCE, StreamFramerate.FPS_15, StreamPremiumQuality.HIGH),
  StreamRequirement(StreamResolution.SOURCE, StreamFramerate.FPS_5, preset = StreamPreset.DOCUMENTS),
  StreamRequirement(StreamResolution.R1440, StreamFramerate.FPS_60, StreamPremiumQuality.MID, BoostTier.TIER_2),
  StreamRequirement(StreamResolution.R1440, StreamFramerate.FPS_30, StreamPremiumQuality.MID, BoostTier.TIER_2),
  StreamRequirement(StreamResolution.R1440, StreamFramerate.FPS_15, StreamPremiumQuality.MID, BoostTier.TIER_2),
  StreamRequirement(StreamResolution.R1080, StreamFramerate.FPS_60, StreamPremiumQuality.MID, BoostTier.TIER_2),
  StreamRequirement(StreamResolution.R1080, StreamFramerate.FPS_30, StreamPremiumQuality.MID, BoostTier.TIER_2),
  StreamRequirement(StreamResolution.R1080, StreamFramerate.FPS_15, StreamPremiumQuality.MID, BoostTier.TIER_2),
  StreamRequirement(StreamResolution.R720, StreamFramerate.FPS_60, StreamPremiumQuality.MID, BoostTier.TIER_1),
  StreamRequirement(StreamResolution.R720, StreamFramerate.FPS_30),
  StreamRequirement(StreamResolution.R720, StreamFramerate.FPS_15),
  StreamRequirement(StreamResolution.R720, StreamFramerate.FPS_5),
  StreamRequirement(StreamResolution.R480, StreamFramerate.FPS_60, StreamPremiumQuality.MID, BoostTier.TIER_1),
  StreamRequirement(StreamResolution.R480, StreamFramerate.FPS_30),
  StreamRequirement(StreamResolution.R480, StreamFramerate.FPS_15),
  StreamRequirement(StreamResolution.R480, StreamFramerate.FPS_5),
)

/** The preset and requirement tables as JSON, for `getConstants()`. */
val STREAM_PRESETS_JSON: String by lazy {
  AppJson.encodeToString(StreamTables.serializer(), StreamTables(STREAM_PRESET_SETTINGS, STREAM_SETTING_REQUIREMENTS))
}

/** The quality our own stream sends: a height ([StreamResolution]) and a frame rate. */
data class StreamQuality(val resolution: Int, val framerate: Int) {
  /** The landscape box the height stands for (native Connection.tsx `setGoLiveSource`). 0 for the source size. */
  val boxWidth
    get() = if (resolution <= NARROW_MAX_HEIGHT) {
      resolution * NARROW_ASPECT_WIDTH / NARROW_ASPECT_HEIGHT
    } else {
      resolution * WIDE_ASPECT_WIDTH / WIDE_ASPECT_HEIGHT
    }

  /** Returns the capture size of a screen: within the box turned like the screen, never upscaled, even sides. */
  fun captureSize(screenWidth: Int, screenHeight: Int): Size {
    val portrait = screenHeight > screenWidth
    val (width, height) = when {
      resolution == StreamResolution.SOURCE -> screenWidth to screenHeight
      portrait -> resolution to boxWidth
      else -> boxWidth to resolution
    }
    val scale = minOf(width.toFloat() / screenWidth, height.toFloat() / screenHeight, 1f)
    return Size((screenWidth * scale).toInt() and EVEN, (screenHeight * scale).toInt() and EVEN)
  }

  companion object {
    /** The fallback without quality options (MediaEngineStore.tsx `MEDIA_ENGINE_SET_GO_LIVE_SOURCE`). */
    val DEFAULT = StreamQuality(StreamResolution.R720, StreamFramerate.FPS_30)

    /** Returns the requested quality, or [DEFAULT] when a value is missing or unknown. */
    fun of(resolution: Int?, framerate: Int?): StreamQuality {
      if (resolution == null || framerate == null) return DEFAULT
      if (resolution !in StreamResolution.ALL || framerate !in StreamFramerate.ALL) return DEFAULT
      return StreamQuality(resolution, framerate)
    }
  }
}
