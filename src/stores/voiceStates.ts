import { createStore } from 'zustand/vanilla'
import { defineStore } from '../core/session'
import { membersStore, toMember } from './members'
import { usersStore } from './users'
import type { CallCreate } from './callEvents'
import type { RawMember } from './members'

/** A voice state as the gateway sends it. Guild voice states in READY and GUILD_CREATE leave `member` out. */
export interface RawVoiceState {
    user_id: string
    guild_id?: string | null
    channel_id: string | null
    session_id: string
    deaf?: boolean
    mute?: boolean
    self_deaf?: boolean
    self_mute?: boolean
    self_video?: boolean
    self_stream?: boolean
    suppress?: boolean
    request_to_speak_timestamp?: string | null
    member?: RawMember
}

declare module '../core/gateway/events' {
    interface GatewayEvents {
        VOICE_STATE_UPDATE: RawVoiceState
        /** dispatchSocketMessage VOICE_STATE_UPDATE_BATCH: several updates, each like VOICE_STATE_UPDATE. */
        VOICE_STATE_UPDATE_BATCH: { voice_states: RawVoiceState[] }
    }
}

/** A guild of READY_SUPPLEMENTAL (hydrateReadySupplementalPayload). An unavailable one carries nothing. */
interface SupplementalGuild {
    id: string
    unavailable?: boolean
    voice_states?: RawVoiceState[]
}
declare module './guilds' {
    interface RawGuild {
        voice_states?: RawVoiceState[]
    }
}
declare module './channels/channels' {
    interface Channel {
        /** Voice channels: the most users allowed, 0 for no limit. */
        user_limit?: number
    }
}

/** VoiceStateRecord: a user in a voice channel. A user who left has no voice state. */
export interface VoiceState {
    userId: string
    /** Null in a DM or group DM call (VoiceStateStore's `guildId: null`). */
    guildId: string | null
    channelId: string
    sessionId: string
    /** Server mute and deafen, from a moderator. */
    mute: boolean
    deaf: boolean
    selfMute: boolean
    selfDeaf: boolean
    selfVideo: boolean
    /** Go Live. */
    selfStream: boolean
    /** Stage channels: an audience member without permission to speak. */
    suppress: boolean
}

export interface VoiceStatesState {
    /** By guild id (`DM_KEY` for calls in DMs), then user id. */
    byGuild: Record<string, Record<string, VoiceState>>
    /** By channel id, in the order users joined. A list is replaced only when its channel changes. */
    byChannel: Record<string, readonly VoiceState[]>
}

/** The `byGuild` key of the voice states of DM and group DM calls, which have no guild. */
const DM_KEY = '@me'

const guildKey = (guildId: string | null) => guildId ?? DM_KEY

const NOBODY: readonly VoiceState[] = []

/** Returns the voice states in a channel, the same array until the channel changes. */
export const channelVoiceStates = (
    state: VoiceStatesState,
    channelId: string,
) => state.byChannel[channelId] ?? NOBODY

/** Returns a user's voice state in a guild, or in DM calls for a null guild. */
export const guildVoiceState = (
    state: VoiceStatesState,
    guildId: string | null,
    userId: string,
) => state.byGuild[guildKey(guildId)]?.[userId]

const toVoiceState = (
    raw: RawVoiceState,
    guildId: string | null,
): VoiceState | null =>
    raw.channel_id
        ? {
              userId: raw.user_id,
              guildId,
              channelId: raw.channel_id,
              sessionId: raw.session_id,
              mute: raw.mute ?? false,
              deaf: raw.deaf ?? false,
              selfMute: raw.self_mute ?? false,
              selfDeaf: raw.self_deaf ?? false,
              selfVideo: raw.self_video ?? false,
              selfStream: raw.self_stream ?? false,
              suppress: raw.suppress ?? false,
          }
        : null

const same = (a: VoiceState, b: VoiceState) =>
    a.channelId === b.channelId &&
    a.sessionId === b.sessionId &&
    a.mute === b.mute &&
    a.deaf === b.deaf &&
    a.selfMute === b.selfMute &&
    a.selfDeaf === b.selfDeaf &&
    a.selfVideo === b.selfVideo &&
    a.selfStream === b.selfStream &&
    a.suppress === b.suppress

type Change = readonly [userId: string, next: VoiceState | null]

/** VoiceStateStore.updateVoiceState for a batch: a null state removes the user. Returns `state` when nothing changed. */
function apply(
    state: VoiceStatesState,
    guildId: string | null,
    changes: readonly Change[],
): VoiceStatesState {
    const key = guildKey(guildId)
    const guild = { ...state.byGuild[key] }
    const byChannel = { ...state.byChannel }
    let changed = false
    for (const [userId, next] of changes) {
        const old = guild[userId]
        if (old && next && same(old, next)) continue
        if (!old && !next) continue
        changed = true
        if (next) guild[userId] = next
        else delete guild[userId]
        if (old && next && old.channelId === next.channelId) {
            byChannel[next.channelId] = (
                byChannel[next.channelId] ?? NOBODY
            ).map(voice => (voice.userId === userId ? next : voice))
            continue
        }
        if (old) {
            const rest = (byChannel[old.channelId] ?? NOBODY).filter(
                voice => voice.userId !== userId,
            )
            if (rest.length > 0) byChannel[old.channelId] = rest
            else delete byChannel[old.channelId]
        }
        if (next)
            byChannel[next.channelId] = [
                ...(byChannel[next.channelId] ?? NOBODY),
                next,
            ]
    }
    if (!changed) return state
    return { byGuild: { ...state.byGuild, [key]: guild }, byChannel }
}

