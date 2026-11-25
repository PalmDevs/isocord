import { createStore } from 'zustand/vanilla'
import { ChannelType } from '../core/discord/channelType'
import { canEveryone, Permission } from '../core/discord/permissions'
import { compareSnowflakes } from '../core/discord/snowflake'
import { Opcode } from '../core/gateway/opcodes'
import { murmur3 } from '../core/murmur3'
import { defineStore } from '../core/session'
import { channelsStore, isThread } from './channels/channels'
import { guildsStore } from './guilds'
import { membersStore, toMember } from './members'
import { applyPresences } from './presences'
import { displayName, usersStore } from './users'
import type { ThreadMember } from '../core/discord/threadMember'
import type { Session } from '../core/session'
import type { Channel } from './channels/channels'
import type { Guild } from './guilds'
import type { Member, RawMember } from './members'
import type { PresenceUpdate } from './presences'
import type { User } from './users'

/** The lazy member list of a guild channel (GUILD_MEMBER_LIST_UPDATE), the reference's ChannelMemberStore. */

/** MemberListRowTypes: a section header or a member. */
export type MemberListRow =
    | { type: 'group'; id: string }
    | { type: 'member'; userId: string }

/** `online`, `offline` or a hoisted role's id; `count` is how many members it holds. */
export interface MemberListGroup {
    id: string
    count: number
}

type RawItem =
    | { group: MemberListGroup; member?: undefined }
    | {
          group?: undefined
          member: RawMember & { user: User; presence?: PresenceUpdate }
      }

type RawOp =
    | { op: 'SYNC'; range: [number, number]; items: RawItem[] }
    | { op: 'INVALIDATE'; range: [number, number] }
    | { op: 'INSERT'; index: number; item: RawItem }
    | { op: 'UPDATE'; index: number; item: RawItem }
    | { op: 'DELETE'; index: number }

export interface MemberListUpdate {
    guild_id: string
    /** The list id: `everyone`, or a hash of the channel's view overwrites. */
    id: string
    groups: MemberListGroup[]
    ops: RawOp[]
    member_count?: number
    online_count?: number
}

/** A member of a thread, as THREAD_MEMBER_LIST_UPDATE and THREAD_MEMBERS_UPDATE carry them. */
interface RawThreadMember extends Partial<ThreadMember> {
    user_id: string
    member?: RawMember & { user: User }
    presence?: PresenceUpdate | null
}

declare module '../core/gateway/events' {
    interface GatewayEvents {
        GUILD_MEMBER_LIST_UPDATE: MemberListUpdate
        /** The whole member list of a thread subscribed to with `thread_member_lists`. */
        THREAD_MEMBER_LIST_UPDATE: {
            guild_id: string
            thread_id: string
            members: RawThreadMember[]
            presences?: PresenceUpdate[]
        }
        THREAD_MEMBERS_UPDATE: {
            id: string
            guild_id: string
            added_members?: RawThreadMember[]
            removed_member_ids?: string[]
        }
    }
}

export interface MemberList {
    groups: MemberListGroup[]
    /** By position; positions the server has not sent (yet, or invalidated) are undefined. */
    rows: Array<MemberListRow | undefined>
    memberCount?: number
    onlineCount?: number
}

interface MemberListsState {
    /** By `${guildId}:${listId}`. */
    lists: Record<string, MemberList>
    /** The user ids of a thread's members, by thread id (ThreadMemberListStore's allUserIds). */
    threads: Record<string, string[]>
}

export const EVERYONE_LIST_ID = 'everyone'
export const ONLINE_GROUP = 'online'
export const OFFLINE_GROUP = 'offline'

const listKey = (guildId: string, listId: string) => `${guildId}:${listId}`

/** The server's count of rows: every group is a row of its own, then its members. */
export function totalRows(groups: MemberListGroup[]): number {
    let total = 0
    for (const group of groups) total += Math.max(0, group.count) + 1
    return total
}

