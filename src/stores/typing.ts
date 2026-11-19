import { createStore } from 'zustand/vanilla'
import { defineStore } from '../core/session'
import type { RawMember } from './members'

declare module '../core/gateway/events' {
    interface GatewayEvents {
        TYPING_START: {
            channel_id: string
            guild_id?: string
            user_id: string
            timestamp: number
            /** Present in guilds, with the user. */
            member?: RawMember
        }
    }
}

/** TypingStore: a typing user is dropped after 10 seconds without a renewal. */
const TYPING_TIMEOUT = 10_000

const NOBODY: readonly string[] = []

interface TypingState {
    /** By channel id, the users typing there in the order they started. The current user is never listed. */
    typing: Record<string, readonly string[]>
}

export const typingUserIds = (state: TypingState, channelId: string) =>
    state.typing[channelId] ?? NOBODY

/** TypingStore: who is typing where, from TYPING_START, until it times out or the user's message arrives. */
export const typingStore = defineStore('typing', session => {
    const store = createStore<TypingState>(() => ({ typing: {} }))
    const { dispatch } = session.gateway
    const timers = new Map<string, ReturnType<typeof setTimeout>>()

    const stop = (channelId: string, userId: string) => {
        const key = `${channelId}:${userId}`
        clearTimeout(timers.get(key))
        timers.delete(key)
        store.setState(state => {
            const users = state.typing[channelId]
            if (!users?.includes(userId)) return state
            const rest = users.filter(id => id !== userId)
            const { [channelId]: _removed, ...typing } = state.typing
            return {
                typing: rest.length ? { ...typing, [channelId]: rest } : typing,
            }
        })
    }

    dispatch.on('READY', () => {
        for (const timer of timers.values()) clearTimeout(timer)
        timers.clear()
        store.setState({ typing: {} })
    })
    dispatch.on('TYPING_START', ({ channel_id, user_id }) => {
        // useTypingUserIds leaves the current user out; the gateway echoes their own typing back.
        if (user_id === session.userId) return
        const key = `${channel_id}:${user_id}`
        clearTimeout(timers.get(key))
        timers.set(
            key,
            setTimeout(() => stop(channel_id, user_id), TYPING_TIMEOUT),
        )
        store.setState(state => {
            const users = state.typing[channel_id] ?? NOBODY
            if (users.includes(user_id)) return state
            return {
                typing: { ...state.typing, [channel_id]: [...users, user_id] },
            }
        })
    })
    dispatch.on('MESSAGE_CREATE', message =>
        stop(message.channel_id, message.author.id),
    )

    return store
})