/** Removes every voice state of a guild (VoiceStateStore handleGuildCreateOrDelete). */
const clearGuild = (state: VoiceStatesState, guildId: string) =>
    apply(
        state,
        guildId,
        Object.keys(state.byGuild[guildId] ?? {}).map(
            userId => [userId, null] as const,
        ),
    )

const toChanges = (
    raws: readonly RawVoiceState[],
    guildId: string | null,
): Change[] =>
    raws.map(raw => [raw.user_id, toVoiceState(raw, guildId)] as const)

/** Removes everyone from a DM or group DM call (VoiceStateStore's CALL_DELETE). */
const clearCall = (state: VoiceStatesState, channelId: string) =>
    apply(
        state,
        null,
        (state.byChannel[channelId] ?? NOBODY).map(
            voice => [voice.userId, null] as const,
        ),
    )

/** The voice states of a call, or none when it carries none. */
const callVoiceStates = (call: CallCreate): readonly RawVoiceState[] =>
    call.voice_states ?? []

/**
 * VoiceStateStore: who is in which voice channel, from READY_SUPPLEMENTAL, GUILD_CREATE, PASSIVE_UPDATE_V2 and
 * VOICE_STATE_UPDATE.
 * Live state, so it is not cached. A voice state without a guild is a DM or group DM call, from CALL_CREATE too.
 */
export const voiceStatesStore = defineStore('voiceStates', session => {
    const store = createStore<VoiceStatesState>(() => ({
        byGuild: {},
        byChannel: {},
    }))
    const { dispatch } = session.gateway

    // CONNECTION_OPEN keeps the voice states, which READY lacks for user accounts. CONNECTION_OPEN_SUPPLEMENTAL
    // replaces them all with the guilds' ones.
    dispatch.on('READY_SUPPLEMENTAL', supplemental => {
        const { guilds } = supplemental as typeof supplemental & {
            guilds?: SupplementalGuild[]
        }
        let state: VoiceStatesState = { byGuild: {}, byChannel: {} }
        for (const guild of guilds ?? [])
            if (guild.unavailable !== true)
                state = apply(
                    state,
                    guild.id,
                    toChanges(guild.voice_states ?? [], guild.id),
                )
        store.setState(state, true)
    })
    dispatch.on('VOICE_STATE_UPDATE_BATCH', ({ voice_states }) =>
        store.setState(state =>
            voice_states.reduce((current, update) => {
                const guildId = update.guild_id ?? null
                return apply(current, guildId, toChanges([update], guildId))
            }, state),
        ),
    )
    dispatch.on('GUILD_CREATE', guild =>
        store.setState(state =>
            apply(
                clearGuild(state, guild.id),
                guild.id,
                toChanges(guild.voice_states ?? [], guild.id),
            ),
        ),
    )
    dispatch.on('GUILD_DELETE', ({ id }) =>
        store.setState(state => clearGuild(state, id)),
    )
    dispatch.on('VOICE_STATE_UPDATE', update => {
        // No guild: a DM or group DM call.
        const guildId = update.guild_id ?? null
        if (update.member?.user) {
            session.get(usersStore).getState().upsert([update.member.user])
            if (guildId)
                session
                    .get(membersStore)
                    .getState()
                    .put(guildId, [[update.user_id, toMember(update.member)]])
        }
        store.setState(state =>
            apply(state, guildId, toChanges([update], guildId)),
        )
    })
    // CALL_CREATE lists everyone in the call, so users it leaves out are gone (dispatchSocketMessage dispatches
    // VOICE_STATE_UPDATES with `guildId: null`).
    dispatch.on('CALL_CREATE', call =>
        store.setState(state =>
            apply(
                clearCall(state, call.channel_id),
                null,
                toChanges(callVoiceStates(call), null),
            ),
        ),
    )
    dispatch.on('CALL_DELETE', call =>
        store.setState(state => clearCall(state, call.channel_id)),
    )
    // The guilds the user has not opened send their voice changes here.
    dispatch.on('PASSIVE_UPDATE_V2', update => {
        const { updated_voice_states, removed_voice_states } =
            update as typeof update & {
                updated_voice_states?: RawVoiceState[]
                removed_voice_states?: string[]
            }
        const changes = [
            ...toChanges(updated_voice_states ?? [], update.guild_id),
            ...(removed_voice_states ?? []).map(
                userId => [userId, null] as const,
            ),
        ]
        if (changes.length > 0)
            store.setState(state => apply(state, update.guild_id, changes))
    })

    return store
})
