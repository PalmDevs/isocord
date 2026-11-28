package me.palmdevs.isocord.voice

/** Voice gateway version (RTCControlSocket.tsx, getVoiceGatewayProtocolVersion). */
const val VOICE_GATEWAY_VERSION = 9

/** Voice gateway opcodes (RTCControlSocket.tsx `RTCSocketOpcode`, docs.discord.food Voice Opcodes). */
object VoiceOp {
  const val IDENTIFY = 0
  const val SELECT_PROTOCOL = 1
  const val READY = 2
  const val HEARTBEAT = 3
  const val SESSION_DESCRIPTION = 4
  const val SPEAKING = 5
  const val HEARTBEAT_ACK = 6
  const val RESUME = 7
  const val HELLO = 8
  const val RESUMED = 9
  const val CLIENT_CONNECT = 11
  const val VIDEO = 12
  const val CLIENT_DISCONNECT = 13
  const val SESSION_UPDATE = 14
  const val MEDIA_SINK_WANTS = 15
  const val DAVE_PREPARE_TRANSITION = 21
  const val DAVE_EXECUTE_TRANSITION = 22
  const val DAVE_READY_FOR_TRANSITION = 23
  const val DAVE_PREPARE_EPOCH = 24
  const val MLS_EXTERNAL_SENDER = 25
  const val MLS_KEY_PACKAGE = 26
  const val MLS_PROPOSALS = 27
  const val MLS_COMMIT_WELCOME = 28
  const val MLS_ANNOUNCE_COMMIT = 29
  const val MLS_WELCOME = 30
  const val MLS_INVALID_COMMIT_WELCOME = 31
  /** Sent when the media path has no route (RTCControlSocket.tsx `noRoute`, CLIENT_CANNOT_REACH_RTC_SERVER). */
  const val NO_ROUTE = 32
}

/**
 * Voice gateway close codes that end the connection instead of resuming (RTCControlSocket.tsx handleClose).
 * The last three come from docs.discord.food, Voice Close Codes: the client must not reconnect.
 */
object VoiceCloseCode {
  const val AUTHENTICATION_FAILED = 4004
  const val SESSION_NO_LONGER_VALID = 4006
  const val SERVER_NOT_FOUND = 4011
  const val CLIENT_DISCONNECTED = 4014
  const val VOICE_SERVER_CRASHED = 4015
  const val RATE_LIMITED = 4021
  const val ALL_CLIENTS_DISCONNECTED = 4022

  val FINAL = setOf(
    AUTHENTICATION_FAILED,
    SESSION_NO_LONGER_VALID,
    SERVER_NOT_FOUND,
    CLIENT_DISCONNECTED,
    VOICE_SERVER_CRASHED,
    RATE_LIMITED,
    ALL_CLIENTS_DISCONNECTED,
  )
}

/** Speaking flags (docs.discord.food, Speaking). */
object SpeakingFlag {
  const val NONE = 0
  const val VOICE = 1
  /** Context audio for a stream, no speaking indicator. */
  const val SOUNDSHARE = 2
  const val PRIORITY = 4
}

/** Stream structure `type` values (docs.discord.food, Stream Structure). */
object StreamType {
  const val VIDEO = "video"
  const val SCREEN = "screen"
}

/** Channel `video_quality_mode` values (docs.discord.food, Channel). Full means never scale our video down. */
object VideoQualityMode {
  const val AUTO = 1
  const val FULL = 2
}
