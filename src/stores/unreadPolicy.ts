import { GuildFeature } from '../core/discord/guild'
import {
    ChannelNotificationSettingsFlags,
    GuildNotificationSettingsFlags,
    UnreadSetting,
    UserNotificationSettings,
} from '../core/discord/notificationSettings'
import {
    THREAD_NOTIFICATION_LEVELS,
    ThreadMemberFlags,
} from '../core/discord/threadMember'
import { muteOf } from './settings/userGuildSettings'
import type { ThreadMember } from '../core/discord/threadMember'
import type { GuildSettings, Mute } from './settings/userGuildSettings'

// The Unread policy (GLOSSARY.md): UserGuildSettingsStore's answers for unread kinds, badges and the mute and opt-in
// display. Whether something notifies is the Notify policy, in NotificationState.kt. The terms both answer
// (mute, level, opt-in, mention) share test vectors in test-vectors/notification-policy. Every call that compares
// a mute's end takes `now`, so a timed mute ends when read, not when parsed.

/** What the policy reads of the settings store. */
interface PolicyState {
    /** By guild id; private channel settings are under `@me`. */
    guildSettings: Record<string, GuildSettings>
    newNotifications?: boolean
}

/** What the policy needs of a channel. */
interface ChannelRef {
    id: string
    guild_id?: string | null
    parent_id?: string | null
    /** A joined thread's membership, which holds the thread's own mute. */
    member?: ThreadMember
}

/** What the policy needs of a message to tell a mention. */
interface MentionFields {
    mentions?: ReadonlyArray<{ id: string }>
    mention_everyone?: boolean
    mention_roles?: readonly string[]
}

/** MuteTimers.computeIsMuted: muted until the end time, included. */
const isActive = (mute: Mute | false | undefined, now: number): boolean =>
    mute === true || (typeof mute === 'number' && mute >= now)

/** UserGuildSettingsStore.isMuted: the guild's own mute. */
export function isGuildMuted(
    state: PolicyState,
    guildId: string,
    now = Date.now(),
): boolean {
    return isActive(state.guildSettings[guildId]?.muted, now)
}

/** UserGuildSettingsStore.isChannelMuted: the channel's or category's own mute. */
export function isChannelMuted(
    state: PolicyState,
    channel: ChannelRef,
    now = Date.now(),
): boolean {
    const settings = state.guildSettings[channel.guild_id ?? '@me']
    return isActive(settings?.mutedChannels[channel.id], now)
}

/** JoinedThreadsStore.isMuted: the thread's own mute, kept in the user's membership. */
export function isThreadMuted(
    member: ThreadMember | undefined,
    now = Date.now(),
): boolean {
    return (
        member !== undefined &&
        isActive(muteOf(member.muted, member.mute_config), now)
    )
}

/**
 * UserGuildSettingsStore.isGuildOrCategoryOrChannelMuted. The parent is a channel's category or a
 * thread's channel. A private channel has only its own mute. A joined thread is also muted by its
 * own mute (GuildReadStateStore.isCountableChannel).
 */
export function isMuted(
    state: PolicyState,
    channel: ChannelRef,
    now = Date.now(),
): boolean {
    if (isThreadMuted(channel.member, now)) return true
    const settings = state.guildSettings[channel.guild_id ?? '@me']
    if (!settings) return false
    if (isActive(settings.mutedChannels[channel.id], now)) return true
    if (!channel.guild_id) return false
    return (
        isActive(settings.muted, now) ||
        (channel.parent_id != null &&
            isActive(settings.mutedChannels[channel.parent_id], now))
    )
}

/** Returns the soonest end after `now` of a timed mute, for MuteTimers' re-render. */
export function nextMuteEnd(
    guildSettings: Record<string, GuildSettings>,
    now: number,
): number | undefined {
    let next: number | undefined
    for (const settings of Object.values(guildSettings))
        for (const mute of [
            settings.muted,
            ...Object.values(settings.mutedChannels),
        ])
            if (
                typeof mute === 'number' &&
                mute > now &&
                (next === undefined || mute < next)
            )
                next = mute
    return next
}

/**
 * UserGuildSettingsStore.resolvedMessageNotifications: the channel's own notification level, else
 * its parent's (the category, or a thread's channel), else the guild's. Where the server leaves the
 * guild's unset the guild's default applies, and all messages when the guild is unknown.
 */
export function resolvedMessageNotifications(
    state: PolicyState,
    channel: ChannelRef,
    guildDefault: number | undefined,
): number {
    const settings = state.guildSettings[channel.guild_id ?? '']
    const own = settings?.channelMessageNotifications?.[channel.id]
    if (own !== undefined && own !== UserNotificationSettings.NULL) return own
    if (channel.parent_id) {
        const parent =
            settings?.channelMessageNotifications?.[channel.parent_id]
        if (parent !== undefined && parent !== UserNotificationSettings.NULL)
            return parent
    }
    const guild = settings?.messageNotifications
    return guild === undefined || guild === UserNotificationSettings.NULL
        ? (guildDefault ?? UserNotificationSettings.ALL_MESSAGES)
        : guild
}

