package me.palmdevs.isocord.voice.rtc

/** One m-section of our local offer. */
data class OfferSection(
  val kind: String,
  val mid: String,
  val direction: String,
  /** First `a=ssrc` of the section, set on sections we send on. */
  val ssrc: Long?,
  /** RTX SSRC of the section's `a=ssrc-group:FID`. */
  val rtxSsrc: Long?,
  val extmaps: List<String>,
  /** `a=rtpmap` payload type to `name/clock[/channels]`. */
  val rtpmaps: Map<Int, String>,
  /** `a=fmtp` payload type to its parameters. */
  val fmtps: Map<Int, String>,
)

/** A video codec we decode, with its RTX payload, as offered by libwebrtc. */
data class VideoCodec(val name: String, val payloadType: Int, val rtxPayloadType: Int?, val fmtp: String?)

/** The SSRCs the server assigned to one of our send sections. */
data class SsrcPair(val ssrc: Long, val rtxSsrc: Long?)

/** A remote user's stream, received on one of our recvonly sections. */
data class RemoteStream(val userId: String, val ssrc: Long, val rtxSsrc: Long? = null)

/** Offer fragment lines kept for Select Protocol (docs.discord.food, WebRTC connections). */
private val FRAGMENT_LINE = Regex("^a=(extmap-allow-mixed|ice-|fingerprint|extmap:).*")
private val OPUS_RTPMAP = Regex("^a=rtpmap:(\\d+) opus/48000/2$", RegexOption.IGNORE_CASE)
private val RTPMAP = Regex("^a=rtpmap:(\\d+) ")
private val SSRC_ATTRIBUTE = Regex("^a=ssrc:(\\d+)")

/** Reserved for probe packets (docs.discord.food, WebRTC connections). */
private const val PROBE_PAYLOAD_TYPE = 96

/** Dynamic payload types libwebrtc may use (RFC 3551, RFC 7587). */
private val DYNAMIC_PAYLOAD_TYPES = (97..127) + (35..63)

/** Extensions the answer keeps for audio. */
private val AUDIO_EXTENSIONS =
  listOf("urn:ietf:params:rtp-hdrext:ssrc-audio-level", "transport-wide-cc-extensions")

/** Extensions the answer keeps for video (docs.discord.food, WebRTC answer). */
private val VIDEO_EXTENSIONS = listOf(
  "urn:ietf:params:rtp-hdrext:toffset",
  "abs-send-time",
  "urn:3gpp:video-orientation",
  "transport-wide-cc-extensions",
  "playout-delay",
)

/** Video codecs in our preference order, as Discord names them. */
private val VIDEO_CODEC_NAMES = listOf("H264", "VP8", "VP9", "AV1")

/** H264 constrained baseline, packetization mode 1 (docs.discord.food, WebRTC answer). */
private const val H264_PROFILE = "profile-level-id=42e01f"
private const val H264_PACKETIZATION = "packetization-mode=1"

private val VIDEO_FEEDBACK = listOf("ccm fir", "nack", "nack pli", "goog-remb", "transport-cc")

/** Session-level answer lines (docs.discord.food, WebRTC answer). */
private const val ANSWER_ORIGIN = "o=- 1420070400000 0 IN IP4 127.0.0.1"

/** Builds the voice gateway's WebRTC SDP: our offer fragment and the answer from the server's template. */
object VoiceSdp {
  fun lines(sdp: String): List<String> = sdp.split("\r\n", "\n").filter { it.isNotBlank() }

  fun opusPayloadType(offer: String): Int =
    lines(offer).firstNotNullOf { OPUS_RTPMAP.find(it)?.groupValues?.get(1)?.toInt() }

  /** Returns the decodable video codecs of the first video section, one per name, in preference order. */
  fun videoCodecs(sections: List<OfferSection>): List<VideoCodec> {
    val video = sections.firstOrNull { it.kind == "video" } ?: return emptyList()
    val rtx = video.fmtps.entries
      .filter { video.rtpmaps[it.key]?.startsWith("rtx/") == true }
      .associate { it.value.substringAfter("apt=").toInt() to it.key }
    return VIDEO_CODEC_NAMES.mapNotNull { name ->
      val candidates = video.rtpmaps.filterValues { it.substringBefore('/').equals(name, ignoreCase = true) }.keys
      val payloadType = if (name == "H264") {
        candidates.firstOrNull { pt -> video.fmtps[pt].let { it != null && H264_PROFILE in it && H264_PACKETIZATION in it } }
          ?: candidates.firstOrNull()
      } else {
        candidates.firstOrNull()
      }
      payloadType?.let { VideoCodec(name, it, rtx[it], video.fmtps[it]) }
    }
  }

