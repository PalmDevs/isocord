import { createStore } from 'zustand/vanilla'
import { defineStore } from '../../core/session'
import { channelsStore } from '../channels/channels'
import {
    sameEmoji,
    withPollVote,
    withReactionAdded,
    withReactionRemoved,
} from './reactionEdits'
import type { Session } from '../../core/session'
import type { Message } from '../readStates'
import type { User } from '../users'
import type { MessagesState, Reaction } from './messageTypes'
import type { ReactionChange } from './reactionEdits'

export type ReactionEvent = {
    channel_id: string
    message_id: string
    user_id: string
    emoji: Reaction['emoji']
    /** A super reaction. */
    burst?: boolean
    /** Only on MESSAGE_REACTION_ADD of a super reaction. */
    burst_colors?: string[]
    /** Local only: where a reaction taken back by a failed removal goes back in the list. */
    restore_index?: number
    /** Only on MESSAGE_REACTION_ADD. */
    member?: { nick?: string | null; user?: User }
    message_author_id?: string
}

/** Returns what a reaction event changes, `mine` when `userId` made it. */
export const reactionChangeOf = (
    event: ReactionEvent,
    userId: string,
): ReactionChange => ({
    emoji: event.emoji,
    burst: event.burst === true,
    burstColors: event.burst_colors,
    index: event.restore_index,
    mine: event.user_id === userId,
})

/** MESSAGE_POLL_VOTE_ADD and _REMOVE. */
type PollVoteEvent = {
    channel_id: string
    message_id: string
    user_id: string
    answer_id: number
}

declare module '../../core/gateway/events' {
    interface GatewayEvents {
        MESSAGE_UPDATE: Partial<Message> & { id: string; channel_id: string }
        MESSAGE_DELETE: { id: string; channel_id: string }
        MESSAGE_DELETE_BULK: { ids: string[]; channel_id: string }
        MESSAGE_REACTION_ADD: ReactionEvent
        MESSAGE_REACTION_REMOVE: ReactionEvent
        MESSAGE_REACTION_REMOVE_ALL: { channel_id: string; message_id: string }
        MESSAGE_REACTION_REMOVE_EMOJI: {
            channel_id: string
            message_id: string
            emoji: Reaction['emoji']
        }
        MESSAGE_POLL_VOTE_ADD: PollVoteEvent
        MESSAGE_POLL_VOTE_REMOVE: PollVoteEvent
    }
}

/** A message of a channel, from its chat window or from the preview. */
export function findMessage(
    state: MessagesState,
    channelId: string,
    messageId: string,
): Message | undefined {
    return (
        state.channels[channelId]?.messages.find(
            message => message.id === messageId,
        ) ??
        (state.preview?.channelId === channelId
            ? state.preview.messages.find(message => message.id === messageId)
            : undefined)
    )
}

/** The loaded messages a message is shown among (newest first): its chat window, or the preview. */
export function messagesAround(
    state: MessagesState,
    channelId: string,
    messageId: string,
): Message[] {
    const chat = state.channels[channelId]?.messages ?? []
    if (chat.some(message => message.id === messageId)) return chat
    return state.preview?.channelId === channelId
        ? state.preview.messages
        : chat
}

/** Messages one history request asks for. */
export const PAGE_SIZE = 50

const CACHED_CHANNELS = 10

/** Channels whose newest page is saved to the cache. */
function cachedChannels(state: MessagesState): Array<[string, Message[]]> {
    return state.recent.slice(0, CACHED_CHANNELS).flatMap(id => {
        // A detached window is not the newest page.
        if (state.channels[id]?.hasMoreAfter) return []
        const messages = state.channels[id]?.messages
        // Messages still being sent are not worth restoring: they can no longer be sent after a restart.
        const sent = messages?.filter(message => !message.state)
        return sent?.length
            ? [[id, sent.slice(0, PAGE_SIZE)] as [string, Message[]]]
            : []
    })
}
/** Adds the users a message shows: its author, its mentions and the author of the message it replies to. */
export function addMessageUsers(message: Message, users: Set<string>): void {
    users.add(message.author.id)
    for (const user of message.mentions ?? []) users.add(user.id)
    if (message.referenced_message)
        users.add(message.referenced_message.author.id)
}
/** Puts a server message into a channel's list, replacing the pending message it confirms (same nonce). */
function confirmPending(messages: Message[], message: Message): Message[] {
    const pending =
        message.nonce === undefined
            ? -1
            : messages.findIndex(
                  existing =>
                      existing.state !== undefined &&
                      String(existing.nonce) === String(message.nonce),
              )
    if (pending !== -1) {
        // The echo may have arrived first, in which case the real message is already there.
        const rest = messages.filter(
            (existing, index) =>
                index !== pending && existing.id !== message.id,
        )
        const at = Math.min(pending, rest.length)
        return [...rest.slice(0, at), message, ...rest.slice(at)]
    }
    return messages.some(existing => existing.id === message.id)
        ? messages
        : [message, ...messages]
}

