import { createStore } from 'zustand/vanilla'
import { Opcode } from '../core/gateway/opcodes'
import { defineStore } from '../core/session'
import { usersStore } from './users'
import type { Session } from '../core/session'
import type { PresenceUpdate } from './presences'
import type { User } from './users'

/**
 * A guild member: the server overrides of the user's profile and their roles (GuildMemberStore's member, plus the
 * banner, bio and pronouns of UserProfileStore's guild member profile when an object carries them). A field an
 * object leaves out keeps what the store has.
 */
export interface Member {
    nick?: string | null
    roles: string[]
    avatar?: string | null
    avatar_decoration_data?: { asset: string } | null
    banner?: string | null
    bio?: string | null
    pronouns?: string | null
    /** GuildMemberFlags. */
    flags?: number
}

export interface RawMember extends Member {
    user?: User
    user_id?: string
}

declare module '../core/gateway/events' {
    interface GatewayEvents {
        GUILD_MEMBERS_CHUNK: {
            guild_id: string
            members: RawMember[]
            not_found?: string[]
            /** Presences of the members, when the request asked for them. */
            presences?: PresenceUpdate[]
            /** Echo of the request's nonce. */
            nonce?: string
        }
        GUILD_MEMBER_UPDATE: Member & { guild_id: string; user: User }
    }
}
declare module './readStates' {
    interface Message {
        /** Present on gateway messages sent in a guild. */
        member?: Member
    }
}

interface MembersState {
    /** By guild id, then user id. Only members the client has had a reason to load. */
    members: Record<string, Record<string, Member>>
    /** Adds members learned outside GUILD_MEMBERS_CHUNK (the member list), skipping those already known. */
    put: (guildId: string, entries: Array<[string, Member]>) => void
}

export const membersStore = defineStore(
    'members',
    session => {
        const store = createStore<MembersState>(() => ({
            members: {},
            put: (guildId, entries) => put(guildId, entries),
        }))
        const { dispatch } = session.gateway

        const same = (a: Member | undefined, b: Member) =>
            a !== undefined &&
            a.nick === b.nick &&
            a.avatar === b.avatar &&
            a.avatar_decoration_data?.asset ===
                b.avatar_decoration_data?.asset &&
            a.banner === b.banner &&
            a.bio === b.bio &&
            a.pronouns === b.pronouns &&
            a.roles.join() === b.roles.join()
        const put = (guildId: string, all: Array<[string, Member]>) => {
            const old = stale.get(session)
            for (const [id] of all) old?.delete(`${guildId}:${id}`)
            // Most gateway messages repeat a member the store already has; skip those to spare subscribers.
            const known = store.getState().members[guildId]
            const entries: Array<[string, Member]> = []
            for (const [id, member] of all) {
                const merged = { ...known?.[id], ...member }
                if (!same(known?.[id], merged)) entries.push([id, merged])
            }
            if (entries.length === 0) return
            store.setState(state => ({
                members: {
                    ...state.members,
                    [guildId]: {
                        ...state.members[guildId],
                        ...Object.fromEntries(entries),
                    },
                },
            }))
        }

        // Members restored from the cache, or loaded before a reconnect, stay on screen but are asked for again.
        dispatch.on('READY', () => {
            const old = new Set<string>()
            for (const [guildId, members] of Object.entries(
                store.getState().members,
            ))
                for (const id of Object.keys(members))
                    old.add(`${guildId}:${id}`)
            stale.set(session, old)
            requested.get(session)?.clear()
        })
        dispatch.on('GUILD_MEMBERS_CHUNK', chunk => {
            // Chunks of searches and of other lists carry users no other event told about.
            session
                .get(usersStore)
                .getState()
                .upsert(chunk.members.map(member => member.user))
            const entries: Array<[string, Member]> = []
            for (const member of chunk.members) {
                const id = member.user?.id ?? member.user_id
                if (id) entries.push([id, toMember(member)])
            }
            // Remember users who left so they are not requested again.
            for (const id of chunk.not_found ?? [])
                entries.push([id, { roles: [] }])
            put(chunk.guild_id, entries)
        })
        dispatch.on('MESSAGE_CREATE', message => {
            if (message.guild_id && message.member)
                put(message.guild_id, [
                    [message.author.id, toMember(message.member)],
                ])
        })
        // Guild typing events carry the member, so the typing indicator can name someone not loaded yet.
        dispatch.on('TYPING_START', ({ guild_id, user_id, member }) => {
            if (!guild_id || !member) return
            session.get(usersStore).getState().upsert([member.user])
            put(guild_id, [[user_id, toMember(member)]])
        })
        dispatch.on('GUILD_MEMBER_UPDATE', update => {
            if (store.getState().members[update.guild_id]?.[update.user.id])
                put(update.guild_id, [[update.user.id, toMember(update)]])
        })

        return store
    },
    {
        // Members are only ever added, so only those the cached state of other stores shows are saved, for
        // their server names, avatars and role colours before READY.
        cache: (state, references) => {
            const members: Record<string, Record<string, Member>> = {}
            for (const [guildId, ids] of references().members) {
                const known = state.members[guildId]
                if (!known) continue
                const saved = (members[guildId] ??= {})
                for (const id of ids) if (known[id]) saved[id] = known[id]
            }
            return { members }
        },
    },
)

