// Writes of a channel's notification settings, as the reference's NotificationSettingsModalActionCreators do.

import { Endpoint } from '../../core/api/paths'
import {
    ChannelNotificationSettingsFlags,
    GuildNotificationSettingsFlags,
    UnreadSetting,
    UserNotificationSettings,
} from '../../core/discord/notificationSettings'
import { logger } from '../../core/log'
import { SECOND } from '../../core/time'
import { isChannelOptedIn } from '../unreadPolicy'
import { applyChannelFlags, saveChannelFlags, setFlag } from './settingsActions'
import { settingsStore } from './settingsStore'
import {
    muteOf,
    PRIVATE_SETTINGS_KEY,
    parseGuildSettings,
    withGuildChange,
} from './userGuildSettings'
import type { Session } from '../../core/session'
import type { GuildSettings, GuildSettingsChange } from './userGuildSettings'

const log = logger('NotificationSettings')

/** What these writes need of a channel; a private channel has no `guild_id`. */
interface ChannelRef {
    id: string
    guild_id?: string | null
}

/** The fields of a channel override that these writes change, as the API takes them. */
interface ChannelOverrideChange {
    muted?: boolean
    mute_config?: {
        selected_time_window: number
        end_time: string | null
    } | null
    message_notifications?: number
}

/** Puts a change into a guild's settings, like the store's USER_GUILD_SETTINGS_CHANNEL_UPDATE handler. */
function withChange(
    current: GuildSettings,
    channelId: string,
    change: ChannelOverrideChange,
): GuildSettings {
    const mutedChannels = { ...current.mutedChannels }
    if (change.muted !== undefined) {
        const mute = muteOf(change.muted, change.mute_config)
        if (mute === undefined) delete mutedChannels[channelId]
        else mutedChannels[channelId] = mute
    }
    const levels = { ...current.channelMessageNotifications }
    // A level of NULL is not kept: the channel inherits (parseGuildSettings).
    if (change.message_notifications === UserNotificationSettings.NULL)
        delete levels[channelId]
    else if (change.message_notifications !== undefined)
        levels[channelId] = change.message_notifications
    return { ...current, mutedChannels, channelMessageNotifications: levels }
}

/** updateChannelOverrideSettings: applies the change at once, then saves it to the account. */
function updateChannelOverride(
    session: Session,
    channel: ChannelRef,
    change: ChannelOverrideChange,
): void {
    const key = channel.guild_id ?? PRIVATE_SETTINGS_KEY
    session.get(settingsStore).setState(state => ({
        guildSettings: {
            ...state.guildSettings,
            [key]: withChange(
                state.guildSettings[key] ??
                    parseGuildSettings({ guild_id: channel.guild_id ?? null }),
                channel.id,
                change,
            ),
        },
    }))
    session.rest
        .patch(Endpoint.myGuildSettings(key), {
            body: { channel_overrides: { [channel.id]: change } },
        })
        .catch(error => log.warn('Could not save the channel settings', error))
}

/**
 * ChannelMuteUtils.getMuteSettings: a mute of `seconds`, or until turned off for MuteUntilSeconds.ALWAYS (-1,
 * no end time).
 */
export function muteSettings(seconds: number): ChannelOverrideChange {
    const end_time =
        seconds > 0
            ? new Date(Date.now() + seconds * SECOND).toISOString()
            : null
    return {
        muted: true,
        mute_config: { selected_time_window: seconds, end_time },
    }
}

/** MuteSettingsUtils.handleMuteSettingPress: mutes a channel, category or private channel for `seconds`. */
export function muteChannel(
    session: Session,
    channel: ChannelRef,
    seconds: number,
): void {
    updateChannelOverride(session, channel, muteSettings(seconds))
}

/** MuteSettingsUtils.handleUnmutePress. */
export function unmuteChannel(session: Session, channel: ChannelRef): void {
    updateChannelOverride(session, channel, { muted: false, mute_config: null })
}

/**
 * ChannelSettingsNotifications.handleTypeChange: sets the notification level of a channel or category.
 * UserNotificationSettings.NULL makes it inherit the category's or the server's.
 */
export function setChannelMessageNotifications(
    session: Session,
    channel: ChannelRef,
    level: number,
): void {
    updateChannelOverride(session, channel, { message_notifications: level })
}

/**
 * OptInChannelsActionCreators.setIsFavorite (setMessagesFavorite for a private channel): pins a channel to the
 * top of its server's channel list, or unpins it. Pinning also puts the channel on an opt-in server's list.
 */
export function setChannelFavorite(
    session: Session,
    channel: ChannelRef,
    favorite: boolean,
): void {
    const key = channel.guild_id ?? PRIVATE_SETTINGS_KEY
    const state = session.get(settingsStore).getState()
    const current = state.guildSettings[key]?.channelFlags?.[channel.id] ?? 0
    const optIn =
        channel.guild_id != null &&
        favorite &&
        !isChannelOptedIn(state, channel.guild_id, channel.id)
    const flags = setFlag(
        optIn
            ? setFlag(
                  current,
                  ChannelNotificationSettingsFlags.OPT_IN_ENABLED,
                  true,
              )
            : current,
        ChannelNotificationSettingsFlags.FAVORITED,
        favorite,
    )
    applyChannelFlags(session, key, { [channel.id]: flags }, undefined)
    saveChannelFlags(session, key)
}

