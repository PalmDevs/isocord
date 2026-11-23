import { useEffect, useLayoutEffect } from 'react'
import { AppState } from 'react-native'
import { loadDraft, onDraftSaved, saveDraft } from '../outbox/drafts'
import { composerStore, updateEdit } from '../state/composerStore'
import { throttle } from '../throttle'
import { startTyping } from '../typing'
import type { Session } from '../../../../core/session'
import type { Message } from '../../../../stores/readStates'
import type { LocalStore } from '../state/ComposerContext'
import type { ComposerInput } from './nativeInput'

/** The reference's pace for drafts and the typing indicator. */
const SETTLE_MS = 500

/**
 * Creates the link between the input's text and the chat's draft or edit. With `separate`, the text is not the
 * chat's (a thread's first message, DraftType.FirstThreadMessage, or a forward's, DraftType.ForwardContextMessage):
 * its draft is kept where `separate` says, nobody is told the user is typing, and the channel's edit is not this
 * composer's.
 */
export function createDraftSync(
    session: Session,
    store: LocalStore,
    input: ComposerInput,
    separate: ((id: string) => string) | undefined,
) {
    const edits = session.get(composerStore)
    const apart = separate !== undefined
    /** Where the draft of `id` is kept. */
    const draftId = (id: string) => separate?.(id) ?? id
    const editing = (id: string) =>
        apart ? undefined : edits.getState().editing[id]

    // While a message is edited the text is the edit's, not a draft, and nobody is told the user is typing (the
    // reference's draft throttle skips both while `pendingEdit` is set). It is kept beside the edit instead.
    const settle = throttle(
        (id: string, text: string, message: Message | undefined) => {
            if (message) return updateEdit(edits, id, message, text)
            saveDraft(session, draftId(id), text, store)
            if (!apart && text.length > 0 && !text.startsWith('/'))
                startTyping(session, id)
        },
        SETTLE_MS,
    )

    /**
     * useChatInputRefs.flushPendingDraftSave: the pending save is written before the text is replaced. The
     * keystrokes of the last frame have not been reported yet, so the input is read once more and what it really
     * held becomes the draft, or the edit's text while a message is edited.
     */
    const keep = (id: string) => {
        settle.flush()
        const message = editing(id)
        const shown = store.getState().text
        void input.flushText().then(text => {
            if (text === shown) return
            if (message) updateEdit(edits, id, message, text)
            else saveDraft(session, draftId(id), text, store)
        })
    }

    return {
        draftId,
        editing,
        settle,
        keep,
        /** Takes a changed text of the chat the input shows. */
        changed: (text: string) =>
            settle(input.channelId, text, editing(input.channelId)),

        /** Empties the chat's draft and the input. */
        clear: (id: string) => {
            saveDraft(session, draftId(id), '', store)
            settle.cancel()
            input.setText('')
        },

        /**
         * Switching chats: the old chat's draft (or edit) is written, the new chat's draft (or edit, as it was left)
         * shows (ChatInput's defaultValue: `getEditingTextValue`, else the draft).
         */
        show: (id: string) => {
            const previous = input.channelId
            if (previous !== id) {
                keep(previous)
                input.cancelRestyle()
            }
            input.channelId = id
            input.setText(
                (apart ? undefined : edits.getState().editText[id]) ??
                    loadDraft(session, draftId(id)),
            )
            store.setState({ panel: null, mediaRowOpen: false })
        },

        /**
         * Every composer showing a chat shows its edit, as the reference's all read EditMessageStore: an edit that
         * starts, changes in another composer or ends (saved, cancelled, its message deleted) shows here too, and an
         * ended one gives the field back to the draft. The composer that wrote the text already shows it.
         */
        followEdits: () => {
            if (apart) return undefined
            return edits.subscribe((state, previous) => {
                const id = input.channelId
                const text = state.editText[id]
                if (text === previous.editText[id]) return
                const shown = text ?? loadDraft(session, id)
                if (store.getState().text !== shown) input.setText(shown)
            })
        },

        /**
         * Another composer showing this chat (the other tab's, a stacked panel's) saved its draft: this one shows it
         * too, so it does not write its old text back over it.
         */
        followOtherComposers: () =>
            onDraftSaved((from, id, text, source) => {
                if (from !== session || source === store) return
                if (id !== draftId(input.channelId)) return
                if (editing(input.channelId)) return
                if (store.getState().text !== text) input.setText(text)
            }),
    }
}

export type DraftSync = ReturnType<typeof createDraftSync>

/** Keeps the input and the drafts in step while the composer shows `channelId`. */
export function useDraftSync(drafts: DraftSync, channelId: string): void {
    useLayoutEffect(() => drafts.show(channelId), [drafts, channelId])
    useEffect(() => drafts.followEdits(), [drafts])
    useEffect(() => drafts.followOtherComposers(), [drafts])
    // Leaving the app writes the pending draft at once: the system may kill the app in the background.
    useEffect(() => {
        const subscription = AppState.addEventListener('change', state => {
            if (state !== 'active') drafts.settle.flush()
        })
        return () => subscription.remove()
    }, [drafts])
    useEffect(() => () => drafts.settle.flush(), [drafts])
}