const FIELDS = [
    'nick',
    'avatar',
    'avatar_decoration_data',
    'banner',
    'bio',
    'pronouns',
] as const

/** The member fields of a gateway or REST member object; the ones it leaves out stay out, so they are not cleared. */
export function toMember(raw: Member): Member {
    const member: Member = { roles: raw.roles ?? [] }
    for (const key of FIELDS)
        if (key in raw)
            (member as unknown as Record<string, unknown>)[key] = raw[key]
    return member
}

const requested = new WeakMap<Session, Set<string>>()
/** `${guildId}:${userId}` of members held from before the last READY, not asked for again since. */
const stale = new WeakMap<Session, Set<string>>()

/** Asks the gateway for the members that are not loaded yet. Results arrive in GUILD_MEMBERS_CHUNK. */
export function requestMembers(
    session: Session,
    guildId: string,
    userIds: string[],
): void {
    let pending = requested.get(session)
    if (!pending) {
        pending = new Set()
        requested.set(session, pending)
    }
    const known = session.get(membersStore).getState().members[guildId] ?? {}
    const old = stale.get(session)
    const missing = [...new Set(userIds)].filter(
        id =>
            (!known[id] || old?.has(`${guildId}:${id}`)) &&
            !pending.has(`${guildId}:${id}`),
    )
    if (missing.length === 0) return
    // The gateway accepts at most 100 ids per request.
    for (let index = 0; index < missing.length; index += 100) {
        const batch = missing.slice(index, index + 100)
        const sent = session.gateway.send(Opcode.REQUEST_GUILD_MEMBERS, {
            guild_id: [guildId],
            user_ids: batch,
            presences: false,
        })
        // A request dropped while reconnecting is retried the next time the channel asks.
        if (sent) for (const id of batch) pending.add(`${guildId}:${id}`)
    }
}

/** `${guildId}:${query}` of the autocomplete's member requests, with when they were made. */
const autocompleteQueries = new WeakMap<Session, Map<string, number>>()
const autocompleteTimers = new WeakMap<Session, ReturnType<typeof setTimeout>>()
/** GuildUtils.requestMembers: a query is not asked for again within a minute (its cache's maxAge). */
const AUTOCOMPLETE_QUERY_MAX_AGE_MS = 60_000
/** GuildUtils.requestMembers: only the last query typed within this many milliseconds is sent. */
const AUTOCOMPLETE_QUERY_DEBOUNCE_MS = 200

/**
 * GuildUtils.requestMembers, as the mention autocomplete calls it (queryChannelUsers): asks the gateway for up to
 * `limit` members whose name starts with `query`, with their presences (GuildActionCreators.requestMembers). The
 * request waits until the typing pauses, and a query asked for in the last minute is not asked for again. The
 * members arrive in GUILD_MEMBERS_CHUNK, which puts them in the store the autocomplete reads.
 */
export function requestAutocompleteMembers(
    session: Session,
    guildId: string,
    query: string,
    limit: number,
): void {
    let asked = autocompleteQueries.get(session)
    if (!asked) {
        asked = new Map()
        autocompleteQueries.set(session, asked)
    }
    const key = `${guildId}:${query}`
    const now = Date.now()
    if (now - (asked.get(key) ?? -Infinity) < AUTOCOMPLETE_QUERY_MAX_AGE_MS)
        return
    asked.set(key, now)
    clearTimeout(autocompleteTimers.get(session))
    autocompleteTimers.set(
        session,
        setTimeout(() => {
            const sent = session.gateway.send(Opcode.REQUEST_GUILD_MEMBERS, {
                guild_id: [guildId],
                query,
                limit,
                presences: true,
            })
            // A request dropped while reconnecting is sent the next time the query is typed.
            if (!sent) asked.delete(key)
        }, AUTOCOMPLETE_QUERY_DEBOUNCE_MS),
    )
}

/** The reference's member search (SearchMemberTabStore): prefix matches, 50 at most, with presences. */
export const MEMBER_SEARCH_LIMIT = 50

/**
 * Asks the gateway for the members whose name starts with `query` (REQUEST_GUILD_MEMBERS). The answer is a
 * GUILD_MEMBERS_CHUNK echoing `nonce`. Returns false when the socket is not open and nothing was sent.
 */
export function searchGuildMembers(
    session: Session,
    guildId: string,
    query: string,
    nonce: string,
): boolean {
    return session.gateway.send(Opcode.REQUEST_GUILD_MEMBERS, {
        guild_id: [guildId],
        query,
        limit: MEMBER_SEARCH_LIMIT,
        presences: true,
        nonce,
    })
}
