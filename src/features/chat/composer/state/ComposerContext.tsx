import {
    useEffect,
    useId,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react'
import { useUnistyles } from 'react-native-unistyles'
import { createStore, useStore } from 'zustand'
import { useSession } from '../../../../core/react'
import { createComposerApi } from '../api'
import { createDraftSync, useDraftSync } from '../input/draftSync'
import {
    useBackClosesPanel,
    useDismissal,
    useKeyboardTracking,
} from '../input/keyboard'
import { createComposerInput } from '../input/nativeInput'
import { createSender } from '../outbox/sendPress'
import { styleBlocks } from '../parsing/parse'
import { parseContext } from '../parsing/parseContext'
import { useCanSend, useCanStartThread, useSlowmode } from './status'
import { ApiContext, InternalContext } from './useComposer'
import type { ReactNode } from 'react'
import type { StoreApi } from 'zustand'
import type { Message } from '../../../../stores/readStates'
import type { ComposerAttachment } from '../parsing/slots'
import type { Internals } from './useComposer'

// Kept for `threads/create.ts`, which imports it from here.
export type { ComposerAttachment } from '../parsing/slots'

export interface ComposerState {
    text: string
    selection: { start: number; end: number }
    focused: boolean
    keyboardOpen: boolean
    /** An input command needs the native field before the opening animation settles. */
    inputRequested: boolean
    /** Name of the panel shown in the custom-keyboard area, or null. */
    panel: string | null
    /** A field inside the panel (its search) has the keyboard, so a keyboard coming up must not close the panel. */
    panelTyping: boolean
    mediaRowOpen: boolean
    /** Height of the typing indicator while it is up (0 otherwise); the chat list makes room for it. */
    typingInset: number
    /** The user may send messages here. While not, the composer shows none of its panels and buttons. */
    canSend: boolean
    /** Seconds of slowmode left before the next message, 0 when none. */
    slowmode: number
    /** The composer writes the first message of a thread it creates (ComposerProvider's `thread`). */
    creatingThread: boolean
    /** The text goes with a forward or a share (ComposerProvider's `attached`). */
    attached: boolean
    /** While `attached`: somewhere to send it is picked. */
    attachedReady: boolean
    /** While `attached`: it may go without text or files (AttachedMessage's `allowsEmpty`). */
    attachedAllowsEmpty: boolean
}

export type LocalStore = StoreApi<ComposerState>

/** A composer's thread to create (ComposerProvider's `thread`). */
export interface ThreadCreation {
    /** Creates the thread; resolves its id, or undefined when it was not created (the screen shows why). */
    create: () => Promise<string | undefined>
    /** The thread exists, and its first message, if there is one, is on its way. */
    onCreated: (threadId: string) => void
}

/**
 * A composer whose text goes with a forward or a share (ComposerProvider's `attached`), like ForwardMessageFooter's
 * and ShareScreenFooter's chat input. The screen around it picks where it goes.
 */
export interface AttachedMessage {
    /** Where its draft and files are kept, apart from any chat's (DraftType.ForwardContextMessage). */
    draftId: string
    /** Somewhere to send it is picked. */
    ready: boolean
    /** The forward carries a message of its own, so the text and files may be empty. A share needs one of them. */
    allowsEmpty: boolean
    /** Sends the forward or share with the text. Resolves whether it went, which clears the text. */
    send: (content: string, silent: boolean) => Promise<boolean>
}

export interface ComposerApi {
    channelId: string
    /**
     * The `nativeID` of the composer's floating part (the card and what sits on it), unique per composer. The chat
     * list reads its height to keep the messages still while it grows (`composerNativeId` of IsocordChatView).
     */
    nativeId: string
    /**
     * The composer's pending files in the upload store: the channel's own, or, while a thread is created, those of
     * its first message, which are uploaded once the thread exists.
     */
    attachmentsKey: string
    /** The text as the input holds it (`@name` for mentions); settled to the last change event. */
    getText: () => string
    getSelection: () => { start: number; end: number }
    /** The text including anything the input has not reported yet. */
    flushText: () => Promise<string>
    /** Inserts at the selection (or at `range`), moving the cursor after it. */
    insertText: (
        text: string,
        options?: {
            range?: { start: number; end: number }
            /** Adds a space after the text. */
            space?: boolean
        },
    ) => void
    replaceRange: (
        range: { location: number; length: number },
        text: string,
        options?: { keepCursorPosition?: boolean },
    ) => void
    setText: (text: string) => void
    setSelection: (start: number, end?: number) => void
    focus: () => void
    blur: () => void
    /** Replies to a message; null cancels. The reply pings the author unless `mention` is false. */
    setReplyTo: (
        message: Message | null,
        options?: { mention?: boolean },
    ) => void
    setReplyMention: (mention: boolean) => void
    /** Edits one of the user's messages; null cancels and brings the draft back. */
    setEditing: (message: Message | null) => void
    /** Shows the panel registered under `panel` (`expression`) where the keyboard was. */
    openCustomKeyboard: (panel: string) => void
    closeCustomKeyboard: () => void
    /** Brings the system keyboard back for the input; the open panel closes once it is up. */
    openSystemKeyboard: () => void
    /** Panels call this while one of their own text fields has focus, so the keyboard for it keeps the panel. */
    setPanelTyping: (typing: boolean) => void
    toggleMediaRow: () => void
    /** Hands attachments to whoever registered `addAttachments` in the composer slots (the uploader). */
    addAttachments: (attachments: ComposerAttachment[]) => void
    send: () => void
    /** Sends a sticker on its own; resolves false when refused. */
    sendSticker: (stickerId: string) => Promise<boolean>
    /** Sends a GIF's link as its own message, replying if a reply is set; resolves false when refused. */
    sendGif: (url: string) => Promise<boolean>
}

const createLocalStore = (
    canSend: boolean,
    slowmode: number,
    creatingThread: boolean,
    attachedReady: boolean | undefined,
    attachedAllowsEmpty: boolean,
) =>
    createStore<ComposerState>(() => ({
        text: '',
        selection: { start: 0, end: 0 },
        focused: false,
        keyboardOpen: false,
        inputRequested: false,
        panel: null,
        panelTyping: false,
        mediaRowOpen: false,
        typingInset: 0,
        canSend,
        slowmode,
        creatingThread,
        attached: attachedReady !== undefined,
        attachedReady: attachedReady ?? false,
        attachedAllowsEmpty,
    }))

/**
 * Returns the composer's local store, with whether the user can send and the slowmode kept current.
 * With `attachedReady`, the text goes elsewhere: the channel's permission and slowmode don't apply.
 */
function useLocalStore(
    channelId: string,
    creatingThread: boolean,
    attachedReady: boolean | undefined,
    attachedAllowsEmpty: boolean,
) {
    const canSendMessage = useCanSend(channelId)
    const canCreateThread = useCanStartThread(channelId)
    const attached = attachedReady !== undefined
    const canSend =
        attached || (creatingThread ? canCreateThread : canSendMessage)
    const channelSlowmode = useSlowmode(channelId)
    const slowmode = attached ? 0 : channelSlowmode
    const [store] = useState(() =>
        createLocalStore(
            canSend,
            slowmode,
            creatingThread,
            attachedReady,
            attachedAllowsEmpty,
        ),
    )
    // Before paint, so a chat switch never shows the last chat's permission.
    useLayoutEffect(() => {
        store.setState({
            canSend,
            slowmode,
            attachedReady: attachedReady ?? false,
        })
    }, [store, canSend, slowmode, attachedReady])
    return store
}

/**
 * Owns one chat's composer: the native input, the text, drafts, replies, edits and the keyboard panel.
 *
 * With `thread`, it writes the first message of a new thread in `channelId` (a ChatInput with `threadCreationCallback`).
 * Sending creates the thread, then sends the message into it (text, files or a sticker).
 * Its draft and files are kept apart from the channel's (DraftType.FirstThreadMessage).
 * Files upload once the thread exists, and nobody is told the user is typing.
 * The channel's reply and edit are not this composer's.
 *
 * With `attached`, the text goes with a forward or a share, sent by `attached.send`. As for a thread, the draft and
 * files are its own, files wait to be sent, and nobody is told the user is typing.
 */
export function ComposerProvider({
    channelId,
    thread,
    attached,
    children,
}: {
    channelId: string
    thread?: ThreadCreation
    attached?: AttachedMessage
    children: ReactNode
}) {
    const session = useSession()
    const { theme } = useUnistyles()
    // Fixed for the composer's life: a composer either creates threads or does not.
    const [creatingThread] = useState(thread !== undefined)
    const threadRef = useRef(thread)
    threadRef.current = thread
    const attachedRef = useRef(attached)
    attachedRef.current = attached
    // Fixed for the composer's life, as `creatingThread`.
    const [separateDraft] = useState(() =>
        creatingThread
            ? (id: string) => `thread.${id}`
            : attached
              ? () => attached.draftId
              : undefined,
    )
    // Fixed for the composer's life: a forward stays a forward.
    const [allowsEmpty] = useState(attached?.allowsEmpty ?? false)
    const store = useLocalStore(
        channelId,
        creatingThread,
        attached?.ready,
        allowsEmpty,
    )
    const latest = useRef({ session, colors: theme.colors, channelId })
    latest.current = { session, colors: theme.colors, channelId }
    // Lives as long as the composer: it holds the native view.
    const [input] = useState(() =>
        createComposerInput(
            store,
            channelId,
            () => latest.current.channelId,
            (text, id) =>
                JSON.stringify(
                    styleBlocks(
                        text,
                        parseContext(latest.current.session, id),
                        latest.current.colors,
                    ),
                ),
        ),
    )
    // Memoised for identity: the effects that subscribe for the drafts follow it.
    const drafts = useMemo(
        () => createDraftSync(session, store, input, separateDraft),
        [session, store, input, separateDraft],
    )
    useDraftSync(drafts, channelId)
    // A theme change recolours the highlights.
    // biome-ignore lint/correctness/useExhaustiveDependencies: the theme is the trigger
    useEffect(() => input.restyle(), [theme, input])
    useKeyboardTracking(store)
    useDismissal(store, input)
    useBackClosesPanel(
        store,
        useStore(store, state => state.panel !== null),
    )

    const nativeId = `composer${useId()}`
    // Memoised for identity: the context value.
    const api = useMemo(() => {
        const parts = { session, store, input, drafts, channelId }
        const sender = createSender({
            ...parts,
            creatingThread,
            thread: threadRef,
            attached: attachedRef,
        })
        return createComposerApi({
            ...parts,
            sender,
            nativeId,
            deferFiles: separateDraft !== undefined,
        })
    }, [
        session,
        store,
        input,
        drafts,
        channelId,
        nativeId,
        creatingThread,
        separateDraft,
    ])
    // Memoised for identity: the context value.
    const internals = useMemo<Internals>(
        () => ({
            store,
            attachNative: input.attach,
            onSelectionOrTextChange: ({ nativeEvent }) =>
                input.change(nativeEvent, drafts.changed),
            onTextFlushed: ({ nativeEvent }) =>
                input.flushed(nativeEvent.requestId, nativeEvent.text),
        }),
        [store, input, drafts],
    )

    return (
        <InternalContext value={internals}>
            <ApiContext value={api}>{children}</ApiContext>
        </InternalContext>
    )
}