  /** Returns the offer with payload type 96 moved to a free one, as Discord probes on 96. */
  fun avoidProbePayloadType(offer: String): String {
    val offerLines = lines(offer)
    val used = offerLines.mapNotNull { RTPMAP.find(it)?.groupValues?.get(1)?.toInt() }.toSet()
    if (PROBE_PAYLOAD_TYPE !in used) return offer
    val probe = PROBE_PAYLOAD_TYPE.toString()
    val free = DYNAMIC_PAYLOAD_TYPES.first { it !in used }.toString()
    val attribute = Regex("^a=(rtpmap|fmtp|rtcp-fb):$probe ")
    return offerLines.joinToString("\r\n", postfix = "\r\n") { line ->
      when {
        line.startsWith("m=") ->
          line.split(' ').mapIndexed { index, token -> if (index >= 3 && token == probe) free else token }.joinToString(" ")
        attribute.containsMatchIn(line) -> line.replaceFirst(":$probe ", ":$free ")
        else -> line.replace(Regex("apt=$probe$"), "apt=$free")
      }
    }
  }

  /**
   * Returns the offer with the send sections' SSRCs replaced by the assigned ones, keyed by mid. libwebrtc sends
   * with the SSRCs of the local description, so the server's READY `streams` take effect this way.
   */
  fun assignSsrcs(offer: String, assigned: Map<String, SsrcPair>): String {
    val sections = sections(offer).associateBy { it.mid }
    var renames = emptyMap<String, String>()
    val out = lines(offer).map { line ->
      when {
        line.startsWith("m=") -> line.also { renames = emptyMap() }
        line.startsWith("a=mid:") -> line.also {
          val mid = line.substringAfter(':')
          renames = renames(sections[mid], assigned[mid])
        }
        line.startsWith("a=ssrc:") ->
          SSRC_ATTRIBUTE.replace(line) { "a=ssrc:" + (renames[it.groupValues[1]] ?: it.groupValues[1]) }
        line.startsWith("a=ssrc-group:") -> line.split(' ').joinToString(" ") { renames[it] ?: it }
        else -> line
      }
    }
    return out.joinToString("\r\n", postfix = "\r\n")
  }

  private fun renames(section: OfferSection?, assigned: SsrcPair?): Map<String, String> {
    val ssrc = section?.ssrc ?: return emptyMap()
    if (assigned == null) return emptyMap()
    return buildMap {
      put("$ssrc", "${assigned.ssrc}")
      val rtx = section.rtxSsrc
      if (rtx != null && assigned.rtxSsrc != null) put("$rtx", "${assigned.rtxSsrc}")
    }
  }

  /** Returns the stripped offer sent in Select Protocol `data`. */
  fun fragment(offer: String): String =
    lines(offer).filter { FRAGMENT_LINE.matches(it) || OPUS_RTPMAP.matches(it) }.distinct().joinToString("\n")

  fun sections(offer: String): List<OfferSection> {
    val result = mutableListOf<OfferSection>()
    var kind: String? = null
    var mid = ""
    var direction = "sendrecv"
    var ssrc: Long? = null
    var rtxSsrc: Long? = null
    val extmaps = mutableListOf<String>()
    val rtpmaps = mutableMapOf<Int, String>()
    val fmtps = mutableMapOf<Int, String>()
    fun flush() {
      kind?.let { result += OfferSection(it, mid, direction, ssrc, rtxSsrc, extmaps.toList(), rtpmaps.toMap(), fmtps.toMap()) }
    }
    for (line in lines(offer)) {
      when {
        line.startsWith("m=") -> {
          flush()
          kind = line.substring(2).substringBefore(' ')
          mid = ""
          direction = "sendrecv"
          ssrc = null
          rtxSsrc = null
          extmaps.clear()
          rtpmaps.clear()
          fmtps.clear()
        }
        kind == null -> Unit
        line.startsWith("a=mid:") -> mid = line.substringAfter(':')
        line in DIRECTIONS -> direction = line.substring(2)
        line.startsWith("a=ssrc:") && ssrc == null -> ssrc = line.substringAfter(':').substringBefore(' ').toLong()
        line.startsWith("a=ssrc-group:FID ") -> rtxSsrc = line.split(' ')[2].toLong()
        line.startsWith("a=extmap:") -> extmaps += line
        line.startsWith("a=rtpmap:") ->
          rtpmaps[line.substringAfter(':').substringBefore(' ').toInt()] = line.substringAfter(' ')
        line.startsWith("a=fmtp:") -> fmtps[line.substringAfter(':').substringBefore(' ').toInt()] = line.substringAfter(' ')
      }
    }
    flush()
    return result
  }