export const messagesStore = defineStore(
    'messages',
    session => {
        const store = createStore<MessagesState>(() => ({
            channels: {},
            recent: [],
        }))
        const { dispatch } = session.gateway

        /** Changes a channel's loaded messages, and the preview's when it shows the channel (`preview`). */
        const edit = (
            channelId: string,
            change: (messages: Message[]) => Message[],
            preview = true,
        ) =>
            store.setState(state => {
                let next: Partial<MessagesState> | undefined
                const channel = state.channels[channelId]
                const messages = channel && change(channel.messages)
                if (channel && messages && messages !== channel.messages)
                    next = {
                        channels: {
                            ...state.channels,
                            [channelId]: { ...channel, messages },
                        },
                    }
                const shown = state.preview
                if (preview && shown?.channelId === channelId) {
                    const changed = change(shown.messages)
                    if (changed !== shown.messages)
                        next = {
                            ...next,
                            preview: { ...shown, messages: changed },
                        }
                }
                return next ?? state
            })
        const editOne = (
            channelId: string,
            id: string,
            change: (message: Message) => Message,
        ) =>
            edit(channelId, messages => {
                const index = messages.findIndex(message => message.id === id)
                const current = messages[index]
                if (!current) return messages
                const changed = change(current)
                if (changed === current) return messages
                const next = [...messages]
                next[index] = changed
                return next
            })

        // A detached window does not reach the present: the message is picked up when the user returns to it.
        dispatch.on('MESSAGE_CREATE', message =>
            edit(
                message.channel_id,
                messages =>
                    store.getState().channels[message.channel_id]?.hasMoreAfter
                        ? messages
                        : confirmPending(messages, message),
                false,
            ),
        )
        dispatch.on('MESSAGE_UPDATE', update =>
            editOne(update.channel_id, update.id, message => ({
                ...message,
                ...update,
            })),
        )
        // MessageStore MESSAGE_DELETE: a deleted revealed message hands the reveal to the next newer one.
        const passReveal = (channelId: string, ids: string[]) =>
            store.setState(state => {
                const channel = state.channels[channelId]
                const revealed = channel?.revealedId
                if (!channel || !revealed || !ids.includes(revealed))
                    return state
                const index = channel.messages.findIndex(
                    message => message.id === revealed,
                )
                // Newest first: the newer messages come before it.
                const newer = channel.messages
                    .slice(0, Math.max(index, 0))
                    .reverse()
                    .find(message => !ids.includes(message.id))
                return {
                    channels: {
                        ...state.channels,
                        [channelId]: { ...channel, revealedId: newer?.id },
                    },
                }
            })
        dispatch.on('MESSAGE_DELETE', ({ id, channel_id }) => {
            passReveal(channel_id, [id])
            edit(channel_id, messages => {
                const next = messages.filter(message => message.id !== id)
                return next.length === messages.length ? messages : next
            })
        })
        dispatch.on('MESSAGE_DELETE_BULK', ({ ids, channel_id }) => {
            passReveal(channel_id, ids)
            edit(channel_id, messages => {
                const next = messages.filter(
                    message => !ids.includes(message.id),
                )
                return next.length === messages.length ? messages : next
            })
        })
        const reactionChange = (event: ReactionEvent) =>
            reactionChangeOf(event, session.userId)
        dispatch.on('MESSAGE_REACTION_ADD', event =>
            editOne(event.channel_id, event.message_id, message =>
                withReactionAdded(message, reactionChange(event)),
            ),
        )
        dispatch.on('MESSAGE_REACTION_REMOVE_ALL', event =>
            editOne(event.channel_id, event.message_id, message => ({
                ...message,
                reactions: [],
            })),
        )
        dispatch.on('MESSAGE_REACTION_REMOVE_EMOJI', event =>
            editOne(event.channel_id, event.message_id, message => ({
                ...message,
                reactions: (message.reactions ?? []).filter(
                    reaction => !sameEmoji(reaction.emoji, event.emoji),
                ),
            })),
        )
        dispatch.on('MESSAGE_REACTION_REMOVE', event =>
            editOne(event.channel_id, event.message_id, message =>
                withReactionRemoved(message, reactionChange(event)),
            ),
        )
        const pollVote = (event: PollVoteEvent, added: boolean) =>
            editOne(event.channel_id, event.message_id, message =>
                withPollVote(
                    message,
                    Number(event.answer_id),
                    event.user_id === session.userId,
                    added,
                ),
            )
        dispatch.on('MESSAGE_POLL_VOTE_ADD', event => pollVote(event, true))
        dispatch.on('MESSAGE_POLL_VOTE_REMOVE', event => pollVote(event, false))

        return store
    },
    {
        cache: state => ({
            channels: Object.fromEntries(
                cachedChannels(state).map(([id, messages]) => [
                    id,
                    {
                        messages,
                        hasMore: true,
                        loading: false,
                        error: false,
                        stale: true,
                    },
                ]),
            ),
            recent: state.recent.slice(0, CACHED_CHANNELS),
        }),
        // Members only for the authors, for their server names, avatars and role colours.
        references: (saved, references, session) => {
            const { channels } = session.get(channelsStore).getState()
            for (const [id, { messages }] of Object.entries(
                saved.channels ?? {},
            )) {
                const guildId = channels[id]?.guild_id
                let members: Set<string> | undefined
                if (guildId) {
                    members = references.members.get(guildId) ?? new Set()
                    references.members.set(guildId, members)
                }
                for (const message of messages) {
                    addMessageUsers(message, references.users)
                    members?.add(message.author.id)
                }
            }
        },
    },
)

