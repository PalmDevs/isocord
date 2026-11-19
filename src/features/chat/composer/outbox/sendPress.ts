import { uploadsStore } from '../../../upload'
import { serializeMessage } from '../parsing/parse'
import { parseContext } from '../parsing/parseContext'
import { composerStore, endEdit, setReply } from '../state/composerStore'
import { loadDraft, saveDraft } from './drafts'
import { fitsLength, saveEdit, send, sendSticker } from './outbox'
import type { RefObject } from 'react'
import type { Session } from '../../../../core/session'
import type { Message } from '../../../../stores/readStates'
import type { DraftSync } from '../input/draftSync'
import type { ComposerInput } from '../input/nativeInput'
import type {
    AttachedMessage,
    LocalStore,
    ThreadCreation,
} from '../state/ComposerContext'

interface Sender {
    session: Session
    store: LocalStore
    input: ComposerInput
    drafts: DraftSync
    channelId: string
    creatingThread: boolean
    /** Read at the press: the composer's thread to create. */
    thread: RefObject<ThreadCreation | undefined>
    /** Read at the press: the forward or share the text goes with. */
    attached: RefObject<AttachedMessage | undefined>
}

/** Sends the forward or share with the text, then clears the text once it went. */
async function sendAttached(sender: Sender, content: string, silent: boolean) {
    const { session, input, drafts, channelId, attached } = sender
    const target = attached.current
    if (!target?.ready) return
    const files =
        session.get(uploadsStore).getState().channels[drafts.draftId(channelId)]
            ?.length ?? 0
    if (!target.allowsEmpty && content.length === 0 && files === 0) return
    if (!(await target.send(content, silent))) return
    if (input.channelId === channelId) drafts.clear(channelId)
}

/** Channels a thread is being created in, by session, so a second tap does not create two. */
const creatingThreads = new WeakMap<Session, Set<string>>()

/** Creates the thread, one at a time, has `sendFirst` send its first message, then hands the thread over. */
async function startThread(
    { session, channelId, thread }: Sender,
    sendFirst: (threadId: string) => Promise<unknown>,
): Promise<boolean> {
    const creation = thread.current
    let busy = creatingThreads.get(session)
    if (!busy) {
        busy = new Set()
        creatingThreads.set(session, busy)
    }
    if (!creation || busy.has(channelId)) return false
    busy.add(channelId)
    try {
        const threadId = await creation.create()
        if (!threadId) return false
        await sendFirst(threadId)
        creation.onCreated(threadId)
        return true
    } finally {
        busy.delete(channelId)
    }
}

/** chatInputCreateThread: the thread is created with or without a first message, which takes the files. */
async function createThread(sender: Sender, content: string, silent: boolean) {
    const { session, input, drafts, channelId } = sender
    const created = await startThread(sender, threadId =>
        send(session, threadId, {
            content,
            silent,
            files: drafts.draftId(channelId),
            // The thread exists by now: its first message goes without the files.
            dropFailedFiles: true,
        }),
    )
    if (created && input.channelId === channelId) drafts.clear(channelId)
}

/** handleSaveEditing: the edit ends once saved, unless it was cancelled or replaced meanwhile. */
async function finishEdit(sender: Sender, message: Message, content: string) {
    const { session, drafts, channelId } = sender
    if (!(await saveEdit(session, channelId, message, content))) return
    // The composers showing the chat bring its draft back; one that has moved to another chat shows it when it returns.
    if (drafts.editing(channelId) !== message) return
    endEdit(session.get(composerStore), channelId)
}

/** Sends the text with the channel's reply and files, then clears the draft that was sent. */
async function sendText(
    sender: Sender,
    text: string,
    content: string,
    silent: boolean,
    hasFiles: boolean,
) {
    const { session, store, input, drafts, channelId } = sender
    const reply = session.get(composerStore).getState().replies[channelId]
    if (
        !(await send(session, channelId, {
            content,
            silent,
            reply,
            files: channelId,
        }))
    )
        return
    setReply(session, channelId, null)
    // Without files nothing was awaited since the text was read, so the input still holds it.
    if (!hasFiles) return drafts.clear(channelId)
    // After an upload, text typed while the files went up is a new draft and stays; only the text that was sent is
    // cleared. The input may show another chat by now: then its text and pending save are left alone.
    const now = input.channelId === channelId ? await input.flushText() : null
    if (now === null || input.channelId !== channelId) {
        if (loadDraft(session, channelId) === text)
            saveDraft(session, channelId, '', store)
        return
    }
    if (now === text) drafts.clear(channelId)
}

/**
 * Returns the composer's send button, sticker and GIF sends. useChatInputRefs.handleSend then handleSaveEditing: whether
 * the press saves an edit is decided at the press.
 */
export function createSender(sender: Sender) {
    const { session, input, drafts, channelId, creatingThread } = sender
    return {
        send: async () => {
            // Read before the flush: the text comes back asynchronously, and an edit that ends meanwhile (a second
            // tap after the first one saved it) must not turn the flushed edit text into a new message.
            const editing = drafts.editing(channelId)
            const text = await input.flushText()
            // The input moved to another chat while the text was on its way: the text is not this chat's.
            if (input.channelId !== channelId) return
            // The edit was saved, cancelled or replaced while the text was on its way: this press is stale.
            if (drafts.editing(channelId) !== editing) return
            const { content, silent } = serializeMessage(
                text,
                parseContext(session, channelId),
            )
            if (!fitsLength(session, content)) return
            if (creatingThread) return createThread(sender, content, silent)
            if (sender.attached.current)
                return sendAttached(sender, content, silent)
            const hasFiles =
                (session.get(uploadsStore).getState().channels[channelId]
                    ?.length ?? 0) > 0
            if (content.length === 0 && !hasFiles) return
            if (editing) return finishEdit(sender, editing, content)
            return sendText(sender, text, content, silent, hasFiles)
        },

        // A sticker picked while creating a thread is its first message (ThreadCreationHooks' sendMessage).
        sendSticker: async (stickerId: string) => {
            // A forward's or a share's composer has no channel of its own to send in (ForwardMessageFooter has no stickers).
            if (sender.attached.current) return false
            if (!creatingThread)
                return sendSticker(session, channelId, stickerId)
            let sent = false
            const created = await startThread(sender, async threadId => {
                sent = await sendSticker(session, threadId, stickerId)
            })
            // Not created: the screen says why.
            return !created || sent
        },

        // handleSelectGIF: the link goes on its own with the channel's reply, or as a new thread's first message.
        sendGif: async (url: string) => {
            if (sender.attached.current) return false
            if (creatingThread) {
                let sent = false
                const created = await startThread(sender, async threadId => {
                    sent = await send(session, threadId, {
                        content: url,
                        silent: false,
                    })
                })
                return !created || sent
            }
            const reply = session.get(composerStore).getState().replies[
                channelId
            ]
            if (
                !(await send(session, channelId, {
                    content: url,
                    silent: false,
                    reply,
                }))
            )
                return false
            setReply(session, channelId, null)
            return true
        },
    }
}