/**
 * UserGuildSettingsStore.resolveUnreadSetting: whether a channel's unreads show in full
 * (ALL_MESSAGES) or as the less important kind (ONLY_MENTIONS). The channel's own setting wins,
 * then its category's, then the guild's, then what its notification level implies (the guild's default included). Always
 * ALL_MESSAGES in private channels and without the new notification system.
 */
export function resolveUnreadSetting(
    state: PolicyState,
    channel: ChannelRef,
    guildDefault: number | undefined,
): UnreadSetting {
    if (!channel.guild_id || !state.newNotifications)
        return UnreadSetting.ALL_MESSAGES
    // GuildReadStateStore: a joined thread shows its unreads unless muted, whatever its channel's level.
    if (channel.member) return UnreadSetting.ALL_MESSAGES
    const settings = state.guildSettings[channel.guild_id]
    const own = settings?.channelUnreadSettings?.[channel.id]
    if (own) return own
    if (channel.parent_id) {
        const parent = settings?.channelUnreadSettings?.[channel.parent_id]
        if (parent) return parent
    }
    if (settings?.unreadSetting) return settings.unreadSetting
    // The reference resolves the level with the guild's default, as notifications do.
    return resolvedMessageNotifications(state, channel, guildDefault) ===
        UserNotificationSettings.ALL_MESSAGES
        ? UnreadSetting.ALL_MESSAGES
        : UnreadSetting.ONLY_MENTIONS
}

/**
 * isRawMessageMentioned: the message mentions the user, or @everyone or one of their roles where
 * the guild does not suppress those.
 */
export function isMentioned(
    state: PolicyState,
    guildId: string,
    message: MentionFields,
    me: { id: string; roles: readonly string[] },
): boolean {
    const settings = state.guildSettings[guildId]
    if (message.mentions?.some(user => user.id === me.id)) return true
    if (message.mention_everyone && !settings?.suppressEveryone) return true
    return Boolean(
        !settings?.suppressRoles &&
            message.mention_roles?.some(role => me.roles.includes(role)),
    )
}

const hasFlag = (flags: number | undefined, flag: number) =>
    ((flags ?? 0) & flag) !== 0

/** UserGuildSettingsStore.isOptInEnabled: the guild's channel list shows only the channels the user picked. */
export function isOptInEnabled(state: PolicyState, guildId: string): boolean {
    return hasFlag(
        state.guildSettings[guildId]?.flags,
        GuildNotificationSettingsFlags.OPT_IN_CHANNELS_ON,
    )
}

/** isOptInEnabledForGuild: only community guilds have opt-in channels. */
export function isOptInEnabledForGuild(
    state: PolicyState,
    guild: { id: string; features?: readonly string[] },
): boolean {
    return (
        (guild.features?.includes(GuildFeature.COMMUNITY) ?? false) &&
        isOptInEnabled(state, guild.id)
    )
}

/** UserGuildSettingsStore.isChannelOptedIn: the channel or category itself is on the channel list. */
export function isChannelOptedIn(
    state: PolicyState,
    guildId: string,
    channelId: string,
): boolean {
    return hasFlag(
        state.guildSettings[guildId]?.channelFlags?.[channelId],
        ChannelNotificationSettingsFlags.OPT_IN_ENABLED,
    )
}

/** UserGuildSettingsStore.isChannelRecordOrParentOptedIn: the channel, or the category it is in. */
export function isChannelOrParentOptedIn(
    state: PolicyState,
    channel: ChannelRef,
): boolean {
    if (!channel.guild_id) return false
    return (
        isChannelOptedIn(state, channel.guild_id, channel.id) ||
        (channel.parent_id != null &&
            isChannelOptedIn(state, channel.guild_id, channel.parent_id))
    )
}

/**
 * computeThreadNotificationSetting: the ThreadMemberFlags level a thread notifies at.
 * When the thread has an explicit level in its flags, that level applies.
 * Otherwise, it inherits what the parent channel resolves to (or NO_MESSAGES if muted).
 */
export function threadNotificationSetting(
    state: PolicyState,
    thread: ChannelRef,
    parent: ChannelRef | undefined,
    guildDefault: number | undefined,
): number {
    const flags = thread.member?.flags
    if (flags !== undefined) {
        for (const level of THREAD_NOTIFICATION_LEVELS)
            if (hasFlag(flags, level)) return level
    }
    if (parent && isMuted(state, parent)) return ThreadMemberFlags.NO_MESSAGES
    const resolved = parent
        ? resolvedMessageNotifications(state, parent, guildDefault)
        : (guildDefault ?? UserNotificationSettings.ALL_MESSAGES)
    if (resolved === UserNotificationSettings.NO_MESSAGES)
        return ThreadMemberFlags.NO_MESSAGES
    return resolved === UserNotificationSettings.ONLY_MENTIONS
        ? ThreadMemberFlags.ONLY_MENTIONS
        : ThreadMemberFlags.ALL_MESSAGES
}