const toRow = (item: RawItem): MemberListRow | undefined =>
    item.group
        ? { type: 'group', id: item.group.id }
        : item.member
          ? { type: 'member', userId: item.member.user.id }
          : undefined

/**
 * Threads list their own members (ThreadMemberListStore, `thread_member_lists`), except announcement threads, which
 * show their channel's list (GuildSubscriptionsStore's GUILD_SUBSCRIPTIONS_CHANNEL).
 */
export const hasThreadMemberList = (channel: Channel) =>
    isThread(channel) && channel.type !== ChannelType.ANNOUNCEMENT_THREAD

/** The channel whose member list a channel shows: an announcement thread's parent, else itself. */
export function memberListChannel(
    channels: Record<string, Channel>,
    channelId: string,
): Channel | undefined {
    const channel = channels[channelId]
    return channel?.type === ChannelType.ANNOUNCEMENT_THREAD &&
        channel.parent_id
        ? channels[channel.parent_id]
        : channel
}

/**
 * ChannelMemberStore.getMemberListId: which list a channel's members are in. Channels everyone can see
 * (`canEveryone`) share `everyone`. The others have a list per set of view overwrites, named by a hash of them.
 */
export function memberListIdOf(
    channel: Channel | undefined,
    guild: Guild | undefined,
): string {
    if (!channel || !guild) return EVERYONE_LIST_ID
    if (canEveryone(guild, channel, Permission.VIEW_CHANNEL))
        return EVERYONE_LIST_ID
    const parts: string[] = []
    for (const overwrite of channel.permission_overwrites ?? []) {
        if (BigInt(overwrite.allow) & Permission.VIEW_CHANNEL)
            parts.push(`allow:${overwrite.id}`)
        else if (BigInt(overwrite.deny) & Permission.VIEW_CHANNEL)
            parts.push(`deny:${overwrite.id}`)
    }
    return String(murmur3(parts.sort().join(',')))
}

export function memberListId(session: Session, channelId: string): string {
    const channel = memberListChannel(
        session.get(channelsStore).getState().channels,
        channelId,
    )
    const guild = channel?.guild_id
        ? session.get(guildsStore).getState().guilds[channel.guild_id]
        : undefined
    return memberListIdOf(channel, guild)
}