/**
 * NotificationSettingsMessageUnreadChannelActionSheet.onChange: swaps the unread bits (withChannelUnreadFlags) for
 * ALL_MESSAGES (unreads in full) or ONLY_MENTIONS (dimmed unless mentioned), then saves the flags.
 */
export function setChannelUnreadSetting(
    session: Session,
    channel: ChannelRef & { guild_id: string },
    setting: UnreadSetting,
): void {
    const { UNREADS_ALL_MESSAGES, UNREADS_ONLY_MENTIONS } =
        ChannelNotificationSettingsFlags
    const current =
        session.get(settingsStore).getState().guildSettings[channel.guild_id]
            ?.channelFlags?.[channel.id] ?? 0
    const cleared = current & ~(UNREADS_ALL_MESSAGES | UNREADS_ONLY_MENTIONS)
    const flags =
        cleared |
        (setting === UnreadSetting.ALL_MESSAGES
            ? UNREADS_ALL_MESSAGES
            : UNREADS_ONLY_MENTIONS)
    applyChannelFlags(
        session,
        channel.guild_id,
        { [channel.id]: flags },
        undefined,
    )
    saveChannelFlags(session, channel.guild_id)
}

/**
 * Applies a guild notification setting change optimistically, then PATCHes `/users/@me/guilds/{id}/settings`.
 * The change stays pending over incoming updates until the save settles, like channel flags and collapse.
 */
export function updateGuildSettings(
    session: Session,
    guildId: string,
    change: GuildSettingsChange,
): void {
    const store = session.get(settingsStore)
    store.setState(state => ({
        guildSettings: {
            ...state.guildSettings,
            [guildId]: withGuildChange(
                state.guildSettings[guildId] ??
                    parseGuildSettings({ guild_id: guildId }),
                change,
            ),
        },
        pendingGuildSettings: {
            ...state.pendingGuildSettings,
            [guildId]: { ...state.pendingGuildSettings?.[guildId], ...change },
        },
    }))
    session.rest
        .patch(Endpoint.myGuildSettings(guildId), { body: change })
        .catch(error => log.warn('Could not save the server settings', error))
        .finally(() =>
            store.setState(state => {
                const pending = { ...state.pendingGuildSettings?.[guildId] }
                for (const [key, value] of Object.entries(change))
                    if (pending[key as keyof GuildSettingsChange] === value)
                        delete pending[key as keyof GuildSettingsChange]
                return {
                    pendingGuildSettings: {
                        ...state.pendingGuildSettings,
                        [guildId]: pending,
                    },
                }
            }),
        )
}

/** Mutes a server for `seconds` (or until turned off for `MuteUntilSeconds.ALWAYS`). */
export function muteGuild(
    session: Session,
    guildId: string,
    seconds: number,
): void {
    updateGuildSettings(session, guildId, muteSettings(seconds))
}

/** Unmutes a server. */
export function unmuteGuild(session: Session, guildId: string): void {
    updateGuildSettings(session, guildId, { muted: false, mute_config: null })
}

/** Sets the server-wide message notification level (All Messages, Only @mentions, Nothing). */
export function setGuildMessageNotifications(
    session: Session,
    guildId: string,
    level: number,
): void {
    const state = session.get(settingsStore).getState()
    const current = state.guildSettings[guildId]
    const change: GuildSettingsChange = { message_notifications: level }
    // Align with NotificationSettingsMessageNotificationGuildActionSheet: switching to ALL_MESSAGES sets UNREADS_ALL_MESSAGES.
    if (
        level === UserNotificationSettings.ALL_MESSAGES &&
        current?.unreadSetting !== UnreadSetting.ALL_MESSAGES
    ) {
        const flags = current?.flags ?? 0
        const cleared =
            flags &
            ~(
                GuildNotificationSettingsFlags.UNREADS_ALL_MESSAGES |
                GuildNotificationSettingsFlags.UNREADS_ONLY_MENTIONS
            )
        change.flags =
            cleared | GuildNotificationSettingsFlags.UNREADS_ALL_MESSAGES
    }
    updateGuildSettings(session, guildId, change)
}

/** Sets the server-wide unread badge setting (ALL_MESSAGES or ONLY_MENTIONS). */
export function setGuildUnreadSetting(
    session: Session,
    guildId: string,
    setting: UnreadSetting,
): void {
    const { UNREADS_ALL_MESSAGES, UNREADS_ONLY_MENTIONS } =
        GuildNotificationSettingsFlags
    const current =
        session.get(settingsStore).getState().guildSettings[guildId]?.flags ?? 0
    const cleared = current & ~(UNREADS_ALL_MESSAGES | UNREADS_ONLY_MENTIONS)
    const flags =
        cleared |
        (setting === UnreadSetting.ALL_MESSAGES
            ? UNREADS_ALL_MESSAGES
            : UNREADS_ONLY_MENTIONS)
    updateGuildSettings(session, guildId, { flags })
}

/** ChannelCollapseActionCreators.toggleCollapseGuild: toggles Hide Muted Channels in a server. */
export function toggleHideMutedChannels(
    session: Session,
    guildId: string,
): void {
    const hidden =
        session.get(settingsStore).getState().guildSettings[guildId]
            ?.hideMutedChannels === true
    updateGuildSettings(session, guildId, { hide_muted_channels: !hidden })
}
