import { createStore } from 'zustand/vanilla'
import { defineStore } from '../../../../core/session'
import type { StoreApi } from 'zustand'
import type { Session } from '../../../../core/session'
import type { Message } from '../../../../stores/readStates'
import type { ReplyTarget } from '../outbox/outbox'

interface ChannelComposerState {
    replies: Record<string, ReplyTarget>
    /** The message being edited, by channel. */
    editing: Record<string, Message>
    /**
     * The text of each channel's edit as the input last held it (EditMessageStore's `textValue`), so a chat the user
     * leaves in the middle of an edit shows the changed text when they come back. Set and removed with `editing`.
     */
    editText: Record<string, string>
}

/**
 * What each channel's composer is replying to or editing; kept for the session so switching chats loses neither.
 * Like the reference's EditMessageStore, edits live in memory only: a restarted app has none.
 */
export const composerStore = defineStore('composer', session => {
    const store = createStore<ChannelComposerState>(() => ({
        replies: {},
        editing: {},
        editText: {},
    }))
    // EditMessageStore.handleMessageDelete: deleting the message being edited ends its edit.
    session.gateway.dispatch.on('MESSAGE_DELETE', ({ id, channel_id }) => {
        if (store.getState().editing[channel_id]?.id === id)
            endEdit(store, channel_id)
    })
    return store
})

type EditStore = StoreApi<ChannelComposerState>

/** MESSAGE_START_EDIT: the edit begins with the message's own text, and the channel's pending reply goes. */
export function startEdit(
    edits: EditStore,
    channelId: string,
    message: Message,
    text: string,
): void {
    edits.setState(state => {
        const { [channelId]: _removed, ...replies } = state.replies
        return {
            editing: { ...state.editing, [channelId]: message },
            editText: { ...state.editText, [channelId]: text },
            replies,
        }
    })
}

/**
 * MESSAGE_UPDATE_EDIT: keeps the edit's text. A write meant for an edit that has since been saved, cancelled or
 * replaced by another is dropped.
 */
export function updateEdit(
    edits: EditStore,
    channelId: string,
    message: Message,
    text: string,
): void {
    const state = edits.getState()
    if (state.editing[channelId] !== message) return
    if (state.editText[channelId] === text) return
    edits.setState({ editText: { ...state.editText, [channelId]: text } })
}

/** MESSAGE_END_EDIT: the channel's edit and its text go; the composers showing the channel bring its draft back. */
export function endEdit(edits: EditStore, channelId: string): void {
    edits.setState(state => {
        const { [channelId]: _message, ...editing } = state.editing
        const { [channelId]: _text, ...editText } = state.editText
        return { editing, editText }
    })
}

/** Sets the channel's reply, or removes it with null. */
export function setReply(
    session: Session,
    channelId: string,
    reply: ReplyTarget | null,
): void {
    session.get(composerStore).setState(state => {
        const { [channelId]: _removed, ...replies } = state.replies
        return { replies: reply ? { ...replies, [channelId]: reply } : replies }
    })
}

/** Turns the ping of the channel's reply on or off. */
export function setReplyMention(
    session: Session,
    channelId: string,
    mention: boolean,
): void {
    session.get(composerStore).setState(state => {
        const current = state.replies[channelId]
        return current
            ? {
                  replies: {
                      ...state.replies,
                      [channelId]: { ...current, shouldMention: mention },
                  },
              }
            : state
    })
}