export const memberListStore = defineStore('memberList', session => {
    const store = createStore<MemberListsState>(() => ({
        lists: {},
        threads: {},
    }))
    const { dispatch } = session.gateway

    const learn = (
        guildId: string,
        all: Array<(RawMember & { user: User }) | undefined>,
        presences: PresenceUpdate[] = [],
    ) => {
        const users: User[] = []
        const members: Array<[string, Member]> = []
        for (const member of all) {
            if (!member) continue
            users.push(member.user)
            members.push([member.user.id, toMember(member)])
        }
        session.get(usersStore).getState().upsert(users)
        session.get(membersStore).getState().put(guildId, members)
        applyPresences(session, presences)
    }
    const learnItems = (guildId: string, items: RawItem[]) =>
        learn(
            guildId,
            items.map(item => item.member),
            items.flatMap(({ member }) =>
                member?.presence
                    ? [{ ...member.presence, user_id: member.user.id }]
                    : [],
            ),
        )
    const learnThreadMembers = (
        guildId: string,
        members: RawThreadMember[],
        presences: PresenceUpdate[] = [],
    ) =>
        learn(
            guildId,
            members.map(member => member.member),
            [
                ...presences,
                ...members.flatMap(member =>
                    member.presence
                        ? [{ ...member.presence, user_id: member.user_id }]
                        : [],
                ),
            ],
        )
    const setThread = (threadId: string, userIds: string[] | undefined) =>
        store.setState(state => {
            if (!userIds && !state.threads[threadId]) return state
            const { [threadId]: _, ...threads } = state.threads
            return {
                threads: userIds
                    ? { ...threads, [threadId]: userIds }
                    : threads,
            }
        })

    dispatch.on('READY', () => {
        store.setState({ lists: {}, threads: {} })
        resubscribe(session)
    })
    // GuildSubscriptionsStore.handleConnectionOpenOrResumed: a resumed session is sent the subscriptions held again
    // too, since any asked for while the connection was down were never sent.
    dispatch.on('RESUMED', () => resubscribe(session))
    // A guild back from an outage has its lists asked for again: GUILD_DELETE dropped them, and the open member list
    // does not ask again by itself. Only then: the GUILD_CREATE of a guild loading after READY would repeat what READY
    // just sent, and that repeat can leave the list without its first SYNC (GuildSubscriptionsStore.handleGuildCreate
    // sends no member lists either).
    const outages = new Set<string>()
    dispatch.on('GUILD_CREATE', guild => {
        if (outages.delete(guild.id)) resubscribe(session, guild.id)
    })
    // ThreadMemberListStore.handleThreadMemberListUpdate: the list is replaced as a whole.
    dispatch.on('THREAD_MEMBER_LIST_UPDATE', update => {
        learnThreadMembers(update.guild_id, update.members, update.presences)
        setThread(
            update.thread_id,
            update.members.map(member => member.user_id),
        )
    })
    // ThreadMemberListStore.handleThreadMembersUpdate: only for threads whose list is held.
    dispatch.on('THREAD_MEMBERS_UPDATE', update => {
        const known = store.getState().threads[update.id]
        if (!known) return
        const added = update.added_members ?? []
        learnThreadMembers(update.guild_id, added)
        const removed = new Set(update.removed_member_ids)
        const ids = known.filter(id => !removed.has(id))
        for (const member of added)
            if (!ids.includes(member.user_id)) ids.push(member.user_id)
        setThread(update.id, ids)
    })
    // GuildSubscriptionsStore: an archived or deleted thread's list is no longer subscribed to.
    dispatch.on('THREAD_UPDATE', thread => {
        if (!thread.guild_id || !thread.thread_metadata?.archived) return
        unsubscribeThreadMemberList(session, thread.guild_id, thread.id)
        setThread(thread.id, undefined)
    })
    dispatch.on('THREAD_DELETE', thread => {
        unsubscribeThreadMemberList(session, thread.guild_id, thread.id)
        setThread(thread.id, undefined)
    })
    dispatch.on('GUILD_MEMBER_LIST_UPDATE', update => {
        const key = listKey(update.guild_id, update.id)
        const known = store.getState().lists[key]
        const rows = known ? [...known.rows] : []
        const items: RawItem[] = []
        for (const op of update.ops) {
            if (op.op === 'SYNC') {
                op.items.forEach((item, offset) => {
                    rows[op.range[0] + offset] = toRow(item)
                })
                items.push(...op.items)
            } else if (op.op === 'INVALIDATE') {
                for (let index = op.range[0]; index <= op.range[1]; index++)
                    delete rows[index]
            } else if (op.op === 'INSERT') {
                rows.splice(op.index, 0, toRow(op.item))
                items.push(op.item)
            } else if (op.op === 'UPDATE') {
                rows[op.index] = toRow(op.item)
                items.push(op.item)
            } else if (op.op === 'DELETE') {
                rows.splice(op.index, 1)
            }
        }
        learnItems(update.guild_id, items)
        // The groups say how many rows there are: whatever is beyond is dropped, whatever is missing is not loaded.
        // Rows no op touched keep their objects, so a list can re-render only the rows that changed.
        rows.length = totalRows(update.groups)
        store.setState(state => ({
            lists: {
                ...state.lists,
                [key]: {
                    groups: update.groups,
                    rows,
                    memberCount: update.member_count ?? known?.memberCount,
                    onlineCount: update.online_count ?? known?.onlineCount,
                },
            },
        }))
    })
    dispatch.on('GUILD_DELETE', ({ id, unavailable }) => {
        // GuildSubscriptionsStore.handleGuildDelete: a guild left is no longer subscribed to. A guild in an outage
        // keeps what is held, to be asked for again on its GUILD_CREATE.
        if (unavailable) outages.add(id)
        else {
            const { guilds, channels, threads } = subscriptionsOf(session)
            guilds.delete(id)
            channels.delete(id)
            threads.delete(id)
        }
        const prefix = `${id}:`
        store.setState(state => ({
            ...state,
            lists: Object.fromEntries(
                Object.entries(state.lists).filter(
                    ([key]) => !key.startsWith(prefix),
                ),
            ),
        }))
    })

    return store
})

