import { createStore } from 'zustand/vanilla'
import { ChannelType } from '../../core/discord/channelType'
import { Opcode } from '../../core/gateway/opcodes'
import { logger } from '../../core/log'
import { murmur3 } from '../../core/murmur3'
import { defineStore } from '../../core/session'
import { expressionsStore, expressionsVersion } from '../expressions'
import { dataModeOf, guildsStore } from '../guilds'
import type {
    DefaultReaction,
    ForumTag,
    TagSetting,
} from '../../core/discord/forum'
import type { PermissionOverwrite } from '../../core/discord/permissions'
import type { ThreadMember } from '../../core/discord/threadMember'
import type { ThreadMetadata } from '../../core/discord/threads'
import type { Session } from '../../core/session'
import type { RawGuild } from '../guilds'
import type { Message } from '../readStates'
import type { User } from '../users'

const log = logger('Channels')

export interface Channel {
    id: string
    type: number
    guild_id?: string
    name?: string
    topic?: string | null
    position?: number
    parent_id?: string | null
    permission_overwrites?: PermissionOverwrite[]
    last_message_id?: string | null
    /** Slowmode: seconds between messages for members without a bypass permission. */
    rate_limit_per_user?: number
    /** DMs and group DMs. */
    recipient_ids?: string[]
    recipients?: User[]
    icon?: string | null
    owner_id?: string
    /** Threads. */
    thread_metadata?: ThreadMetadata & {
        /** ISO date; absent on threads created before 2022. */
        create_timestamp?: string
    }
    /** Threads the user joined: their membership. */
    member?: ThreadMember
    /** Threads: the messages sent in it, not counting the starter. */
    message_count?: number
    /** Minutes of inactivity after which new threads are archived. */
    default_auto_archive_duration?: number
    /** Server-side version, newer on every change. Guild channels only. */
    version?: number
    /** Channel flags (ChannelFlags): a forum post's PINNED bit. */
    flags?: number
    /** Forum and media channels: the tags a post can carry. */
    available_tags?: ForumTag[]
    /** Forum and media channels: the emoji of a post's react button. */
    default_reaction_emoji?: DefaultReaction | null
    /** Forum and media channels: ForumSortOrder, null for latest activity. */
    default_sort_order?: number | null
    /** Forum and media channels: whether a tag filter needs some or all tags. */
    default_tag_setting?: TagSetting
    /** Forum posts: the ids of the tags on it. */
    applied_tags?: string[]
    /** Threads: messages ever sent in it, not decremented by deletes. */
    total_message_sent?: number
    /** Voice channels: VideoQualityMode. Absent means auto. */
    video_quality_mode?: number
}

declare module '../../core/gateway/events' {
    interface ReadyPayload {
        private_channels?: Channel[]
    }
    interface GatewayEvents {
        CHANNEL_CREATE: Channel
        CHANNEL_UPDATE: Channel
        CHANNEL_DELETE: Channel
        THREAD_CREATE: Channel & { newly_created?: boolean }
        THREAD_UPDATE: Channel
        THREAD_DELETE: { id: string; guild_id: string }
        THREAD_LIST_SYNC: {
            guild_id: string
            /** The parents whose threads are synced; the whole guild when absent. */
            channel_ids?: string[]
            threads: Channel[]
            /** The user's membership of the joined threads, `id` being the thread's. */
            members?: Array<ThreadMember & { id: string }>
            most_recent_messages?: Message[]
        }
        THREAD_MEMBER_UPDATE: ThreadMember & {
            id: string
            guild_id: string
            user_id?: string
        }
    }
}
declare module '../guilds' {
    interface RawGuild {
        channels?: Channel[]
        threads?: Channel[]
    }
    interface PartialUpdates {
        channels?: Channel[]
        deleted_channel_ids?: string[]
    }
}

export const isThread = (channel: Channel) =>
    channel.type === ChannelType.ANNOUNCEMENT_THREAD ||
    channel.type === ChannelType.PUBLIC_THREAD ||
    channel.type === ChannelType.PRIVATE_THREAD
/** ChannelRecord.isForumPost: a thread whose parent is a forum or media channel. */
export const isForumPost = (thread: Channel, parent: Channel | undefined) =>
    isThread(thread) &&
    (parent?.type === ChannelType.GUILD_FORUM ||
        parent?.type === ChannelType.GUILD_MEDIA)
