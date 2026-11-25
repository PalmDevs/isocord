import { createStore } from 'zustand/vanilla'
import { AccountNotificationFlags } from '../../core/discord/notificationSettings'
import { logger } from '../../core/log'
import { bytesToBase64 } from '../../core/protobuf'
import { defineStore } from '../../core/session'
import { nextMuteEnd } from '../unreadPolicy'
import {
    PRELOADED_SETTINGS,
    parseFolders,
    readCategories,
    readSettings,
    TEXT_AND_IMAGES,
    USER_SETTINGS,
} from './settingsProto'
import { parseGuildSettings } from './userGuildSettings'
import type { StoreApi } from 'zustand/vanilla'
import type {
    GuildFolder,
    TextAndImagesSettings,
    UserSettings,
} from './settingsProto'
import type { GuildSettings, RawGuildSettings } from './userGuildSettings'

const log = logger('UserSettings')

/** The longest delay `setTimeout` keeps: 2^31 - 1 ms, about 24 days. */
const MAX_TIMER_MS = 2_147_483_647

declare module '../../core/gateway/events' {
    interface ReadyPayload {
        /** Versioned: a `partial` one holds only the entries changed since the client's `user_guild_settings_version`. */
        user_guild_settings?: {
            version?: number
            partial?: boolean
            entries?: RawGuildSettings[]
        }
        /** Base64 PreloadedUserSettings protobuf. */
        user_settings_proto?: string
        /** Account-level notification settings; `flags` holds USE_NEW_NOTIFICATIONS and MENTION_ON_ALL_MESSAGES. */
        notification_settings?: { flags?: number }
    }
    interface GatewayEvents {
        USER_GUILD_SETTINGS_UPDATE: RawGuildSettings
        NOTIFICATION_SETTINGS_UPDATE: { flags?: number }
        USER_SETTINGS_PROTO_UPDATE: {
            settings: { type: number; proto: string }
            partial: boolean
        }
    }
}

/** SwipeRightToLeftMode: UNSET (0) means REPLY (ChatGestureSettings). */
export const SwipeRightToLeftMode = {
    CHANNEL_DETAILS: 1,
    REPLY: 2,
} as const

export interface SettingsState extends UserSettings {
    textAndImages: TextAndImagesSettings
    /** By guild id; private channel settings are under `@me`. */
    guildSettings: Record<string, GuildSettings>
    /** The user's server list, in order. */
    folders: GuildFolder[]
    /** The new notification system (AccountNotificationFlags.USE_NEW_NOTIFICATIONS): unread settings apply. */
    newNotifications?: boolean
    /** AccountNotificationFlags.MENTION_ON_ALL_MESSAGES: messages in all-messages channels count as low importance mentions. */
    mentionOnAllMessages?: boolean
    /**
     * Version of the entries held in `guildSettings`, from READY and later updates. Saved with them;
     * the next IDENTIFY sends it so the server only returns entries changed since. Absent when the
     * server gave no version.
     */
    guildSettingsVersion?: number
    /**
     * Each top-level PreloadedUserSettings field as last received, base64, by field number. Saving a
     * setting re-sends its whole category with one field changed. Unset until READY: nothing can be
     * saved before then.
     */
    categories?: Record<number, string>
    /**
     * Opt-in flag changes not saved yet, by guild then channel (UserGuildSettingsStore's pending channel updates).
     * They stay applied over the updates that arrive meanwhile.
     */
    pendingChannelFlags?: Record<string, Record<string, number>>
}

/** Applies a base64 PreloadedUserSettings message, whole or partial, to the store. */
export function applyProto(
    store: StoreApi<SettingsState>,
    proto: string | undefined,
): void {
    if (!proto) return
    try {
        const categories = readCategories(proto)
        const encoded: Record<number, string> = {}
        for (const [number, value] of categories)
            encoded[number] = bytesToBase64(value)
        const folders = parseFolders(categories)
        store.setState(state => ({
            ...readSettings(categories, USER_SETTINGS),
            categories: { ...state.categories, ...encoded },
            textAndImages: {
                ...state.textAndImages,
                ...readSettings(categories, TEXT_AND_IMAGES),
            },
            // The echo of our own save carries the same list: keep the current one so nothing re-renders.
            ...(folders && !sameFolders(folders, state.folders)
                ? { folders }
                : {}),
        }))
    } catch (error) {
        log.warn('Could not read the settings', error)
    }
}

function sameFolders(a: GuildFolder[], b: GuildFolder[]): boolean {
    return (
        a.length === b.length &&
        a.every((folder, i) => {
            const other = b[i]
            return (
                other !== undefined &&
                folder.id === other.id &&
                folder.name === other.name &&
                folder.color === other.color &&
                folder.guildIds.length === other.guildIds.length &&
                folder.guildIds.every((id, j) => id === other.guildIds[j])
            )
        })
    )
}

/** Lays opt-in changes not saved yet over freshly received settings. */
function withPendingFlags(
    settings: GuildSettings,
    pending: Record<string, number> | undefined,
): GuildSettings {
    if (!pending) return settings
    return {
        ...settings,
        channelFlags: { ...settings.channelFlags, ...pending },
    }
}

