import { logger } from '../../../core/log'
import { unparseMessage } from './parsing/parse'
import { parseContext } from './parsing/parseContext'
import { useComposerSlots } from './parsing/slots'
import {
    composerStore,
    endEdit,
    setReply,
    setReplyMention,
    startEdit,
} from './state/composerStore'
import type { Session } from '../../../core/session'
import type { DraftSync } from './input/draftSync'
import type { ComposerInput } from './input/nativeInput'
import type { createSender } from './outbox/sendPress'
import type { ComposerApi, LocalStore } from './state/ComposerContext'

const log = logger('Composer')

interface ApiParts {
    session: Session
    store: LocalStore
    input: ComposerInput
    drafts: DraftSync
    sender: ReturnType<typeof createSender>
    channelId: string
    nativeId: string
    /** Files wait for `uploadAll` to name the channel: a new thread's, a forward's or a share's. */
    deferFiles: boolean
}

/** Returns the text half of the API: reading and changing the input's text. */
function textApi(store: LocalStore, input: ComposerInput, drafts: DraftSync) {
    const replace: ComposerApi['replaceRange'] = (
        { location, length },
        text,
        options,
    ) => {
        const next = input.replaceRange(
            location,
            length,
            text,
            options?.keepCursorPosition,
        )
        if (next !== undefined) drafts.changed(next)
    }
    return {
        getText: () => store.getState().text,
        getSelection: () => store.getState().selection,
        flushText: input.flushText,
        insertText: ((text, options) => {
            const range = options?.range ?? store.getState().selection
            replace(
                { location: range.start, length: range.end - range.start },
                options?.space ? `${text} ` : text,
            )
        }) satisfies ComposerApi['insertText'],
        replaceRange: replace,
        setText: input.setText,
        setSelection: (start: number, end = start) =>
            input.setSelection(start, Math.max(0, end - start)),
        focus: () => input.focus(),
        blur: input.blur,
    }
}

/** Returns the panel half of the API: the custom keyboard and the media row. */
function panelApi(store: LocalStore, input: ComposerInput) {
    return {
        openCustomKeyboard: (panel: string) => {
            store.setState({ panel })
            input.focus('openCustomKeyboard')
        },
        closeCustomKeyboard: () =>
            store.setState({ panel: null, panelTyping: false }),
        openSystemKeyboard: () => {
            // A keyboard that is already up (for the panel's own field) holds the space: no event will come for
            // it, so the panel closes now.
            if (store.getState().keyboardOpen)
                store.setState({ panel: null, panelTyping: false })
            input.focus('openSystemKeyboard')
        },
        setPanelTyping: (typing: boolean) =>
            store.setState({ panelTyping: typing }),
        toggleMediaRow: () =>
            store.setState(state => ({ mediaRowOpen: !state.mediaRowOpen })),
    }
}

/** Returns the reply and edit half of the API. */
function messageApi({ session, input, drafts, channelId }: ApiParts) {
    return {
        setReplyTo: ((message, options) => {
            setReply(
                session,
                channelId,
                message && {
                    messageId: message.id,
                    authorId: message.author.id,
                    shouldMention: options?.mention ?? true,
                },
            )
            if (message) input.focus()
        }) satisfies ComposerApi['setReplyTo'],
        setReplyMention: (mention: boolean) =>
            setReplyMention(session, channelId, mention),
        setEditing: (message => {
            // handleCancelEditing: the edit ends, and the draft shows again.
            if (!message) return endEdit(session.get(composerStore), channelId)
            // The draft stays saved while the message is edited. Only the field shows the message, which the
            // edit subscription (`followEdits`) puts in it.
            drafts.keep(channelId)
            startEdit(
                session.get(composerStore),
                channelId,
                message,
                unparseMessage(
                    message.content ?? '',
                    parseContext(session, channelId),
                ),
            )
            input.focus()
        }) satisfies ComposerApi['setEditing'],
    }
}

/** Returns the API the composer's parts and the chat use. */
export function createComposerApi(parts: ApiParts): ComposerApi {
    const { session, store, input, drafts, sender, channelId } = parts
    const attachmentsKey = drafts.draftId(channelId)
    return {
        channelId,
        nativeId: parts.nativeId,
        attachmentsKey,
        ...textApi(store, input, drafts),
        ...panelApi(store, input),
        ...messageApi(parts),
        addAttachments: attachments => {
            const handler = useComposerSlots.getState().addAttachments
            if (!handler) return log.warn('No uploader registered')
            handler(
                {
                    session,
                    channelId,
                    key: attachmentsKey,
                    defer: parts.deferFiles,
                },
                attachments,
            )
        },
        send: () => void sender.send(),
        sendSticker: sender.sendSticker,
        sendGif: sender.sendGif,
    }
}
