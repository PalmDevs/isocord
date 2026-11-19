import { randomUUID } from 'expo-crypto'
import { AppState } from 'react-native'
import { CLIENT } from '../constants'
import {
    accountCookieScope,
    deleteCookieScope,
    moveCookieScope,
    systemLanguage,
} from '../network'
import { accountStorage, deviceStorage } from '../storage'
import { randomDeviceProfile, realDeviceProfile } from './devices'
import type { MMKV } from 'react-native-mmkv'
import type { DeviceProfile } from './devices'

/** Where builds before per-account identities kept the one device vendor id every account shared. */
const LEGACY_VENDOR_ID_KEY = 'deviceVendorId'
const VENDOR_ID_KEY = 'deviceVendorId'
const HEARTBEAT_KEY = 'heartbeatSession'
const DEVICE_PROFILE_KEY = 'deviceProfile'
/** SESSION_IDLE_TIMEOUT_MILLIS (SessionUtils): a heartbeat session ends after this long unused. */
const HEARTBEAT_IDLE_MS = 30 * 60 * 1000

/** The languages the reference can show (metro module 01187, `enabled` ones), in its order. */
const LOCALES = [
    'en-US',
    'en-GB',
    'zh-CN',
    'zh-TW',
    'cs',
    'da',
    'nl',
    'fr',
    'de',
    'el',
    'hu',
    'it',
    'ja',
    'ko',
    'pl',
    'pt-BR',
    'ru',
    'es-419',
    'es-ES',
    'sv-SE',
    'tr',
    'bg',
    'uk',
    'fi',
    'no',
    'hr',
    'ro',
    'lt',
    'th',
    'vi',
    'hi',
]
const LOCALE_ALIASES: Record<string, string> = {
    es: 'es-ES',
    nb: 'no',
    nn: 'no',
}

/** getNormalizedLocale (intl/util.tsx): the system language mapped onto a language the client has. */
function normalizeLocale(language: string, fallback: string): string {
    if (LOCALES.includes(language)) return language
    const parts = language.split('-')
    const base = parts[0]!
    if (LOCALES.includes(base)) return base
    const alias = parts.length === 1 ? LOCALE_ALIASES[base] : undefined
    if (alias && LOCALES.includes(alias)) return alias
    if (base === 'zh') return LOCALES.find(code => code === 'zh-TW') ?? fallback
    return LOCALES.find(code => code.split('-')[0] === base) ?? fallback
}

/** `initialLocale` (intl/index.native.tsx): the locale until the account's own setting is known. */
const initialLocale = normalizeLocale(systemLanguage, 'en-US')

export const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

/**
 * What LIBDISCORE_JSI.generateLaunchSignature currently returns in the official
 * client: the launch time as a Unix timestamp in nanoseconds.
 */
function generateLaunchSignature(): string {
    const submillisecond = Math.floor((performance.now() % 1) * 1_000_000)
    return `${Date.now()}${String(submillisecond).padStart(6, '0')}`
}

/** encodeProperties (HTTPUtils): base64 of the UTF-8 JSON. */
export function encodeProperties(value: unknown): string {
    // btoa only accepts Latin-1, so the JSON is first reduced to UTF-8 bytes.
    const utf8 = encodeURIComponent(JSON.stringify(value)).replace(
        /%([0-9A-F]{2})/g,
        (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)),
    )
    return btoa(utf8)
}

/**
 * Holds what identifies the client to Discord for one account: install ids, launch ids, cookies.
 * The official client shares one between all accounts, which lets Discord tie them together.
 * Isocord gives every account its own. A login in progress gets a fresh one that the account keeps.
 */
export class ClientIdentity {
    /** clientLaunchId; a session start counts as a launch. */
    private readonly launchId = randomUUID()
    private readonly launchSignature = generateLaunchSignature()
    /** The account's `localization.locale` setting, once READY has told (LocaleStore). */
    accountLocale: string | undefined

    private encodedFor: string | null = null
    private encoded = ''

    constructor(
        readonly cookieScope: string,
        readonly deviceVendorId: string,
        /** The phone this account claims to be. */
        readonly deviceProfile: DeviceProfile,
        /** Account storage for the heartbeat session; a login in progress keeps it in memory. */
        private readonly storage: MMKV | null,
    ) {}

    /** `X-Discord-Locale`: LocaleStore.locale. */
    get locale(): string {
        return this.accountLocale ?? initialLocale
    }

