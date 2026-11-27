import { Endpoint } from '../../core/api/paths'
import {
    ApiError,
    HTTP_SERVER_ERROR,
    HTTP_TOO_MANY_REQUESTS,
} from '../../core/api/rest'
import { GuildMemberFlags } from '../../core/discord/guild'
import {
    ChannelNotificationSettingsFlags,
    GuildNotificationSettingsFlags,
    UnreadSetting,
} from '../../core/discord/notificationSettings'
import {
    base64ToBytes,
    bytesToBase64,
    concatBytes,
    withoutField,
    writeBytesField,
} from '../../core/protobuf'
import { SECOND } from '../../core/time'
import { emitPresenceUpdate } from '../selfPresence'
import { isOptInEnabled, isOptInEnabledForGuild } from '../unreadPolicy'
import { updateGuildSettings } from './notificationActions'
import {
    CUSTOM_STATUS,
    encodeFolders,
    PRELOADED_SETTINGS,
    TEXT_AND_IMAGES,
    USER_SETTINGS,
    writeSetting,
} from './settingsProto'
import { accountFlagsOf, applyProto, settingsStore } from './settingsStore'
import { parseGuildSettings, unreadSettingOf } from './userGuildSettings'
import type { Session } from '../../core/session'
import type {
    CustomStatus,
    GuildFolder,
    SettingDescriptor,
} from './settingsProto'

/**
 * Coalesces rapid category taps and in-flight updates (UserGuildSettingsManager). A failed save is
 * retried here with backoff, so the REST call asks for no retries of its own.
 */
const COLLAPSE_SAVE_DELAY_MS = 500
const COLLAPSE_RETRY_BASE_MS = 1000
const COLLAPSE_RETRY_MAX_MS = 15_000
const COLLAPSE_MAX_ATTEMPTS = 5

const collapseSaveTimers = new WeakMap<
    Session,
    Map<string, ReturnType<typeof setTimeout>>
>()
const collapseSaveInFlight = new WeakMap<Session, Set<string>>()

function scheduleCollapseSave(
    session: Session,
    guildId: string,
    delayMs: number,
    attempt = 0,
): void {
    let timers = collapseSaveTimers.get(session)
    if (!timers) collapseSaveTimers.set(session, (timers = new Map()))
    clearTimeout(timers.get(guildId))
    timers.set(
        guildId,
        setTimeout(() => {
            timers?.delete(guildId)
            saveCollapsedCategories(session, guildId, attempt)
        }, delayMs),
    )
}

function clearPendingCollapsed(
    session: Session,
    guildId: string,
    sent: Record<string, boolean>,
): void {
    session.get(settingsStore).setState(state => {
        const pending = { ...state.pendingCollapsedCategories?.[guildId] }
        for (const [id, collapsed] of Object.entries(sent))
            if (pending[id] === collapsed) delete pending[id]
        return {
            pendingCollapsedCategories: {
                ...state.pendingCollapsedCategories,
                [guildId]: pending,
            },
        }
    })
}

function isRetryableCollapseError(error: unknown): boolean {
    if (!(error instanceof ApiError)) return true
    return (
        error.status === HTTP_TOO_MANY_REQUESTS ||
        error.status >= HTTP_SERVER_ERROR
    )
}

function collapseRetryDelay(error: unknown, attempt: number): number {
    if (error instanceof ApiError && error.retryAfter != null)
        return Math.max(error.retryAfter * SECOND, COLLAPSE_SAVE_DELAY_MS)
    return Math.min(
        COLLAPSE_RETRY_BASE_MS * 2 ** attempt,
        COLLAPSE_RETRY_MAX_MS,
    )
}

function saveCollapsedCategories(
    session: Session,
    guildId: string,
    attempt = 0,
): void {
    let inFlight = collapseSaveInFlight.get(session)
    if (inFlight?.has(guildId)) return
    const sent = session.get(settingsStore).getState()
        .pendingCollapsedCategories?.[guildId]
    if (!sent || Object.keys(sent).length === 0) return
    if (!inFlight) collapseSaveInFlight.set(session, (inFlight = new Set()))
    inFlight.add(guildId)

    const channel_overrides = Object.fromEntries(
        Object.entries(sent).map(([id, collapsed]) => [id, { collapsed }]),
    )
    session.rest
        .patch(Endpoint.myGuildSettings(guildId), {
            body: { channel_overrides },
        })
        .then(() => {
            inFlight.delete(guildId)
            clearPendingCollapsed(session, guildId, sent)
            const remaining = session.get(settingsStore).getState()
                .pendingCollapsedCategories?.[guildId]
            if (remaining && Object.keys(remaining).length > 0)
                scheduleCollapseSave(session, guildId, COLLAPSE_SAVE_DELAY_MS)
        })
        .catch(error => {
            inFlight.delete(guildId)
            if (
                isRetryableCollapseError(error) &&
                attempt < COLLAPSE_MAX_ATTEMPTS
            ) {
                scheduleCollapseSave(
                    session,
                    guildId,
                    collapseRetryDelay(error, attempt),
                    attempt + 1,
                )
                return
            }
            clearPendingCollapsed(session, guildId, sent)
        })
}