function editChannel(
    session: Session,
    channelId: string,
    change: (messages: Message[]) => Message[],
): void {
    session.get(messagesStore).setState(state => {
        const channel = state.channels[channelId]
        if (!channel) return state
        const messages = change(channel.messages)
        if (messages === channel.messages) return state
        return {
            channels: {
                ...state.channels,
                [channelId]: { ...channel, messages },
            },
        }
    })
}

/** MessageActionCreators.revealMessage: opens a blocked or ignored messages group, or closes it when open. */
export function toggleRevealed(
    session: Session,
    channelId: string,
    groupId: string,
): void {
    setRevealed(session, channelId, id =>
        id === groupId ? undefined : groupId,
    )
}

/** MessageStore MESSAGE_REVEAL: opens the blocked or ignored messages group that holds a message, for a jump. */
export function revealMessage(
    session: Session,
    channelId: string,
    messageId: string,
): void {
    setRevealed(session, channelId, () => messageId)
}

function setRevealed(
    session: Session,
    channelId: string,
    next: (revealedId: string | undefined) => string | undefined,
): void {
    session.get(messagesStore).setState(state => {
        const channel = state.channels[channelId]
        if (!channel) return state
        const revealedId = next(channel.revealedId)
        if (revealedId === channel.revealedId) return state
        return {
            channels: {
                ...state.channels,
                [channelId]: { ...channel, revealedId },
            },
        }
    })
}

/** Shows a message the user is sending at the bottom of the chat. Its id is its nonce until the server answers. */
export function addPendingMessage(session: Session, message: Message): void {
    editChannel(session, message.channel_id, messages => [
        { ...message, state: 'sending' },
        ...messages,
    ])
}

/** Replaces a pending message with what the server answered (the gateway echo may already have done so). */
export function confirmPendingMessage(
    session: Session,
    channelId: string,
    message: Message,
): void {
    editChannel(session, channelId, messages =>
        confirmPending(messages, message),
    )
}

export function setPendingState(
    session: Session,
    channelId: string,
    nonce: string,
    state: 'sending' | 'failed',
): void {
    editChannel(session, channelId, messages =>
        messages.map(message =>
            message.state && String(message.nonce) === nonce
                ? { ...message, state }
                : message,
        ),
    )
}

export function removePendingMessage(
    session: Session,
    channelId: string,
    nonce: string,
): void {
    editChannel(session, channelId, messages =>
        messages.filter(
            message => !(message.state && String(message.nonce) === nonce),
        ),
    )
}
