import { createStore } from 'zustand/vanilla'
import { Endpoint } from '../../core/api/paths'
import { compareSnowflakes } from '../../core/discord/snowflake'
import { defineStore } from '../../core/session'
import { addMessageUsers } from '../messages/messages'
import { usersStore } from '../users'
import { channelsStore } from './channels'
import type { Message } from '../readStates'

/** Channels per `preload-messages` request, as the reference client batches them. */
const BATCH = 30
/** Only the most recent conversations are preloaded; the rest show no preview until they receive a message. */
const PRELOAD_LIMIT = 90

interface DmPreviewsState {
    /** Latest message of each DM and group DM. */
    messages: Record<string, Message>
}

/**
 * Last message of each private channel. READY only carries `last_message_id`, so the reference client
 * (MessagePreviewManager.fetchDms) POSTs `/channels/preload-messages` with up to 30 channel ids and
 * keeps the newest message of each; gateway events keep it current afterwards.
 */
export const dmPreviewsStore = defineStore(
    'dmPreviews',
    session => {
        const store = createStore<DmPreviewsState>(() => ({ messages: {} }))
        const { dispatch } = session.gateway
        let epoch = 0
        /** Channels whose preview a gateway event set during this connection; newer than any preload. */
        let live = new Set<string>()

        const isPrivateChannel = (channelId: string) =>
            session.get(channelsStore).getState().channels[channelId]
                ?.recipient_ids

        dispatch.on('READY', async () => {
            // Cached previews stay up until the fresh ones replace them; those of closed DMs go now.
            const current = ++epoch
            live = new Set()
            const open = new Set(
                session.get(channelsStore).getState().privateIds,
            )
            store.setState(state => ({
                messages: Object.fromEntries(
                    Object.entries(state.messages).filter(([id]) =>
                        open.has(id),
                    ),
                ),
            }))
            const { channels, privateIds } = session
                .get(channelsStore)
                .getState()
            const ids = [...privateIds]
                .filter(id => channels[id]?.last_message_id)
                .sort((a, b) =>
                    compareSnowflakes(
                        channels[b]?.last_message_id ?? '0',
                        channels[a]?.last_message_id ?? '0',
                    ),
                )
                .slice(0, PRELOAD_LIMIT)
            for (let i = 0; i < ids.length; i += BATCH) {
                try {
                    const page = await session.rest.post<Message[]>(
                        Endpoint.preloadMessages,
                        {
                            body: { channel_ids: ids.slice(i, i + BATCH) },
                        },
                    )
                    if (epoch !== current) return
                    session
                        .get(usersStore)
                        .getState()
                        .upsert(
                            page.flatMap(message => [
                                message.author,
                                ...(message.mentions ?? []),
                            ]),
                        )
                    const newest: Record<string, Message> = {}
                    for (const message of page) {
                        const known = newest[message.channel_id]
                        if (
                            !known ||
                            compareSnowflakes(message.id, known.id) > 0
                        )
                            newest[message.channel_id] = message
                    }
                    store.setState(state => {
                        const messages = { ...state.messages }
                        for (const [channelId, message] of Object.entries(
                            newest,
                        )) {
                            // A cached preview may have been edited or deleted since; only live updates are newer.
                            const known = messages[channelId]
                            if (
                                !known ||
                                !live.has(channelId) ||
                                compareSnowflakes(message.id, known.id) > 0
                            ) {
                                messages[channelId] = message
                            }
                        }
                        return { messages }
                    })
                } catch {
                    // A missing preview is not worth surfacing; the row just shows no second line.
                }
            }
        })
        dispatch.on('MESSAGE_CREATE', message => {
            if (!isPrivateChannel(message.channel_id)) return
            live.add(message.channel_id)
            store.setState(state => ({
                messages: { ...state.messages, [message.channel_id]: message },
            }))
        })
        dispatch.on('MESSAGE_UPDATE', update =>
            store.setState(state => {
                const known = state.messages[update.channel_id]
                if (known?.id !== update.id) return state
                live.add(update.channel_id)
                return {
                    messages: {
                        ...state.messages,
                        [update.channel_id]: { ...known, ...update },
                    },
                }
            }),
        )
        dispatch.on('MESSAGE_DELETE', ({ id, channel_id }) =>
            store.setState(state => {
                if (state.messages[channel_id]?.id !== id) return state
                live.add(channel_id)
                const { [channel_id]: _removed, ...messages } = state.messages
                return { messages }
            }),
        )
        dispatch.on('CHANNEL_DELETE', ({ id }) =>
            store.setState(state => {
                if (!state.messages[id]) return state
                const { [id]: _removed, ...messages } = state.messages
                return { messages }
            }),
        )

        return store
    },
    {
        cache: ['messages'],
        references: (saved, references) => {
            for (const message of Object.values(saved.messages ?? {}))
                addMessageUsers(message, references.users)
        },
    },
)
