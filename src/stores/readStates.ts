import { createStore } from 'zustand/vanilla'
import { Endpoint } from '../core/api/paths'
import { ChannelType } from '../core/discord/channelType'
import {
    UnreadSetting,
    UserNotificationSettings,
} from '../core/discord/notificationSettings'
import { Permission } from '../core/discord/permissions'
import {
    compareSnowflakes,
    snowflakeFromTimestamp,
} from '../core/discord/snowflake'
import { defineStore } from '../core/session'
import { channelsStore, isThread } from './channels/channels'
import { dataModeOf, guildsStore } from './guilds'
import { can } from './permissions'
import { settingsStore } from './settings/settingsStore'
import {
    isChannelOrParentOptedIn,
    isMentioned,
    isMuted,
    isOptInEnabledForGuild,
    resolvedMessageNotifications,
    resolveUnreadSetting,
} from './unreadPolicy'
import type { Session } from '../core/session'
import type { Channel } from './channels/channels'
import type { RawGuild } from './guilds'
import type { User } from './users'

interface RawReadState {
    id: string
    /** Absent or 0 for channels; other values track things Isocord does not show. */
    read_state_type?: number
    last_message_id?: string | number | null
    mention_count?: number
    /** ReadStateFlags: 4 is IS_MENTION_LOW_IMPORTANCE. */
    flags?: number
}

const IS_MENTION_LOW_IMPORTANCE = 4

export interface Message {
    id: string
    channel_id: string
    guild_id?: string
    author: User
    mentions?: User[]
    mention_roles?: string[]
    mention_everyone?: boolean
}

declare module '../core/gateway/events' {
    interface ReadyPayload {
        /** Versioned: a `partial` one holds only the entries changed since the client's `read_state_version`. */
        read_state?: {
            version?: number
            partial?: boolean
            entries?: RawReadState[]
        }
    }
    interface GatewayEvents {
        MESSAGE_CREATE: Message
        MESSAGE_ACK: {
            channel_id: string
            message_id: string
            mention_count?: number
            /** A "mark unread": the chat's NEW divider moves to the message after this one. */
            manual?: boolean
            /** Read state version after this ack. */
            version?: number
        }
        PASSIVE_UPDATE_V1: {
            guild_id: string
            channels?: Array<{ id: string; last_message_id: string }>
        }
        PASSIVE_UPDATE_V2: {
            guild_id: string
            updated_channels?: Array<{ id: string; last_message_id: string }>
        }
    }
}

export interface GuildBadge {
    /** Unread messages that matter: channels whose unread setting is only mentions do not count. */
    unread: boolean
    mentions: number
    /** Every mention is a low importance one (MENTION_ON_ALL_MESSAGES): shown gray rather than red. */
    lowImportance?: boolean
}

export interface ReadStatesState {
    /** Last message the user has read, by channel. */
    acks: Record<string, string>
    mentions: Record<string, number>
    /** Channels whose mentions are all low importance (ReadState.isMentionLowImportance). */
    lowMentions: Record<string, true>
    /** Newest message, by channel. Kept here so message traffic never touches channel objects. */
    lastMessageIds: Record<string, string>
    /** Derived per guild, recomputed only for the guild an event belongs to. */
    guildBadges: Record<string, GuildBadge>
    /**
     * Version of the read states held in `acks` and `mentions`, from READY and later acks. Saved with
     * them; the next IDENTIFY sends it so the server only returns read states changed since.
     * Absent when the server gave no version.
     */
    readStateVersion?: number
}

const NO_BADGE: GuildBadge = { unread: false, mentions: 0 }

const READABLE: ReadonlySet<number> = new Set([
    ChannelType.GUILD_TEXT,
    ChannelType.GUILD_ANNOUNCEMENT,
    ChannelType.ANNOUNCEMENT_THREAD,
    ChannelType.PUBLIC_THREAD,
    ChannelType.PRIVATE_THREAD,
])

