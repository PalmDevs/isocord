package me.palmdevs.isocord.network

/** Discord's endpoints. JS reads them through `getConstants()`. */
object Discord {
  const val API_VERSION = 9
  const val API_BASE = "https://discord.com/api/v$API_VERSION"
  const val GATEWAY_URL = "wss://gateway.discord.gg"

  /** `"https:" + GLOBAL_ENV.WEBAPP_ENDPOINT` in the official client. */
  const val WEB_URL = "https://discord.com"

  /** GLOBAL_ENV.NATIVE_WEBSOCKET_ORIGIN in the official client. The gateway refuses other origins. */
  const val WEBSOCKET_ORIGIN = WEB_URL
  const val CDN_BASE = "https://cdn.discordapp.com"
}