/** Reads the account notification flags into their store fields. */
function readAccountFlags(flags = 0) {
    return {
        newNotifications: Boolean(
            flags & AccountNotificationFlags.USE_NEW_NOTIFICATIONS,
        ),
        mentionOnAllMessages: Boolean(
            flags & AccountNotificationFlags.MENTION_ON_ALL_MESSAGES,
        ),
    }
}

/** Returns the account notification flags the store holds. */
export function accountFlagsOf(state: SettingsState): number {
    return (
        (state.newNotifications
            ? AccountNotificationFlags.USE_NEW_NOTIFICATIONS
            : 0) |
        (state.mentionOnAllMessages
            ? AccountNotificationFlags.MENTION_ON_ALL_MESSAGES
            : 0)
    )
}

/** MuteTimers: when the next timed mute ends, every guild's entry is renewed so what reads them is asked again. */
function renewAtMuteEnds(store: StoreApi<SettingsState>): void {
    let timer: ReturnType<typeof setTimeout> | undefined
    const renew = () =>
        store.setState(state => ({
            guildSettings: Object.fromEntries(
                Object.entries(state.guildSettings).map(([id, settings]) => [
                    id,
                    { ...settings },
                ]),
            ),
        }))
    store.subscribe((state, previous) => {
        if (state.guildSettings === previous.guildSettings) return
        clearTimeout(timer)
        const now = Date.now()
        const end = nextMuteEnd(state.guildSettings, now)
        // One ms past the end, the first moment the mute no longer holds.
        if (end !== undefined)
            timer = setTimeout(renew, Math.min(end - now + 1, MAX_TIMER_MS))
    })
}

export const settingsStore = defineStore(
    'settings',
    session => {
        const store = createStore<SettingsState>(() => ({
            guildSettings: {},
            folders: [],
            textAndImages: {},
        }))
        const { dispatch } = session.gateway
        renewAtMuteEnds(store)
        // LocaleStore: requests speak the account's language once known, the cached one until READY.
        store.subscribe(state => {
            if (state.locale) session.rest.identity.accountLocale = state.locale
        })

        dispatch.on('READY', ready => {
            const versioned = ready.user_guild_settings
            // A partial list holds only the entries changed since the version held: merge it onto those.
            const guildSettings: Record<string, GuildSettings> =
                versioned?.partial ? { ...store.getState().guildSettings } : {}
            for (const entry of versioned?.entries ?? []) {
                guildSettings[entry.guild_id ?? '@me'] =
                    parseGuildSettings(entry)
            }
            if (versioned?.partial) {
                // Entries of guilds the user has left are not worth keeping.
                const guilds = new Set(ready.guilds?.map(guild => guild.id))
                for (const id of Object.keys(guildSettings))
                    if (id !== '@me' && ready.guilds && !guilds.has(id))
                        delete guildSettings[id]
            }
            store.setState({
                guildSettings,
                folders: [],
                ...readAccountFlags(ready.notification_settings?.flags),
                guildSettingsVersion:
                    typeof versioned?.version === 'number'
                        ? versioned.version
                        : undefined,
                // READY carries the whole message.
                categories: {},
            })
            applyProto(store, ready.user_settings_proto)
        })
        // UserGuildSettingsStore's handleNotificationSettingsUpdate.
        dispatch.on('NOTIFICATION_SETTINGS_UPDATE', update =>
            store.setState(readAccountFlags(update.flags)),
        )
        dispatch.on('USER_GUILD_SETTINGS_UPDATE', entry =>
            store.setState(state => ({
                guildSettings: {
                    ...state.guildSettings,
                    [entry.guild_id ?? '@me']: withPendingFlags(
                        parseGuildSettings(entry),
                        state.pendingChannelFlags?.[entry.guild_id ?? '@me'],
                    ),
                },
                // A version only moves on top of one held.
                ...(state.guildSettingsVersion !== undefined &&
                typeof entry.version === 'number'
                    ? {
                          guildSettingsVersion: Math.max(
                              state.guildSettingsVersion,
                              entry.version,
                          ),
                      }
                    : {}),
            })),
        )
        session.registerClientState(() => {
            const { guildSettingsVersion } = store.getState()
            return guildSettingsVersion === undefined
                ? undefined
                : { user_guild_settings_version: guildSettingsVersion }
        })
        dispatch.on('USER_SETTINGS_PROTO_UPDATE', update => {
            if (update.settings.type === PRELOADED_SETTINGS)
                applyProto(store, update.settings.proto)
        })

        return store
    },
    {
        cache: [
            'guildSettings',
            'folders',
            'guildSettingsVersion',
            'textAndImages',
            'developerMode',
            'showInAppNotifications',
            'locale',
            'newNotifications',
            'mentionOnAllMessages',
        ],
    },
)

/** isSwipeToMemberListEnabled: swiping a chat leftward opens the channel details instead of replying. */
export const swipeOpensDetails = (state: {
    swipeRightToLeftMode?: number
}): boolean =>
    state.swipeRightToLeftMode === SwipeRightToLeftMode.CHANNEL_DETAILS

/** True once READY has given the settings to save against. */
export const canSaveSettings = (state: SettingsState): boolean =>
    state.categories !== undefined