/** GuildChannelSubscriptions.MINIMUM_RANGE: ranges are asked for in blocks of this many rows. */
export const MINIMUM_RANGE = 100
const DEFAULT_RANGES: Array<[number, number]> = [[0, MINIMUM_RANGE - 1]]
/** GuildChannelSubscriptions keeps the ranges of the five channels asked for last, per guild. */
const MAX_CHANNELS_PER_GUILD = 5

/** GuildThreadSubscriptions keeps the member lists of the three threads asked for last, per guild. */
const MAX_THREADS_PER_GUILD = 3

type Ranges = Array<[number, number]>
/** One guild's part of GUILD_SUBSCRIPTIONS_BULK. */
interface GuildSubscription {
    typing?: true
    activities?: true
    threads?: true
    channels?: Record<string, Ranges>
    thread_member_lists?: string[]
}
interface Subscriptions {
    /** Guilds subscribed to with `typing`, `activities` and `threads` (GuildSubscriptions' _typing and the like). */
    guilds: Set<string>
    /** Guilds subscribed to for `threads` only (forum post notifications). */
    threadGuilds: Set<string>
    /** By guild id, then channel id, oldest first. */
    channels: Map<string, Map<string, Ranges>>
    /** By guild id: thread ids, oldest first. */
    threads: Map<string, string[]>
    /** GuildSubscriptions._pending: what is to be sent, by guild id. */
    pending: Record<string, GuildSubscription>
    flush?: ReturnType<typeof setTimeout>
}
const subscriptions = new WeakMap<Session, Subscriptions>()

const subscriptionsOf = (session: Session) => {
    let held = subscriptions.get(session)
    if (!held) {
        held = {
            guilds: new Set(),
            threadGuilds: new Set(),
            channels: new Map(),
            threads: new Map(),
            pending: {},
        }
        subscriptions.set(session, held)
    }
    return held
}

/**
 * GuildSubscriptions._enqueue: what is asked for a guild within one tick is merged and sent as one message
 * (`DelayedCall(0)`). Sending `channels` apart from `typing`/`activities`/`threads` loses the member list's first
 * SYNC now and then when they reach a guild the server is still loading.
 */
const enqueue = (
    session: Session,
    guildId: string,
    subscription: GuildSubscription,
) => {
    const held = subscriptionsOf(session)
    held.pending[guildId] = { ...held.pending[guildId], ...subscription }
    held.flush ??= setTimeout(() => flush(session), 0)
}

/**
 * GuildSubscriptions.flush. What is not sent for a guild is left as it was. As GatewayConnectionStore's
 * GUILD_SUBSCRIPTIONS_FLUSH, nothing is sent until the session is established: the server would drop it. What is
 * held is sent on the next READY or RESUMED instead (`resubscribe`).
 */
function flush(session: Session): void {
    const held = subscriptionsOf(session)
    const pending = held.pending
    held.pending = {}
    held.flush = undefined
    if (session.gateway.state !== 'connected') return
    session.gateway.send(Opcode.GUILD_SUBSCRIPTIONS_BULK, {
        subscriptions: pending,
    })
}

const send = (
    session: Session,
    guildId: string,
    subscription: {
        channels?: Map<string, Ranges>
        thread_member_lists?: string[]
    },
) =>
    enqueue(session, guildId, {
        ...(subscription.channels && {
            channels: Object.fromEntries(subscription.channels),
        }),
        ...(subscription.thread_member_lists && {
            thread_member_lists: subscription.thread_member_lists,
        }),
    })