/** Collapses or expands a category, optimistically, the way the reference client persists it. */
export function setCategoryCollapsed(
    session: Session,
    guildId: string,
    categoryId: string,
    collapsed: boolean,
): void {
    session.get(settingsStore).setState(state => {
        const current =
            state.guildSettings[guildId] ??
            parseGuildSettings({ guild_id: guildId })
        const { [categoryId]: _removed, ...rest } = current.collapsedCategories
        const collapsedCategories = collapsed
            ? { ...rest, [categoryId]: true as const }
            : rest
        return {
            guildSettings: {
                ...state.guildSettings,
                [guildId]: { ...current, collapsedCategories },
            },
            pendingCollapsedCategories: {
                ...state.pendingCollapsedCategories,
                [guildId]: {
                    ...state.pendingCollapsedCategories?.[guildId],
                    [categoryId]: collapsed,
                },
            },
        }
    })
    scheduleCollapseSave(session, guildId, COLLAPSE_SAVE_DELAY_MS)
}

/**
 * Saves the server list order and folders: optimistic locally, then
 * `PATCH /users/@me/settings-proto/1` with a base64 PreloadedUserSettings
 * carrying `guild_folders`, as the reference does.
 */
export function saveGuildFolders(
    session: Session,
    folders: GuildFolder[],
): void {
    session.get(settingsStore).setState({ folders })
    session.rest
        .patch(Endpoint.settingsProto(PRELOADED_SETTINGS), {
            body: { settings: bytesToBase64(encodeFolders(folders)) },
        })
        .catch(() => {})
}

/**
 * Saves one setting, like the reference's `updateAsync`: the category's other fields are kept
 * (`createModifiedProto`), the change applies locally at once, then
 * `PATCH /users/@me/settings-proto/1` sends the whole category. Does nothing before READY, when
 * the categories are not known yet.
 */
function saveSetting<T>(
    session: Session,
    descriptor: SettingDescriptor<T>,
    value: T,
): void {
    const store = session.get(settingsStore)
    const categories = store.getState().categories
    if (!categories) return
    const [category, number] = descriptor.path
    const current = categories[category]
    const kept = withoutField(
        current ? base64ToBytes(current) : new Uint8Array(),
        number,
    )
    const message = concatBytes([kept, writeSetting(descriptor, value)])
    const proto = bytesToBase64(writeBytesField(category, message))
    applyProto(store, proto)
    session.rest
        .patch(Endpoint.settingsProto(PRELOADED_SETTINGS), {
            body: { settings: proto },
        })
        .catch(() => {})
}

/** UserSettings.DeveloperMode. */
export const setDeveloperMode = (session: Session, value: boolean) =>
    saveSetting(session, USER_SETTINGS.developerMode, value)

/** UserSettings.SwipeRightToLeftModeSetting. */
export const setSwipeRightToLeftMode = (session: Session, mode: number) =>
    saveSetting(session, USER_SETTINGS.swipeRightToLeftMode, mode)

/** IgnoreProfileSpeedbumpDisabled: "Don't show this again" on an ignored user's speed bump. */
export const setIgnoreProfileSpeedbumpDisabled = (
    session: Session,
    value: boolean,
) => saveSetting(session, USER_SETTINGS.ignoreProfileSpeedbumpDisabled, value)

/** UserSettings.AnimateEmoji. */
export const setAnimateEmoji = (session: Session, value: boolean) =>
    saveSetting(session, TEXT_AND_IMAGES.animateEmoji, value)

/**
 * setCustomStatus: trims the text, and clears the status when neither text nor emoji is left.
 * `expiresAtMs` absent or "0" never clears it.
 * Then sends the presence, as SelfPresenceStore does when the setting changes.
 */
export function setCustomStatus(
    session: Session,
    text: string,
    emoji: CustomStatus['emoji'],
    expiresAtMs?: string,
): void {
    const trimmed = text.trim()
    const status =
        trimmed || emoji ? { text: trimmed, emoji, expiresAtMs } : null
    saveSetting(session, CUSTOM_STATUS, status)
    emitPresenceUpdate(session, status)
}

/** UserSettings.ShowInAppNotifications. */
export const setShowInAppNotifications = (session: Session, value: boolean) =>
    saveSetting(session, USER_SETTINGS.showInAppNotifications, value)

/**
 * NotificationSettingsModalActionCreators' account flag update with USE_NEW_NOTIFICATIONS ("New Unreads").
 * Optimistic, then `PATCH /users/@me/notification-settings` with the whole flags value.
 */
