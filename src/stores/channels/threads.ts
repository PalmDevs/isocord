import { createStore } from 'zustand/vanilla'
import { MessageType } from '../../core/discord/messages'
import { defineStore } from '../../core/session'
import { isThread } from './channels'
import type { Message } from '../readStates'
import type { Channel } from './channels'

/** Never a thread's most recent message (ThreadMessageStore). */
const { THREAD_STARTER_MESSAGE } = MessageType

interface ThreadsState {
    /**
     * ActiveThreadsStore: the active threads of the guilds, by id. The joined ones come with READY and
     * GUILD_CREATE, the others with THREAD_LIST_SYNC once a guild is subscribed with `threads`, and THREAD_CREATE.
     */
    active: Record<string, Channel>
    /** ThreadMessageStore.getMostRecentMessage: the newest message of an active thread, by thread id. */
    mostRecent: Record<string, Message>
}

/** The active threads of the guilds and their newest messages, for the thread browser (the Threads tab). */
export const threadsStore = defineStore('threads', session => {
    const store = createStore<ThreadsState>(() => ({
        active: {},
        mostRecent: {},
    }))
    const { dispatch } = session.gateway

    const without = (
        state: ThreadsState,
        drop: (thread: Channel) => boolean,
    ): ThreadsState => {
        const active: Record<string, Channel> = {}
        const mostRecent = { ...state.mostRecent }
        for (const thread of Object.values(state.active)) {
            if (drop(thread)) delete mostRecent[thread.id]
            else active[thread.id] = thread
        }
        return { active, mostRecent }
    }
    const withThreads = (
        state: ThreadsState,
        threads: Channel[],
        guildId: string,
    ): ThreadsState => {
        const active = { ...state.active }
        for (const thread of threads)
            if (isThread(thread) && !thread.thread_metadata?.archived)
                active[thread.id] = { ...thread, guild_id: guildId }
        return { ...state, active }
    }

    dispatch.on('READY', ready => {
        let state: ThreadsState = { active: {}, mostRecent: {} }
        for (const guild of ready.guilds ?? [])
            state = withThreads(state, guild.threads ?? [], guild.id)
        store.setState(state)
    })
    dispatch.on('GUILD_CREATE', guild =>
        store.setState(state =>
            withThreads(state, guild.threads ?? [], guild.id),
        ),
    )
    dispatch.on('GUILD_DELETE', ({ id }) =>
        store.setState(state =>
            without(state, thread => thread.guild_id === id),
        ),
    )
    dispatch.on('THREAD_LIST_SYNC', sync =>
        store.setState(state => {
            const parents = sync.channel_ids && new Set(sync.channel_ids)
            const next = withThreads(
                without(
                    state,
                    thread =>
                        thread.guild_id === sync.guild_id &&
                        (!parents || parents.has(thread.parent_id ?? '')),
                ),
                sync.threads,
                sync.guild_id,
            )
            for (const message of sync.most_recent_messages ?? [])
                if (
                    next.active[message.channel_id] &&
                    message.type !== THREAD_STARTER_MESSAGE
                )
                    next.mostRecent[message.channel_id] = message
            return next
        }),
    )
    const putThread = (thread: Channel) =>
        store.setState(state =>
            thread.thread_metadata?.archived
                ? without(state, other => other.id === thread.id)
                : withThreads(
                      state,
                      [{ ...state.active[thread.id], ...thread }],
                      thread.guild_id ?? '',
                  ),
        )
    dispatch.on('THREAD_CREATE', putThread)
    dispatch.on('THREAD_UPDATE', putThread)
    dispatch.on('THREAD_DELETE', ({ id }) =>
        store.setState(state => without(state, thread => thread.id === id)),
    )
    dispatch.on('CHANNEL_DELETE', channel =>
        store.setState(state =>
            without(state, thread => thread.parent_id === channel.id),
        ),
    )
    dispatch.on('MESSAGE_CREATE', message => {
        const thread = store.getState().active[message.channel_id]
        if (!thread || message.type === THREAD_STARTER_MESSAGE) return
        store.setState(state => ({
            active: {
                ...state.active,
                // ThreadMessageStore counts each new message.
                [thread.id]: {
                    ...thread,
                    last_message_id: message.id,
                    message_count: (thread.message_count ?? 0) + 1,
                },
            },
            mostRecent: { ...state.mostRecent, [thread.id]: message },
        }))
    })
    dispatch.on('MESSAGE_UPDATE', update => {
        const held = store.getState().mostRecent[update.channel_id]
        if (held?.id !== update.id) return
        store.setState(state => ({
            mostRecent: {
                ...state.mostRecent,
                [update.channel_id]: { ...held, ...update },
            },
        }))
    })
    dispatch.on('MESSAGE_DELETE', ({ id, channel_id }) => {
        if (store.getState().mostRecent[channel_id]?.id !== id) return
        store.setState(state => {
            const { [channel_id]: _removed, ...mostRecent } = state.mostRecent
            return { mostRecent }
        })
    })

    return store
})