    /** The super properties, in the key order of the official client's payload. */
    superProperties() {
        return {
            os: 'Android',
            browser: 'Discord Android',
            device: this.deviceProfile.device,
            device_model_name: this.deviceProfile.model,
            system_locale: systemLanguage,
            has_client_mods: false,
            client_version: CLIENT.version,
            release_channel: CLIENT.releaseChannel,
            device_vendor_id: this.deviceVendorId,
            design_id: CLIENT.designId,
            browser_user_agent: '',
            browser_version: '',
            os_version: this.deviceProfile.osVersion,
            client_build_number: CLIENT.buildNumber,
            client_event_source: null,
            client_launch_id: this.launchId,
            install_source: CLIENT.installSource,
            launch_signature: this.launchSignature,
            client_app_state: AppState.currentState,
            client_heartbeat_session_id: this.heartbeatSession(),
        }
    }

    /** Base64 of the super properties, as sent in X-Super-Properties. Re-encoded when the dynamic ones change. */
    encodedSuperProperties(): string {
        const key = `${AppState.currentState}:${this.heartbeatSession()}`
        if (this.encodedFor !== key) {
            this.encoded = encodeProperties(this.superProperties())
            this.encodedFor = key
        }
        return this.encoded
    }

    private memoryHeartbeat: { uuid: string; lastUsed: number } | null = null

    /**
     * SessionHeartbeatScheduler's session: kept until it goes unused for 30 minutes, and dropped when the
     * account logs in or is switched to (`clearHeartbeatSession`). Used while the app is in the foreground.
     */
    private heartbeatSession(): string {
        const now = Date.now()
        const raw = this.storage?.getString(HEARTBEAT_KEY)
        let session = this.storage
            ? raw
                ? (JSON.parse(raw) as { uuid: string; lastUsed: number })
                : null
            : this.memoryHeartbeat
        if (!session || now - session.lastUsed >= HEARTBEAT_IDLE_MS)
            session = { uuid: randomUUID(), lastUsed: now }
        else if (AppState.currentState === 'active') session.lastUsed = now
        else return session.uuid
        if (this.storage)
            this.storage.set(HEARTBEAT_KEY, JSON.stringify(session))
        else this.memoryHeartbeat = session
        return session.uuid
    }
}

/** The identity of a stored account. */
export function accountIdentity(userId: string, storage: MMKV): ClientIdentity {
    let vendorId = storage.getString(VENDOR_ID_KEY)
    if (!vendorId) {
        // The id every account used to share stays with the first account that asks for it.
        vendorId = deviceStorage.getString(LEGACY_VENDOR_ID_KEY) ?? randomUUID()
        deviceStorage.remove(LEGACY_VENDOR_ID_KEY)
        storage.set(VENDOR_ID_KEY, vendorId)
    }
    // Accounts added before device profiles existed keep the real phone, so their device never seems to change.
    const profile = storage.getString(DEVICE_PROFILE_KEY)
    return new ClientIdentity(
        accountCookieScope(userId),
        vendorId,
        profile ? (JSON.parse(profile) as DeviceProfile) : realDeviceProfile(),
        storage,
    )
}

/** A fresh identity for a login, like a first launch after installing. */
export function loginIdentity(): ClientIdentity {
    return new ClientIdentity(
        `login:${randomUUID()}`,
        randomUUID(),
        randomDeviceProfile(),
        null,
    )
}

/** Makes a login's identity the account's: its device vendor id, its phone and the cookies the login received. */
export function adoptLoginIdentity(
    identity: ClientIdentity,
    userId: string,
): void {
    const storage = accountStorage(userId)
    storage.set(VENDOR_ID_KEY, identity.deviceVendorId)
    storage.set(DEVICE_PROFILE_KEY, JSON.stringify(identity.deviceProfile))
    moveCookieScope(identity.cookieScope, accountCookieScope(userId))
}

/** Drops an account's cookies. Its storage (vendor id, heartbeat) is cleared by removeAccount. */
export function forgetAccountIdentity(userId: string): void {
    deleteCookieScope(accountCookieScope(userId))
}

/** SessionHeartbeatScheduler drops the heartbeat session when the authenticated account changes. */
export function clearHeartbeatSession(userId: string): void {
    accountStorage(userId).remove(HEARTBEAT_KEY)
}