export function setNewNotifications(session: Session, value: boolean): void {
    const store = session.get(settingsStore)
    store.setState({ newNotifications: value })
    const flags = accountFlagsOf(store.getState())
    session.rest
        .patch(Endpoint.accountNotificationSettings, { body: { flags } })
        .catch(() => {})
}

/** updateOptInChannelsBatched's debounce: picks in the channel browser are saved together. */
const OPT_IN_SAVE_DELAY_MS = 1000

/** The batched save waiting to run, by guild. */
const optInSaveTimers = new WeakMap<
    Session,
    Map<string, ReturnType<typeof setTimeout>>
>()

/** FlagUtils.setFlag. */
export const setFlag = (flags: number, flag: number, on: boolean) =>
    on ? flags | flag : flags & ~flag

/** Re-reads the unread setting of each changed channel from its new flags (parseGuildSettings). */
function withUnreadSettings(
    current: Record<string, UnreadSetting> | undefined,
    changes: Record<string, number>,
): Record<string, UnreadSetting> {
    const next = { ...current }
    for (const [id, flags] of Object.entries(changes)) {
        const unread = unreadSettingOf(
            flags,
            ChannelNotificationSettingsFlags.UNREADS_ALL_MESSAGES,
            ChannelNotificationSettingsFlags.UNREADS_ONLY_MENTIONS,
        )
        if (unread === UnreadSetting.UNSET) delete next[id]
        else next[id] = unread
    }
    return next
}

/** Applies channel flags at once and holds them as pending until saved. `guildFlags` replaces the guild's own. */
export function applyChannelFlags(
    session: Session,
    guildId: string,
    changes: Record<string, number>,
    guildFlags: number | undefined,
): void {
    session.get(settingsStore).setState(state => {
        const current =
            state.guildSettings[guildId] ??
            parseGuildSettings({ guild_id: guildId })
        return {
            guildSettings: {
                ...state.guildSettings,
                [guildId]: {
                    ...current,
                    flags: guildFlags ?? current.flags,
                    channelFlags: { ...current.channelFlags, ...changes },
                    channelUnreadSettings: withUnreadSettings(
                        current.channelUnreadSettings,
                        changes,
                    ),
                },
            },
            pendingChannelFlags: {
                ...state.pendingChannelFlags,
                [guildId]: {
                    ...state.pendingChannelFlags?.[guildId],
                    ...changes,
                },
            },
        }
    })
}

/** _persistOptInChannelUpdates: saves the guild's pending channel flags, then drops those that didn't change since. */
export function saveChannelFlags(
    session: Session,
    guildId: string,
    guildFlags?: number,
): void {
    clearTimeout(optInSaveTimers.get(session)?.get(guildId))
    optInSaveTimers.get(session)?.delete(guildId)
    const store = session.get(settingsStore)
    const sent = store.getState().pendingChannelFlags?.[guildId]
    if (!sent) return
    const channel_overrides = Object.fromEntries(
        Object.entries(sent).map(([id, flags]) => [id, { flags }]),
    )
    session.rest
        .patch(Endpoint.myGuildSettings(guildId), {
            body:
                guildFlags === undefined
                    ? { channel_overrides }
                    : { flags: guildFlags, channel_overrides },
        })
        .catch(() => {})
        .finally(() =>
            store.setState(state => {
                const pending = { ...state.pendingChannelFlags?.[guildId] }
                for (const [id, flags] of Object.entries(sent))
                    if (pending[id] === flags) delete pending[id]
                return {
                    pendingChannelFlags: {
                        ...state.pendingChannelFlags,
                        [guildId]: pending,
                    },
                }
            }),
        )
}

/**
 * Adds a channel or category to the channel list, or removes it (setOptInChannel, updateOptInChannelsImmediate).
 * Leaving the list also unfavourites it. The first pick turns the guild's opt-in on and saves at once. Otherwise
 * `batched` picks are saved together after a pause.
 */
export function setChannelOptIn(
    session: Session,
    guildId: string,
    channelId: string,
    optIn: boolean,
    batched = false,
): void {
    const state = session.get(settingsStore).getState()
    const settings = state.guildSettings[guildId]
    const current = settings?.channelFlags?.[channelId] ?? 0
    const kept = optIn
        ? current
        : setFlag(current, ChannelNotificationSettingsFlags.FAVORITED, false)
    const flags = setFlag(
        kept,
        ChannelNotificationSettingsFlags.OPT_IN_ENABLED,
        optIn,
    )
    const guildFlags = isOptInEnabled(state, guildId)
        ? undefined
        : setFlag(
              settings?.flags ?? 0,
              GuildNotificationSettingsFlags.OPT_IN_CHANNELS_ON,
              true,
          )
    applyChannelFlags(session, guildId, { [channelId]: flags }, guildFlags)
    if (!batched || guildFlags !== undefined) {
        saveChannelFlags(session, guildId, guildFlags)
        return
    }
    let timers = optInSaveTimers.get(session)
    if (!timers) optInSaveTimers.set(session, (timers = new Map()))
    clearTimeout(timers.get(guildId))
    timers.set(
        guildId,
        setTimeout(
            () => saveChannelFlags(session, guildId),
            OPT_IN_SAVE_DELAY_MS,
        ),
    )
}