export const readStatesStore = defineStore(
    'readStates',
    session => {
        // Created first so their handlers run before this store's and it reads fresh data.
        const channels = session.get(channelsStore)
        const guilds = session.get(guildsStore)
        const settings = session.get(settingsStore)
        const store = createStore<ReadStatesState>(() => ({
            acks: {},
            mentions: {},
            lowMentions: {},
            lastMessageIds: {},
            guildBadges: {},
        }))
        const { dispatch } = session.gateway

        const computeBadge = (
            guildId: string,
            state: ReadStatesState,
        ): GuildBadge => {
            const guild = guilds.getState().guilds[guildId]
            if (!guild) return NO_BADGE
            const all = channels.getState().channels
            const settingsState = settings.getState()
            const now = Date.now()
            const optIn = isOptInEnabledForGuild(settingsState, guild)
            // A channel never opened counts as read up to the moment the user joined.
            const joined = snowflakeFromTimestamp(
                new Date(guild.joinedAt).getTime(),
            )
            let unread = false
            let mentions = 0
            let highMentions = 0
            for (const id of channels.getState().byGuild[guildId] ?? []) {
                const mentionCount = state.mentions[id] ?? 0
                const hasUnread =
                    compareSnowflakes(
                        state.lastMessageIds[id],
                        state.acks[id] ?? joined,
                    ) > 0
                if (!mentionCount && (unread || !hasUnread)) continue
                const channel = all[id]
                if (!channel || !READABLE.has(channel.type)) continue
                if (!can(session, id, Permission.VIEW_CHANNEL)) continue
                // GuildReadStateStore: a channel left out of an opt-in channel list counts only for mentions.
                if (
                    optIn &&
                    !mentionCount &&
                    !isThread(channel) &&
                    !isChannelOrParentOptedIn(settingsState, channel)
                )
                    continue
                mentions += mentionCount
                if (!state.lowMentions?.[id]) highMentions += mentionCount
                // GuildReadStateStore: a channel counts when it has mentions or shows all its messages.
                if (
                    hasUnread &&
                    !isMuted(settingsState, channel, now) &&
                    (mentionCount > 0 ||
                        resolveUnreadSetting(
                            settingsState,
                            channel,
                            guild.defaultMessageNotifications,
                        ) === UnreadSetting.ALL_MESSAGES)
                )
                    unread = true
            }
            return unread || mentions
                ? {
                      unread,
                      mentions,
                      lowImportance: mentions > 0 && !highMentions,
                  }
                : NO_BADGE
        }

        /** Applies a change, then refreshes the badge of the guilds it touched. */
        const change = (
            guildIds: Array<string | undefined>,
            patch: Partial<ReadStatesState>,
        ) =>
            store.setState(state => {
                const next = { ...state, ...patch }
                const guildBadges = { ...state.guildBadges }
                for (const guildId of guildIds) {
                    if (guildId)
                        guildBadges[guildId] = computeBadge(guildId, next)
                }
                return { ...patch, guildBadges }
            })
        const refresh = (guildId: string | undefined) => change([guildId], {})
        const guildOf = (channelId: string) =>
            channels.getState().channels[channelId]?.guild_id

        const recordLastMessages = (
            state: ReadStatesState,
            list: Channel[] | undefined,
        ) => {
            for (const channel of list ?? []) {
                if (channel.last_message_id)
                    state.lastMessageIds[channel.id] = channel.last_message_id
            }
        }

        /** A guild's channels with a `last_message_id` in this payload, and the newer ones from a partial guild. */
        const recordGuildLastMessages = (
            state: ReadStatesState,
            guild: RawGuild,
        ) => {
            const mode = dataModeOf(guild)
            if (mode === 'unavailable') return
            if (mode === 'partial') {
                recordLastMessages(state, guild.partial_updates?.channels)
                for (const update of guild.channel_updates ?? [])
                    if (update.last_message_id)
                        state.lastMessageIds[update.id] = update.last_message_id
            } else recordLastMessages(state, guild.channels)
            recordLastMessages(state, guild.threads)
        }

        dispatch.on('READY', ready => {
            const previous = store.getState()
            const versioned = ready.read_state
            const partial = versioned?.partial === true
            // A partial read state holds only what changed since the version held: merge it onto that.
            const state: ReadStatesState = {
                acks: partial ? { ...previous.acks } : {},
                mentions: partial ? { ...previous.mentions } : {},
                lowMentions: partial ? { ...previous.lowMentions } : {},
                lastMessageIds: {},
                guildBadges: {},
                readStateVersion:
                    typeof versioned?.version === 'number'
                        ? versioned.version
                        : undefined,
            }
            for (const entry of versioned?.entries ?? []) {
                if (entry.read_state_type) continue
                // An entry is the channel's whole read state, so what it lacks is cleared when merging.
                if (entry.last_message_id)
                    state.acks[entry.id] = String(entry.last_message_id)
                else if (partial) delete state.acks[entry.id]
                if (entry.mention_count)
                    state.mentions[entry.id] = entry.mention_count
                else if (partial) delete state.mentions[entry.id]
                if (
                    entry.mention_count &&
                    entry.flags &&
                    IS_MENTION_LOW_IMPORTANCE & entry.flags
                )
                    state.lowMentions[entry.id] = true
                else delete state.lowMentions[entry.id]
            }
            // Channels the server did not send (partial and unavailable guilds) keep what is held,
            // for the channels that are still there.
            const held = channels.getState().byGuild
            for (const guild of ready.guilds ?? []) {
                const sent = dataModeOf(guild) === 'full' && guild.channels
                if (!sent)
                    for (const id of held[guild.id] ?? [])
                        if (previous.lastMessageIds[id])
                            state.lastMessageIds[id] =
                                previous.lastMessageIds[id]
                recordGuildLastMessages(state, guild)
            }
            recordLastMessages(state, ready.private_channels)
            for (const guild of ready.guilds ?? [])
                state.guildBadges[guild.id] = computeBadge(guild.id, state)
            store.setState(state)
        })

        dispatch.on('MESSAGE_CREATE', message => {
            const state = store.getState()
            const patch: Partial<ReadStatesState> = {
                lastMessageIds: {
                    ...state.lastMessageIds,
                    [message.channel_id]: message.id,
                },
            }
            if (message.author.id === session.userId) {
                patch.acks = { ...state.acks, [message.channel_id]: message.id }
            } else {
                const mention = mentionsMe(message)
                if (mention) {
                    const before = state.mentions[message.channel_id] ?? 0
                    patch.mentions = {
                        ...state.mentions,
                        [message.channel_id]: before + 1,
                    }
                    // ReadState.isMentionLowImportance: only the first mention can set it, any important one clears it.
                    const lowMentions = { ...state.lowMentions }
                    if (mention === 'high')
                        delete lowMentions[message.channel_id]
                    else if (before === 0)
                        lowMentions[message.channel_id] = true
                    patch.lowMentions = lowMentions
                }
            }
            change([message.guild_id ?? guildOf(message.channel_id)], patch)
        })

        /** Whether a message counts as a mention, and how important: 'low' for MENTION_ON_ALL_MESSAGES. */
        const mentionsMe = (message: Message): 'high' | 'low' | false => {
            const guildId = message.guild_id ?? guildOf(message.channel_id)
            const settingsState = settings.getState()
            // Every message in a private channel notifies, unless the conversation is muted.
            if (!guildId)
                return isMuted(settingsState, { id: message.channel_id })
                    ? false
                    : 'high'
            const me = {
                id: session.userId,
                roles: guilds.getState().guilds[guildId]?.myRoles ?? [],
            }
            if (isMentioned(settingsState, guildId, message, me)) return 'high'
            // ReadStateStore: with "mention on all messages", messages in all-messages channels count too.
            const channel = channels.getState().channels[message.channel_id]
            if (
                settingsState.mentionOnAllMessages &&
                channel &&
                !isThread(channel) &&
                READABLE.has(channel.type) &&
                !isMuted(settingsState, channel) &&
                resolvedMessageNotifications(
                    settingsState,
                    channel,
                    guilds.getState().guilds[guildId]
                        ?.defaultMessageNotifications,
                ) === UserNotificationSettings.ALL_MESSAGES
            )
                return 'low'
            return false
        }

        dispatch.on('MESSAGE_ACK', ack => {
            const state = store.getState()
            change([guildOf(ack.channel_id)], {
                acks: { ...state.acks, [ack.channel_id]: ack.message_id },
                mentions: {
                    ...state.mentions,
                    [ack.channel_id]: ack.mention_count ?? 0,
                },
                ...(ack.mention_count
                    ? {}
                    : {
                          lowMentions: Object.fromEntries(
                              Object.entries(state.lowMentions ?? {}).filter(
                                  ([id]) => id !== ack.channel_id,
                              ),
                          ) as Record<string, true>,
                      }),
                // Our own optimistic acks carry no version. A version only moves on top of one held.
                ...(state.readStateVersion !== undefined &&
                typeof ack.version === 'number'
                    ? {
                          readStateVersion: Math.max(
                              state.readStateVersion,
                              ack.version,
                          ),
                      }
                    : {}),
            })
        })

        const passive = (
            guildId: string,
            updated: Array<{ id: string; last_message_id: string }> | undefined,
        ) => {
            if (!updated?.length) return
            const lastMessageIds = { ...store.getState().lastMessageIds }
            for (const channel of updated)
                lastMessageIds[channel.id] = channel.last_message_id
            change([guildId], { lastMessageIds })
        }
        dispatch.on('PASSIVE_UPDATE_V1', update =>
            passive(update.guild_id, update.channels),
        )
        dispatch.on('PASSIVE_UPDATE_V2', update =>
            passive(update.guild_id, update.updated_channels),
        )

        const trackChannel = (channel: Channel) => {
            const state = store.getState()
            const known = state.lastMessageIds[channel.id]
            const patch =
                channel.last_message_id &&
                compareSnowflakes(channel.last_message_id, known) > 0
                    ? {
                          lastMessageIds: {
                              ...state.lastMessageIds,
                              [channel.id]: channel.last_message_id,
                          },
                      }
                    : {}
            change([channel.guild_id], patch)
        }
        dispatch.on('CHANNEL_CREATE', trackChannel)
        dispatch.on('CHANNEL_UPDATE', trackChannel)
        dispatch.on('THREAD_CREATE', trackChannel)
        dispatch.on('CHANNEL_DELETE', channel => refresh(channel.guild_id))
        dispatch.on('GUILD_CREATE', guild => {
            const state = {
                ...store.getState(),
                lastMessageIds: { ...store.getState().lastMessageIds },
            }
            recordGuildLastMessages(state, guild)
            change([guild.id], { lastMessageIds: state.lastMessageIds })
        })
        // A guild's settings changed, or a timed mute in them ended.
        settings.subscribe((state, previous) => {
            if (state.guildSettings === previous.guildSettings) return
            const changed = Object.keys(state.guildSettings).filter(
                id =>
                    id !== '@me' &&
                    state.guildSettings[id] !== previous.guildSettings[id],
            )
            if (changed.length) change(changed, {})
        })

        session.registerClientState(() => {
            const { readStateVersion, lastMessageIds } = store.getState()
            if (readStateVersion === undefined) return undefined
            // The newest message of the guild channels (not threads) held. Channels the server finds
            // newer than this come back with their `last_message_id`, so it must not be too high:
            // only channels that are still held count, and DMs never do.
            let highest: string | undefined
            for (const [id, channel] of Object.entries(
                channels.getState().channels,
            )) {
                const last = lastMessageIds[id]
                if (
                    last &&
                    channel.guild_id &&
                    !isThread(channel) &&
                    compareSnowflakes(last, highest) > 0
                )
                    highest = last
            }
            return {
                read_state_version: readStateVersion,
                ...(highest ? { highest_last_message_id: highest } : {}),
            }
        })

        return store
    },
    {
        cache: [
            'acks',
            'mentions',
            'lowMentions',
            'lastMessageIds',
            'guildBadges',
            'readStateVersion',
        ],
    },
)

