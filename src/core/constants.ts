import {
    clientVersionCode,
    clientVersionName,
    discord,
} from '../native/IsocordConstants'

/** The official client build Isocord identifies as. Kotlin's `ClientBuild` owns the version. */
export const CLIENT = {
    /** Android versionCode of the reference APK. */
    versionCode: clientVersionCode,
    /** `client_version` super property. Android appends " - rn". */
    version: `${clientVersionName} - rn`,
    /** The versionCode followed by eight zeros. */
    buildNumber: clientVersionCode * 100_000_000,
    releaseChannel: 'googleRelease',
    /** Installer package reported as `install_source`: the Play Store. */
    installSource: 'com.android.vending',
    /** DesignIds.DESIGN_TABS_IA */
    designId: 2,
} as const

/** Discord's endpoints. Kotlin's `Discord` owns them. */
export const API_VERSION = discord.apiVersion
export const API_BASE = discord.apiBase
export const DEFAULT_GATEWAY_URL = discord.gatewayUrl
export const WEBSOCKET_ORIGIN = discord.websocketOrigin
export const CDN_BASE = discord.cdnBase
/** The web app, whose `/channels/...` paths are permalinks. */
export const WEB_URL = discord.webUrl
export const MEDIA_BASE = 'https://media.discordapp.net'

/** getClientCapabilities() in the reference client, without channel obfuscation. */
export const GATEWAY_CAPABILITIES = 1734655

export const MAX_ACCOUNTS = 5