/** GuildSubscriptions.subscribeToGuild: typing, activities and threads of a guild, once per guild. */
export function subscribeToGuild(session: Session, guildId: string): void {
    const { guilds } = subscriptionsOf(session)
    if (guilds.has(guildId)) return
    guilds.add(guildId)
    enqueue(session, guildId, { typing: true, activities: true, threads: true })
}

/** Subscribes to `threads` only for a guild, so THREAD_CREATE arrives for forum posts. */
export function subscribeToGuildThreads(
    session: Session,
    guildId: string,
): void {
    const { guilds, threadGuilds } = subscriptionsOf(session)
    if (guilds.has(guildId) || threadGuilds.has(guildId)) return
    threadGuilds.add(guildId)
    enqueue(session, guildId, { threads: true })
}

/**
 * GuildSubscriptionsStore.handleConnectionOpenOrResumed: after a reconnect the server has forgotten every
 * subscription, and what was asked for while the connection was down was never sent. Each guild's whole state is
 * asked for again in one message, of every guild or only of `only`.
 */
function resubscribe(session: Session, only?: string): void {
    const { guilds, threadGuilds, channels, threads } = subscriptionsOf(session)
    const ids = new Set([
        ...guilds,
        ...threadGuilds,
        ...channels.keys(),
        ...threads.keys(),
    ])
    for (const guildId of ids) {
        if (only && guildId !== only) continue
        if (guilds.has(guildId))
            enqueue(session, guildId, {
                typing: true,
                activities: true,
                threads: true,
            })
        else if (threadGuilds.has(guildId))
            enqueue(session, guildId, { threads: true })
        send(session, guildId, {
            channels: channels.get(guildId),
            thread_member_lists: threads.get(guildId),
        })
    }
}

const sameRanges = (a: Ranges | undefined, b: Ranges) =>
    a !== undefined && JSON.stringify(a) === JSON.stringify(b)

/**
 * Asks for the rows of a channel's member list (GUILD_SUBSCRIPTIONS_BULK with `channels: { id: ranges }`); the
 * answer is GUILD_MEMBER_LIST_UPDATE. The server keeps the channels asked for last, five at most per guild, so
 * what is sent is every one held, not just this. An announcement thread asks for its channel's list.
 */
export function subscribeMemberList(
    session: Session,
    guildId: string,
    channelId: string,
    ranges: Ranges = DEFAULT_RANGES,
): void {
    const id =
        memberListChannel(
            session.get(channelsStore).getState().channels,
            channelId,
        )?.id ?? channelId
    const guilds = subscriptionsOf(session).channels
    let channels = guilds.get(guildId)
    if (!channels) {
        channels = new Map()
        guilds.set(guildId, channels)
    }
    if (sameRanges(channels.get(id), ranges)) return
    // Re-inserted last, so the oldest is the one dropped.
    channels.delete(id)
    channels.set(id, ranges)
    if (channels.size > MAX_CHANNELS_PER_GUILD)
        channels.delete(channels.keys().next().value as string)
    send(session, guildId, { channels })
}

/**
 * GuildSubscriptions.subscribeThreadMemberList: asks for a thread's members (`thread_member_lists`, the threads
 * held for the guild, three at most); the answer is THREAD_MEMBER_LIST_UPDATE. Nothing is sent for a thread held.
 */
export function subscribeThreadMemberList(
    session: Session,
    guildId: string,
    threadId: string,
): void {
    const { threads } = subscriptionsOf(session)
    const known = threads.get(guildId) ?? []
    // Moved last, so the oldest is the one dropped.
    const ids = [...known.filter(id => id !== threadId), threadId].slice(
        -MAX_THREADS_PER_GUILD,
    )
    threads.set(guildId, ids)
    if (!known.includes(threadId))
        send(session, guildId, { thread_member_lists: ids })
}

function unsubscribeThreadMemberList(
    session: Session,
    guildId: string,
    threadId: string,
): void {
    const { threads } = subscriptionsOf(session)
    const ids = threads.get(guildId)
    if (!ids?.includes(threadId)) return
    const rest = ids.filter(id => id !== threadId)
    threads.set(guildId, rest)
    send(session, guildId, { thread_member_lists: rest })
}