/**
 * Whether a channel has messages newer than the user's read marker. `fallbackAck` stands in
 * for channels with no marker (the join date, for guilds); without it they count as read.
 */
export const isUnread = (
    state: ReadStatesState,
    channelId: string,
    fallbackAck?: string,
): boolean => {
    const ack = state.acks[channelId] ?? fallbackAck
    return (
        ack !== undefined &&
        compareSnowflakes(state.lastMessageIds[channelId], ack) > 0
    )
}

/** Marks a channel read up to its newest message, locally and on the server. */
export function ackChannel(
    session: Session,
    channelId: string,
    newestLoadedId?: string,
): void {
    const store = session.get(readStatesStore)
    const state = store.getState()
    // The loaded history can be ahead of what the gateway has reported for a quiet server.
    const known = state.lastMessageIds[channelId]
    const last =
        compareSnowflakes(newestLoadedId, known) > 0 ? newestLoadedId : known
    if (!last || (state.acks[channelId] === last && !state.mentions[channelId]))
        return
    // Routed through the store's own handler so the guild badge is refreshed too.
    session.gateway.dispatch.emit('MESSAGE_ACK', {
        channel_id: channelId,
        message_id: last,
        mention_count: 0,
    })
    session.rest
        .post(Endpoint.messageAck(channelId, last), {
            body: { token: null },
        })
        .catch(() => {})
}