  /**
   * Returns the remote answer for our offer, from the server's Session Description `sdp`.
   * Our send video section gets only `sendCodec`, the call's codec, so libwebrtc encodes that one.
   */
  fun answer(
    offer: List<OfferSection>,
    server: String,
    opusPayloadType: Int,
    videoCodecs: List<VideoCodec>,
    sendCodec: VideoCodec?,
    remote: Map<String, RemoteStream>,
  ): String {
    val serverLines = lines(server)
    val transport = serverLines.filter {
      it.startsWith("c=") ||
        it.startsWith("a=ice-ufrag:") ||
        it.startsWith("a=ice-pwd:") ||
        it.startsWith("a=fingerprint:") ||
        it.startsWith("a=candidate:")
    }
    val port = serverLines.firstOrNull { it.startsWith("m=") }?.split(' ')?.getOrNull(1)
      ?: serverLines.first { it.startsWith("a=candidate:") }.split(' ')[5]
    val out = mutableListOf(
      "v=0",
      ANSWER_ORIGIN,
      "s=-",
      "t=0 0",
      "a=group:BUNDLE ${offer.joinToString(" ") { it.mid }}",
      "a=msid-semantic: WMS *",
    )
    for (section in offer) {
      val stream = remote[section.mid]
      val video = section.kind == "video"
      val codecs = if (section.direction != "recvonly") listOfNotNull(sendCodec) else videoCodecs
      val payloads = if (video) codecs.flatMap { listOfNotNull(it.payloadType, it.rtxPayloadType) } else listOf(opusPayloadType)
      out += "m=${section.kind} $port UDP/TLS/RTP/SAVPF ${payloads.joinToString(" ")}"
      out += transport
      out += "a=setup:passive"
      out += "a=mid:${section.mid}"
      out += "a=rtcp-mux"
      out += "a=${answerDirection(section.direction, stream != null)}"
      if (video) {
        out += videoCodecLines(codecs)
        out += section.extmaps.filter { line -> VIDEO_EXTENSIONS.any { it in line } }
      } else {
        out += "a=rtpmap:$opusPayloadType opus/48000/2"
        out += "a=fmtp:$opusPayloadType minptime=10;useinbandfec=1;usedtx=1"
        out += "a=maxptime:60"
        out += "a=rtcp-fb:$opusPayloadType transport-cc"
        out += section.extmaps.filter { line -> AUDIO_EXTENSIONS.any { it in line } }
      }
      stream?.let { out += ssrcLines(it, if (video) "v" else "a") }
    }
    return out.joinToString("\r\n", postfix = "\r\n")
  }

  private fun videoCodecLines(codecs: List<VideoCodec>): List<String> =
    codecs.flatMap { codec ->
      val pt = codec.payloadType
      buildList {
        add("a=rtpmap:$pt ${codec.name}/90000")
        codec.fmtp?.let { add("a=fmtp:$pt $it") }
        VIDEO_FEEDBACK.forEach { add("a=rtcp-fb:$pt $it") }
        codec.rtxPayloadType?.let {
          add("a=rtpmap:$it rtx/90000")
          add("a=fmtp:$it apt=$pt")
        }
      }
    }

  /** Per-SSRC lines for one remote stream; `kind` is the msid sentinel, `a` or `v`. */
  private fun ssrcLines(stream: RemoteStream, kind: String): List<String> {
    val label = "${stream.userId}-${stream.ssrc}"
    return buildList {
      add("a=msid:$label $kind$label")
      stream.rtxSsrc?.let { add("a=ssrc-group:FID ${stream.ssrc} $it") }
      add("a=ssrc:${stream.ssrc} cname:$label")
      stream.rtxSsrc?.let { add("a=ssrc:$it cname:$label") }
    }
  }

  /** Maps an offer direction to the answer's (docs.discord.food, WebRTC answer). */
  private fun answerDirection(offered: String, assigned: Boolean): String =
    when (offered) {
      "recvonly" -> if (assigned) "sendonly" else "inactive"
      "sendonly" -> "recvonly"
      "sendrecv" -> if (assigned) "sendrecv" else "recvonly"
      else -> "inactive"
    }

  private val DIRECTIONS = setOf("a=sendrecv", "a=sendonly", "a=recvonly", "a=inactive")
}
