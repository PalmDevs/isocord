import { traced } from '../../core/trace'
import { dmGuild } from '../../native/IsocordConstants'
import native from '../../native/IsocordNotifications'
import { channelsStore } from '../../stores/channels/channels'
import { guildsStore } from '../../stores/guilds'
import { presencesStore } from '../../stores/presences'
import { settingsStore } from '../../stores/settings/settingsStore'
import { usersStore } from '../../stores/users'
import type { Session } from '../../core/session'
import type { Channel } from '../../stores/channels/channels'
import type { Guild } from '../../stores/guilds'
import type { Message } from '../../stores/readStates'
import type {
    GuildSettings,
    Mute,
} from '../../stores/settings/userGuildSettings'

// The app's session hands what it hears in front to the native notification rules (AppSession.kt), which decide it
// and post what it notifies, as the background session would.

/** A channel mention in message text, `<#id>`. */
const CHANNEL_MENTION = /<#(\d+)>/g

/** What a forwarded dispatch is about, to look up in the stores. */
interface About {
    channelId?: string | null
    /** For what has no channel. A channel's own guild wins. */
    guildId?: string
    userIds?: readonly string[]
    /** Channels the message text mentions, for its preview. */
    mentionedChannelIds?: readonly string[]
}

/** `Mute` in NotificationState.kt: until `end` (ms), or for good when null. */
const muteOf = (mute: Mute | false) =>
    mute === false ? null : { end: mute === true ? null : mute }

/** `GuildSettings` in NotificationState.kt. */
function settingsOf(settings: GuildSettings | undefined) {
    if (!settings) return undefined
    return {
        mute: muteOf(settings.muted),
        suppressEveryone: settings.suppressEveryone,
        suppressRoles: settings.suppressRoles,
        level: settings.messageNotifications,
        channelMutes: Object.fromEntries(
            Object.entries(settings.mutedChannels).map(([id, mute]) => [
                id,
                muteOf(mute),
            ]),
        ),
        channelLevels: settings.channelMessageNotifications ?? {},
        flags: settings.flags ?? 0,
        channelFlags: settings.channelFlags ?? {},
    }
}

/** `GuildInfo` in NotificationState.kt. */
function guildOf(guild: Guild | undefined) {
    if (!guild) return undefined
    return {
        name: guild.name,
        icon: guild.icon,
        defaultNotifications: guild.defaultMessageNotifications,
        myRoles: guild.myRoles,
        roleNames: Object.fromEntries(
            Object.values(guild.roles).map(role => [role.id, role.name ?? '']),
        ),
        ownerId: guild.ownerId,
        rolePermissions: Object.fromEntries(
            Object.values(guild.roles).map(role => [role.id, role.permissions]),
        ),
    }
}

/** `RawChannel` in GatewayModels.kt. */
function channelOf(channel: Channel | undefined) {
    if (!channel) return undefined
    const {
        id,
        type,
        name,
        guild_id,
        parent_id,
        recipient_ids,
        icon,
        permission_overwrites,
        thread_metadata,
    } = channel
    return {
        id,
        type,
        name,
        guild_id,
        parent_id,
        recipient_ids,
        icon,
        permission_overwrites,
        thread_metadata,
    }
}

/**
 * The guild and settings objects last sent to native for a session, by guild. Native's app state keeps what it learns
 * (NotificationState.learn), so a store object it already has is not sent again. Per session, as native's is.
 */
const sent = new WeakMap<
    Session,
    {
        guilds: Map<string, Guild | undefined>
        settings: Map<string, GuildSettings | undefined>
    }
>()

/** Whether `value` is what native already holds under `key`. Records it as sent. */
function alreadySent<T>(
    known: Map<string, T | undefined>,
    key: string,
    value: T | undefined,
): boolean {
    const same = known.has(key) && known.get(key) === value
    known.set(key, value)
    return same
}

/** `DispatchContext` in AppSession.kt, as JSON. */
function contextOf(session: Session, about: About): string {
    const channels = session.get(channelsStore).getState().channels
    const users = session.get(usersStore).getState().users
    const channel = about.channelId ? channels[about.channelId] : undefined
    const guildId = channel?.guild_id ?? about.guildId
    const userIds = [
        ...(channel?.recipient_ids ?? []),
        ...(about.userIds ?? []),
    ]
    const known = sent.get(session) ?? {
        guilds: new Map<string, Guild | undefined>(),
        settings: new Map<string, GuildSettings | undefined>(),
    }
    sent.set(session, known)
    const guild = session.get(guildsStore).getState().guilds[guildId ?? '']
    // Private channels' settings sit under the same `@me` as their links.
    const settingsKey = guildId ?? dmGuild
    const settings = session.get(settingsStore).getState().guildSettings[
        settingsKey
    ]
    const guildUnchanged = alreadySent(known.guilds, guildId ?? '', guild)
    const settingsUnchanged = alreadySent(known.settings, settingsKey, settings)
    return JSON.stringify({
        channel: channelOf(channel),
        parent: channelOf(channels[channel?.parent_id ?? '']),
        mentionedChannels: (about.mentionedChannelIds ?? [])
            .map(id => channelOf(channels[id]))
            .filter(Boolean),
        guildId,
        guild: guildUnchanged ? undefined : guildOf(guild),
        guildUnchanged,
        settings: settingsUnchanged ? undefined : settingsOf(settings),
        settingsUnchanged,
        users: userIds.map(id => users[id]).filter(Boolean),
        status: session.get(presencesStore).getState().presences[session.userId]
            ?.status,
    })
}

/** Forwards a dispatch heard in front. Resolves whether a MESSAGE_CREATE notifies. */
export function forward(
    session: Session,
    type: string,
    event: unknown,
    about: About,
): Promise<boolean> {
    return native.dispatch(
        type,
        JSON.stringify(event),
        contextOf(session, about),
    )
}

/**
 * NotificationTextUtils.shouldNotify, decided natively (NotificationState.shouldNotify), which also posts the system
 * notification when those are on. Resolves whether the message notifies.
 */
export const forwardMessage = (
    session: Session,
    message: Message,
): Promise<boolean> =>
    traced('js:notify:forward', () =>
        forward(session, 'MESSAGE_CREATE', message, {
            channelId: message.channel_id,
            mentionedChannelIds: Array.from(
                (message.content ?? '').matchAll(CHANNEL_MENTION),
                match => match[1] as string,
            ),
        }),
    )