/**
 * Marks a channel read up to a message, locally and on the server. The marker only moves forward.
 * `mentionCount` is the local guess of the mentions left after it; the server keeps its own.
 */
export function ackMessage(
    session: Session,
    channelId: string,
    messageId: string,
    mentionCount: number,
): void {
    const ack = session.get(readStatesStore).getState().acks[channelId]
    if (ack != null && compareSnowflakes(messageId, ack) <= 0) return
    session.gateway.dispatch.emit('MESSAGE_ACK', {
        channel_id: channelId,
        message_id: messageId,
        mention_count: mentionCount,
    })
    session.rest
        .post(Endpoint.messageAck(channelId, messageId), {
            body: { token: null },
        })
        .catch(() => {})
}

/**
 * Marks a channel unread from a message on (the reference's `markUnread`): the read marker moves to the message
 * before it (or just before its id when it is the oldest loaded), with the mentions from it on as the count.
 * Manual acks carry `manual: true`, which keeps the chat from reading as seen. Locally first, like `ackChannel`.
 */
export function markMessageUnread(
    session: Session,
    channelId: string,
    messageId: string,
    /** The channel's loaded messages, newest first. */
    messages: Message[],
): void {
    const index = messages.findIndex(message => message.id === messageId)
    if (index === -1) return
    const previous = messages[index + 1]?.id ?? String(BigInt(messageId) - 1n)
    const mentions = messages
        .slice(0, index + 1)
        .filter(
            message =>
                message.mention_everyone ||
                message.mentions?.some(user => user.id === session.userId),
        ).length
    ackManually(session, channelId, previous, mentions)
}

/** The manual ack of a "mark unread", applied locally first, then sent. */
function ackManually(
    session: Session,
    channelId: string,
    previous: string,
    mentions: number,
): void {
    session.gateway.dispatch.emit('MESSAGE_ACK', {
        channel_id: channelId,
        message_id: previous,
        mention_count: mentions,
        manual: true,
    })
    session.rest
        .post(Endpoint.messageAck(channelId, previous), {
            body: { manual: true, mention_count: mentions },
        })
        .catch(() => {})
}