/**
 * USER_GUILD_SETTINGS_CHANNEL_UPDATE_BULK: puts channels on the channel list, or takes them off, locally only. For
 * onboarding answers, whose save applies them on the server.
 */
export function setChannelOptInLocally(
    session: Session,
    guildId: string,
    channelIds: readonly string[],
    optIn: boolean,
): void {
    if (channelIds.length === 0) return
    session.get(settingsStore).setState(state => {
        const current =
            state.guildSettings[guildId] ??
            parseGuildSettings({ guild_id: guildId })
        const channelFlags = { ...current.channelFlags }
        for (const id of channelIds)
            channelFlags[id] = setFlag(
                channelFlags[id] ?? 0,
                ChannelNotificationSettingsFlags.OPT_IN_ENABLED,
                optIn,
            )
        return {
            guildSettings: {
                ...state.guildSettings,
                [guildId]: { ...current, channelFlags },
            },
        }
    })
}

/** bulkOptInChannels, turning the guild's opt-in on: what onboardExistingMember saves. */
export function optIntoChannels(
    session: Session,
    guildId: string,
    channelIds: readonly string[],
): void {
    const settings = session.get(settingsStore).getState().guildSettings[
        guildId
    ]
    const changes = Object.fromEntries(
        channelIds.map(id => [
            id,
            setFlag(
                settings?.channelFlags?.[id] ?? 0,
                ChannelNotificationSettingsFlags.OPT_IN_ENABLED,
                true,
            ),
        ]),
    )
    const guildFlags = setFlag(
        settings?.flags ?? 0,
        GuildNotificationSettingsFlags.OPT_IN_CHANNELS_ON,
        true,
    )
    applyChannelFlags(session, guildId, changes, guildFlags)
    saveChannelFlags(session, guildId, guildFlags)
}

/**
 * OptInOnboardingUtils.toggleShowAllChannels: flips opt-in mode for a community guild, opting existing
 * members into all viewable channels the first time opt-in turns on.
 */
export function toggleShowAllChannels(
    session: Session,
    guild: { id: string; myMemberFlags?: number; features?: readonly string[] },
    viewableChannelIds: readonly string[],
): void {
    const state = session.get(settingsStore).getState()
    const optIn = isOptInEnabledForGuild(state, guild)
    const settings = state.guildSettings[guild.id]
    const hasOptedInChannels = Object.values(settings?.channelFlags ?? {}).some(
        flag => (flag & ChannelNotificationSettingsFlags.OPT_IN_ENABLED) !== 0,
    )
    const notSetUp =
        !optIn &&
        ((guild.myMemberFlags ?? 0) & GuildMemberFlags.COMPLETED_ONBOARDING) ===
            0 &&
        !hasOptedInChannels
    if (notSetUp) {
        optIntoChannels(session, guild.id, viewableChannelIds)
        return
    }
    updateGuildSettings(session, guild.id, {
        flags: setFlag(
            settings?.flags ?? 0,
            GuildNotificationSettingsFlags.OPT_IN_CHANNELS_ON,
            !optIn,
        ),
    })
}

/** Updates a per-guild privacy list (`restrictedGuildIds` or `messageRequestRestrictedGuildIds`). */
function setRestrictedGuild(
    session: Session,
    key: 'restrictedGuildIds' | 'messageRequestRestrictedGuildIds',
    guildId: string,
    allow: boolean,
): void {
    const list = session.get(settingsStore).getState()[key] ?? []
    const set = new Set(list)
    if (allow) set.delete(guildId)
    else set.add(guildId)
    saveSetting(session, USER_SETTINGS[key], [...set])
}

/** RestrictedGuildIds: allows or blocks DMs from members of `guildId`. */
export const setGuildRestricted = (
    session: Session,
    guildId: string,
    allow: boolean,
) => setRestrictedGuild(session, 'restrictedGuildIds', guildId, allow)

/** MessageRequestRestrictedGuildIds: allows or blocks message requests from members of `guildId`. */
export const setGuildMessageRequestRestricted = (
    session: Session,
    guildId: string,
    allow: boolean,
) =>
    setRestrictedGuild(
        session,
        'messageRequestRestrictedGuildIds',
        guildId,
        allow,
    )