/**
 * Starts loading a channel's member list (its first rows, or a thread's members) so it is there when the channel
 * details open. Does nothing when the list is already asked for, so it is cheap to call on every open.
 */
export function prefetchMemberList(session: Session, channelId: string): void {
    const channel = session.get(channelsStore).getState().channels[channelId]
    const guildId = channel?.guild_id
    if (!channel || !guildId) return
    if (hasThreadMemberList(channel)) {
        // GuildSubscriptionsStore only subscribes to active threads.
        if (!channel.thread_metadata?.archived)
            subscribeThreadMemberList(session, guildId, channel.id)
        return
    }
    const id =
        memberListChannel(
            session.get(channelsStore).getState().channels,
            channelId,
        )?.id ?? channelId
    if (!subscriptionsOf(session).channels.get(guildId)?.has(id))
        subscribeMemberList(session, guildId, channelId)
}

/**
 * GuildSubscriptionsActionCreators.subscribeChannelDimensions: the ranges covering rows `first` to `last`, with
 * half a screen of rows more on each side, in blocks of MINIMUM_RANGE. The first block is always asked for.
 */
export function rangesFor(first: number, last: number): Ranges {
    const buffer = Math.ceil((last - first + 1) / 2)
    const from = Math.max(0, first - buffer)
    const to = Math.max(0, last + buffer)
    const ranges: Ranges = []
    let start = from
    if (from > 0) {
        ranges.push([0, MINIMUM_RANGE - 1])
        start = Math.max(MINIMUM_RANGE, from)
    }
    for (
        let block = Math.floor(start / MINIMUM_RANGE) * MINIMUM_RANGE;
        block <= to;
        block += MINIMUM_RANGE
    )
        ranges.push([block, block + MINIMUM_RANGE - 1])
    return ranges
}

/** A section of a thread's member list: a hoisted role, `online` or `offline`, and its members in order. */
export interface ThreadMemberSection {
    id: string
    userIds: string[]
}

/**
 * useThreadMemberListSections with ThreadMemberList.calculateNewState: the guild's hoisted roles from the top, then
 * Online and Offline. An offline member is in Offline, the others under their highest hoisted role, else Online.
 * Each section is sorted by the lowercased nickname or name, then id. Users not loaded are left out.
 * `users`, `members` and `online` are those of `userIds`, in the same order.
 */
export function threadMemberSections(
    guild: Guild | undefined,
    userIds: readonly string[],
    users: ReadonlyArray<User | undefined>,
    members: ReadonlyArray<Member | undefined>,
    online: readonly boolean[],
): ThreadMemberSection[] {
    const hoisted = Object.values(guild?.roles ?? {})
        .filter(role => role.hoist)
        .sort(
            (a, b) =>
                (b.position ?? 0) - (a.position ?? 0) ||
                compareSnowflakes(a.id, b.id),
        )
    const sections = new Map<string, Array<{ id: string; name: string }>>()
    for (const role of hoisted) sections.set(role.id, [])
    sections.set(ONLINE_GROUP, [])
    sections.set(OFFLINE_GROUP, [])
    userIds.forEach((id, index) => {
        const user = users[index]
        if (!user) return
        const member = members[index]
        let section = OFFLINE_GROUP
        if (online[index])
            section =
                hoisted.find(role => member?.roles.includes(role.id))?.id ??
                ONLINE_GROUP
        sections.get(section)?.push({
            id,
            name: (member?.nick ?? displayName(user)).toLowerCase(),
        })
    })
    return [...sections].map(([id, entries]) => ({
        id,
        userIds: entries
            .sort((a, b) =>
                a.name === b.name
                    ? compareSnowflakes(a.id, b.id)
                    : a.name < b.name
                      ? -1
                      : 1,
            )
            .map(entry => entry.id),
    }))
}