export const isPrivate = (channel: Channel) =>
    channel.type === ChannelType.DM || channel.type === ChannelType.GROUP_DM
export const isVoice = (channel: Channel) =>
    channel.type === ChannelType.GUILD_VOICE ||
    channel.type === ChannelType.GUILD_STAGE_VOICE

interface ChannelsState {
    channels: Record<string, Channel>
    /** Channel and joined-thread ids of each guild, unordered. */
    byGuild: Record<string, string[]>
    /** DM and group DM ids, unordered. */
    privateIds: string[]
    /**
     * Newest `version` of the guild's channels (not threads) held here, by guild id. Saved with the
     * channels it describes; the next IDENTIFY sends it so the server only returns channels
     * changed since. Absent when the server gave no versions.
     */
    versions: Record<string, number>
}

/** One guild's saved channels, or the private ones. */
interface ChannelsPart {
    ids: string[]
    version?: number
    channels: Channel[]
}
/** The cache part of DMs and group DMs. Guild parts are keyed by guild id. */
const PRIVATE_PART = '@me'

/** Guild channels, joined threads and private channels. */
export const channelsStore = defineStore(
    'channels',
    session => {
        const store = createStore<ChannelsState>(() => ({
            channels: {},
            byGuild: {},
            privateIds: [],
            versions: {},
        }))
        const { dispatch } = session.gateway

        // DMs carry full recipient objects in CHANNEL_CREATE and only ids in READY; keep the ids.
        const normalize = (channel: Channel, guildId?: string): Channel => {
            const { recipients, ...rest } = channel
            if (guildId) rest.guild_id = guildId
            if (recipients && !rest.recipient_ids)
                rest.recipient_ids = recipients.map(user => user.id)
            return rest
        }

        /** A version only moves on top of channels that already have one; otherwise it stays unknown. */
        const bumped = (
            versions: Record<string, number>,
            guildId: string,
            version: number | undefined,
        ) =>
            versions[guildId] && version
                ? {
                      ...versions,
                      [guildId]: Math.max(versions[guildId], version),
                  }
                : versions

        const put = (raw: Channel) =>
            store.setState(state => {
                const prev = state.channels[raw.id]
                const channel = normalize({
                    ...prev,
                    ...raw,
                    member: raw.member ?? prev?.member,
                })
                const channels = { ...state.channels, [channel.id]: channel }
                const versions =
                    channel.guild_id && !isThread(channel)
                        ? bumped(state.versions, channel.guild_id, raw.version)
                        : state.versions
                const shouldList =
                    channel.guild_id &&
                    (!isThread(channel) || channel.member !== undefined)
                if (shouldList) {
                    const ids = state.byGuild[channel.guild_id!] ?? []
                    if (!ids.includes(channel.id))
                        return {
                            channels,
                            versions,
                            byGuild: {
                                ...state.byGuild,
                                [channel.guild_id!]: [...ids, channel.id],
                            },
                        }
                }
                if (prev) return { channels, versions }
                if (channel.guild_id) return { channels, versions }
                return {
                    channels,
                    privateIds: [...state.privateIds, channel.id],
                }
            })

        const remove = (id: string, version?: number) =>
            store.setState(state => {
                const channel = state.channels[id]
                if (!channel) return state
                const { [id]: _removed, ...channels } = state.channels
                if (!channel.guild_id)
                    return {
                        channels,
                        privateIds: state.privateIds.filter(
                            other => other !== id,
                        ),
                    }
                const ids = (state.byGuild[channel.guild_id] ?? []).filter(
                    other => other !== id,
                )
                return {
                    channels,
                    byGuild: { ...state.byGuild, [channel.guild_id]: ids },
                    versions: isThread(channel)
                        ? state.versions
                        : bumped(state.versions, channel.guild_id, version),
                }
            })

        /**
         * Puts a guild's channels from READY or GUILD_CREATE into `state` (whose maps are the caller's
         * to change), reading what is held from `previous`. Full replaces, partial merges, and an
         * unavailable guild (or one without channels) keeps what is held.
         */
        const applyGuild = (
            state: ChannelsState,
            previous: ChannelsState,
            guild: RawGuild,
        ) => {
            const mode = dataModeOf(guild)
            const oldIds = previous.byGuild[guild.id] ?? []
            for (const id of oldIds) delete state.channels[id]
            const keep = () => {
                state.byGuild[guild.id] = oldIds
                for (const id of oldIds)
                    if (previous.channels[id])
                        state.channels[id] = previous.channels[id]
                const version = previous.versions[guild.id]
                if (version !== undefined) state.versions[guild.id] = version
                else delete state.versions[guild.id]
            }
            const ids: string[] = []
            const add = (channel: Channel) => {
                state.channels[channel.id] = normalize(channel, guild.id)
                if (!ids.includes(channel.id)) ids.push(channel.id)
            }
            if (mode === 'unavailable' || (mode === 'full' && !guild.channels))
                return keep()

            let version = 0
            if (mode === 'full') {
                const channels = guild.channels ?? []
                for (const channel of channels) add(channel)
                for (const thread of guild.threads ?? []) add(thread)
                version = channels.reduce(
                    (max, channel) => Math.max(max, channel.version ?? 0),
                    0,
                )
            } else {
                const changes = guild.partial_updates
                const deleted = new Set(changes?.deleted_channel_ids)
                // Held threads are replaced by the joined ones sent now, never carried over.
                for (const id of oldIds) {
                    const channel = previous.channels[id]
                    if (
                        channel &&
                        (!isThread(channel) || channel.member !== undefined) &&
                        !deleted.has(id)
                    ) {
                        state.channels[id] = channel
                        ids.push(id)
                    }
                }
                for (const channel of changes?.channels ?? []) add(channel)
                for (const thread of guild.threads ?? []) add(thread)
                for (const update of guild.channel_updates ?? []) {
                    const channel = state.channels[update.id]
                    if (channel && update.last_message_id)
                        state.channels[update.id] = {
                            ...channel,
                            last_message_id: update.last_message_id,
                        }
                }
                const held = previous.versions[guild.id] ?? 0
                version = held
                    ? (changes?.channels ?? []).reduce(
                          (max, channel) => Math.max(max, channel.version ?? 0),
                          held,
                      )
                    : 0
                if (!previous.byGuild[guild.id])
                    log.warn('Partial guild without cached channels')
            }
            state.byGuild[guild.id] = ids
            if (version) state.versions[guild.id] = version
            else delete state.versions[guild.id]
        }

        /** Asks the server which channels and roles of a guild no longer exist, after the partial sync could not tell. */
        const requestDeletedIds = (guildId: string) => {
            // A random delay spreads the requests of many guilds, as the reference client does.
            setTimeout(
                () => {
                    const { channels, byGuild } = store.getState()
                    const guild = session.get(guildsStore).getState().guilds[
                        guildId
                    ]
                    if (!guild?.pendingDeleteSync) return
                    const channelIds = (byGuild[guildId] ?? [])
                        .filter(id => channels[id] && !isThread(channels[id]))
                        .sort()
                    const roleIds = Object.keys(guild.roles).sort()
                    // A hash that does not match makes the server answer with the ids it has, so a
                    // mismatch costs bandwidth, never correctness.
                    const held = session.get(expressionsStore).getState()
                        .guilds[guildId]
                    const emojiIds = (held?.emojis ?? []).map(e => e.id).sort()
                    const stickerIds = (held?.stickers ?? [])
                        .map(s => s.id)
                        .sort()
                    session.gateway.send(
                        Opcode.GET_DELETED_ENTITY_IDS_NOT_MATCHING_HASH,
                        {
                            guild_id: guildId,
                            channel_ids_hash: String(
                                murmur3(channelIds.join(',')),
                            ),
                            role_ids_hash: String(murmur3(roleIds.join(','))),
                            emoji_ids_hash: String(murmur3(emojiIds.join(','))),
                            sticker_ids_hash: String(
                                murmur3(stickerIds.join(',')),
                            ),
                        },
                    )
                },
                Math.ceil(Math.random() * 2000),
            )
        }
        const requestPending = (guilds: RawGuild[] | undefined) => {
            for (const guild of guilds ?? [])
                if (
                    dataModeOf(guild) === 'partial' &&
                    guild.unable_to_sync_deletes
                )
                    requestDeletedIds(guild.id)
        }

        dispatch.on('READY', ready => {
            const previous = store.getState()
            const state: ChannelsState = {
                channels: {},
                byGuild: {},
                privateIds: [],
                versions: {},
            }
            for (const guild of ready.guilds ?? [])
                applyGuild(state, previous, guild)
            for (const channel of ready.private_channels ?? []) {
                state.channels[channel.id] = normalize(channel)
                state.privateIds.push(channel.id)
            }
            store.setState(state)
            requestPending(ready.guilds)
        })
        dispatch.on('GUILD_CREATE', guild => {
            const current = store.getState()
            const state = {
                ...current,
                channels: { ...current.channels },
                byGuild: { ...current.byGuild },
                versions: { ...current.versions },
            }
            applyGuild(state, current, guild)
            store.setState(state)
            requestPending([guild])
        })
        dispatch.on('GUILD_DELETE', ({ id }) =>
            store.setState(state => {
                const channels = { ...state.channels }
                for (const channelId of state.byGuild[id] ?? [])
                    delete channels[channelId]
                const { [id]: _removed, ...byGuild } = state.byGuild
                const { [id]: _version, ...versions } = state.versions
                return { channels, byGuild, versions }
            }),
        )
        // The answer to requestDeletedIds: whatever channel is not listed is gone.
        dispatch.on(
            'DELETED_ENTITY_IDS',
            ({ guild_id, channels: existing }) => {
                if (!existing) return
                const keep = new Set(existing)
                const { channels, byGuild } = store.getState()
                for (const id of byGuild[guild_id] ?? []) {
                    const channel = channels[id]
                    if (channel && !isThread(channel) && !keep.has(id))
                        remove(id)
                }
            },
        )
        dispatch.on('CHANNEL_CREATE', put)
        dispatch.on('CHANNEL_UPDATE', put)
        dispatch.on('CHANNEL_DELETE', channel =>
            remove(channel.id, channel.version),
        )

        // Only threads the user has joined are listed, as in the reference client.
        const putThread = (thread: Channel) => {
            const known = store.getState().channels[thread.id]
            if (thread.thread_metadata?.archived) remove(thread.id)
            else if (
                known ||
                thread.member ||
                thread.owner_id === session.userId
            )
                put(thread)
        }
        /**
         * Applies a guild's whole thread list in one update. A THREAD_LIST_SYNC carries every thread of the
         * guild, and `put` and `remove` copy every channel map on each call.
         */
        const syncThreads = (guildId: string, threads: Channel[]) => {
            store.setState(state => {
                let channels: Record<string, Channel> | undefined
                let byGuild: Record<string, string[]> | undefined
                for (const raw of threads) {
                    const prev = (channels ?? state.channels)[raw.id]
                    if (raw.thread_metadata?.archived) {
                        if (!prev) continue
                        channels ??= { ...state.channels }
                        delete channels[raw.id]
                        const ids = (byGuild ?? state.byGuild)[guildId] ?? []
                        byGuild ??= { ...state.byGuild }
                        byGuild[guildId] = ids.filter(id => id !== raw.id)
                        continue
                    }
                    if (
                        !(prev || raw.member || raw.owner_id === session.userId)
                    )
                        continue
                    channels ??= { ...state.channels }
                    const channel = normalize(
                        { ...prev, ...raw, member: raw.member ?? prev?.member },
                        guildId,
                    )
                    channels[channel.id] = channel
                    if (channel.member !== undefined) {
                        const ids = (byGuild ?? state.byGuild)[guildId] ?? []
                        if (!ids.includes(channel.id)) {
                            byGuild ??= { ...state.byGuild }
                            byGuild[guildId] = [...ids, channel.id]
                        }
                    }
                }
                if (!channels) return state
                return { channels, byGuild: byGuild ?? state.byGuild }
            })
        }
        dispatch.on('THREAD_CREATE', putThread)
        dispatch.on('THREAD_UPDATE', putThread)
        dispatch.on('THREAD_DELETE', thread => remove(thread.id))
        dispatch.on('THREAD_LIST_SYNC', sync => {
            const members = new Map(sync.members?.map(m => [m.id, m]))
            syncThreads(
                sync.guild_id,
                sync.threads.map(thread => ({
                    ...thread,
                    member: members.get(thread.id) ?? thread.member,
                })),
            )
        })

        /**
         * JoinedThreadsStore (THREAD_MEMBER_UPDATE, THREAD_MEMBERS_UPDATE): keeps the user's membership of a
         * held thread. Joining lists the thread; leaving unlists it, the record stays so its chat can stay open.
         */
        const setMember = (threadId: string, member: ThreadMember | null) =>
            store.setState(state => {
                const thread = state.channels[threadId]
                if (!thread) return state
                const { member: _old, ...rest } = thread
                const guildId = thread.guild_id
                const ids = (guildId && state.byGuild[guildId]) || []
                if (!member || !guildId)
                    return {
                        channels: { ...state.channels, [threadId]: rest },
                        byGuild: guildId
                            ? {
                                  ...state.byGuild,
                                  [guildId]: ids.filter(id => id !== threadId),
                              }
                            : state.byGuild,
                    }
                return {
                    channels: {
                        ...state.channels,
                        [threadId]: { ...rest, member },
                    },
                    byGuild: ids.includes(threadId)
                        ? state.byGuild
                        : { ...state.byGuild, [guildId]: [...ids, threadId] },
                }
            })
        const memberOf = ({
            flags,
            join_timestamp,
            muted,
            mute_config,
        }: ThreadMember): ThreadMember => ({
            flags,
            join_timestamp,
            muted,
            mute_config,
        })
        dispatch.on('THREAD_MEMBER_UPDATE', update => {
            if (!update.user_id || update.user_id === session.userId)
                setMember(update.id, memberOf(update))
        })
        dispatch.on('THREAD_MEMBERS_UPDATE', update => {
            if (update.removed_member_ids?.includes(session.userId))
                setMember(update.id, null)
            const mine = update.added_members?.find(
                added => added.user_id === session.userId,
            )
            if (mine) setMember(update.id, memberOf(mine as ThreadMember))
        })

        session.registerClientState(() => {
            const guilds = session.get(guildsStore).getState().guilds
            const { byGuild, versions } = store.getState()
            const expressions = session.get(expressionsStore).getState()
            const guild_versions: Record<string, number> = {}
            // GuildVersions.computeLatestVersion: the newest version of anything held for the guild.
            // READY gives only the guild itself a version, so channels and expressions just need to be held.
            for (const [id, guild] of Object.entries(guilds)) {
                const emojiStickers = expressionsVersion(expressions, id)
                if (
                    guild.version > 0 &&
                    byGuild[id] &&
                    emojiStickers !== undefined &&
                    !guild.pendingDeleteSync
                )
                    guild_versions[id] = Math.max(
                        guild.version,
                        versions[id] ?? 0,
                        emojiStickers,
                    )
            }
            return { guild_versions }
        })

        return store
    },
    {
        cache: ['channels', 'byGuild', 'privateIds', 'versions'],
        // One entry per guild, so a channel change rewrites only its guild.
        cacheParts: {
            split: ({
                channels = {},
                byGuild = {},
                privateIds = [],
                versions = {},
            }) => {
                const of = (ids: string[]) =>
                    ids.flatMap(id => channels[id] ?? [])
                const parts: Record<string, ChannelsPart> = {
                    [PRIVATE_PART]: {
                        ids: privateIds,
                        channels: of(privateIds),
                    },
                }
                for (const [guildId, ids] of Object.entries(byGuild))
                    parts[guildId] = {
                        ids,
                        version: versions[guildId],
                        channels: of(ids),
                    }
                return parts
            },
            join: parts => {
                const state: ChannelsState = {
                    channels: {},
                    byGuild: {},
                    privateIds: [],
                    versions: {},
                }
                for (const [key, part] of Object.entries(parts)) {
                    const { ids, version, channels } = part as ChannelsPart
                    for (const channel of channels)
                        state.channels[channel.id] = channel
                    if (key === PRIVATE_PART) state.privateIds = ids
                    else state.byGuild[key] = ids
                    if (version !== undefined) state.versions[key] = version
                }
                return state
            },
        },
        // 1: forum fields reach cached channels only with a full channel payload. 2: saved per guild.
        cacheVersion: 2,
        references: ({ channels = {}, privateIds = [] }, references) => {
            for (const id of privateIds)
                for (const recipient of channels[id]?.recipient_ids ?? [])
                    references.users.add(recipient)
        },
    },
)

/**
 * Holds a thread the user has not joined, from the thread browser or a message link, so its chat can open (the
 * reference's ChannelStore keeps every thread it loads). It is not listed with the guild's channels, and the next
 * READY drops it.
 */
export function holdThread(session: Session, thread: Channel): void {
    const store = session.get(channelsStore)
    const held = store.getState().channels[thread.id]
    // A held copy without the membership the forum search found takes it.
    if (held && (held.member || !thread.member)) return
    store.setState(state => ({
        channels: {
            ...state.channels,
            [thread.id]: held ? { ...held, member: thread.member } : thread,
        },
    }))
}
