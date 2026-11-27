import { createStore } from 'zustand/vanilla'
import { Endpoint } from '../../../../core/api/paths'
import {
    AttachmentFlag,
    MessageFlag,
    MessageType,
    maxMessageLength,
    SPOILER_FILENAME_PREFIX,
} from '../../../../core/discord/messages'
import { snowflakeFromTimestamp } from '../../../../core/discord/snowflake'
import { useSessionStore } from '../../../../core/react'
import { defineStore } from '../../../../core/session'
import { t } from '../../../../i18n'
import NativeIsocordExpressionFlight from '../../../../native/NativeIsocordExpressionFlight'
import { channelsStore } from '../../../../stores/channels/channels'
import {
    addPendingMessage,
    confirmPendingMessage,
    messagesStore,
    removePendingMessage,
    setPendingState,
} from '../../../../stores/messages/messages'
import { jumpToPresent } from '../../../../stores/messages/messageWindows'
import { usersStore } from '../../../../stores/users'
import { clearAttachments, uploadAll, uploadsStore } from '../../../upload'
import { toast } from '../toast'
import type { Session } from '../../../../core/session'
import type {
    Attachment,
    Embed,
    StickerItem,
} from '../../../../stores/messages/messageTypes'
import type { Message } from '../../../../stores/readStates'
import type { MessageAttachment, PendingAttachment } from '../../../upload'

/** What a reply points at. */
export interface ReplyTarget {
    messageId: string
    authorId: string
    /** Whether the reply pings the author. The reference's toggle starts on. */
    shouldMention: boolean
}

/** A message for `send`. */
interface Outgoing {
    content: string
    /** `@silent`: no push notifications or unread badge for the recipients. */
    silent: boolean
    reply?: ReplyTarget
    /** The upload list whose files go with the message. They upload for the channel the message goes to. */
    files?: string
    /** Sends without the files when they fail to upload, instead of not sending. The list is cleared either way. */
    dropFailedFiles?: boolean
    /** Local-only embeds rendered while pending (not posted to Discord). */
    previewEmbeds?: Embed[]
    /** Staged picker flight id bound to the pending message's nonce. */
    flightId?: string
}

interface SendBody {
    content: string
    nonce: string
    tts: boolean
    flags?: number
    attachments?: MessageAttachment[]
    message_reference?: {
        message_id: string
        channel_id: string
        guild_id?: string
    }
    allowed_mentions?: { parse: string[]; replied_user: boolean }
}

/** A session's sends in flight. */
interface Work {
    /** Bodies of pending or failed messages, by nonce, so a retry sends exactly the same thing. */
    bodies: Map<string, SendBody>
    /** Upload lists being waited for, so a second tap does not send twice. */
    uploading: Set<string>
    /** Messages whose edit is on its way, so a second tap does not save it twice. */
    savingEdits: Set<string>
}

const sessionWork = new WeakMap<Session, Work>()

function work(session: Session): Work {
    let state = sessionWork.get(session)
    if (!state) {
        state = {
            bodies: new Map(),
            uploading: new Set(),
            savingEdits: new Set(),
        }
        sessionWork.set(session, state)
    }
    return state
}

/** When this launch last sent in each channel, which is all that is known of slowmode cooldowns. */
const outboxStore = defineStore('outbox', () =>
    createStore<{ lastSent: Record<string, number> }>(() => ({ lastSent: {} })),
)

/** Returns when this launch last sent in the channel, or undefined. */
export function useLastSent(channelId: string): number | undefined {
    return useSessionStore(outboxStore, state => state.lastSent[channelId])
}

function noteSent(session: Session, channelId: string) {
    session.get(outboxStore).setState(state => ({
        lastSent: { ...state.lastSent, [channelId]: Date.now() },
    }))
}

let sequence = 0

/** A snowflake from the current time, unique per message (the low bits count up within a millisecond). */
export function createNonce(): string {
    sequence = (sequence + 1) % 4096
    return (
        BigInt(snowflakeFromTimestamp(Date.now())) + BigInt(sequence)
    ).toString()
}

/** Returns whether the content fits the user's length limit. Toasts when not. */
export function fitsLength(session: Session, content: string): boolean {
    const premium = session.get(usersStore).getState().users[
        session.userId
    ]?.premium_type
    const max = maxMessageLength(premium)
    if (content.length <= max) return true
    toast(t('composer.tooLong', { length: content.length, max }))
    return false
}

/** Uploads the list's files for the channel. Returns undefined when there are none or they failed (toasted). */
async function uploadFiles(
    session: Session,
    channelId: string,
    key: string,
): Promise<
    { payload: MessageAttachment[]; items: PendingAttachment[] } | undefined
> {
    const { uploading } = work(session)
    try {
        uploading.add(key)
        const payload = await uploadAll(session, key, channelId)
        const items = session.get(uploadsStore).getState().channels[key] ?? []
        return { payload, items }
    } catch {
        // Unless dropped, the failed files stay in the strip with a retry button.
        toast(t('composer.uploadFailed'))
        return undefined
    } finally {
        uploading.delete(key)
    }
}

/**
 * Sends a message. Its files upload first. It then shows at once as pending, and becomes the real message when the
 * server answers (or the gateway echoes it). On failure it stays as a failed message to retry or delete. Resolves
 * false when nothing was sent: no content or files, files still uploading from an earlier tap, or an upload failed.
 */
export async function send(
    session: Session,
    channelId: string,
    outgoing: Outgoing,
): Promise<boolean> {
    const { files } = outgoing
    const hasFiles =
        files !== undefined &&
        (session.get(uploadsStore).getState().channels[files]?.length ?? 0) > 0
    let attachments: Awaited<ReturnType<typeof uploadFiles>>
    if (files && hasFiles) {
        if (work(session).uploading.has(files)) return false
        attachments = await uploadFiles(session, channelId, files)
        if (attachments || outgoing.dropFailedFiles)
            clearAttachments(session, files)
        if (!attachments && !outgoing.dropFailedFiles) return false
    }
    if (outgoing.content.length === 0 && !attachments) return false
    const nonce = createNonce()
    const body = sendBody(session, channelId, nonce, outgoing)
    if (attachments) body.attachments = attachments.payload
    work(session).bodies.set(nonce, body)
    addPendingMessage(
        session,
        pendingMessage(
            session,
            channelId,
            body,
            attachments?.items ?? [],
            outgoing.previewEmbeds,
        ),
    )
    if (outgoing.flightId)
        NativeIsocordExpressionFlight?.bind(outgoing.flightId, nonce)
    // Sent from a jumped-to window: back to the present, where the message belongs (the pending one is kept).
    void jumpToPresent(session, channelId)
    void post(session, channelId, nonce)
    return true
}

function sendBody(
    session: Session,
    channelId: string,
    nonce: string,
    { content, silent, reply }: Outgoing,
): SendBody {
    const body: SendBody = { content, nonce, tts: false }
    if (silent) body.flags = MessageFlag.SUPPRESS_NOTIFICATIONS
    if (!reply) return body
    body.message_reference = {
        message_id: reply.messageId,
        channel_id: channelId,
        guild_id: session.get(channelsStore).getState().channels[channelId]
            ?.guild_id,
    }
    // Replying without a ping still lets the message mention whoever it writes out.
    if (!reply.shouldMention)
        body.allowed_mentions = {
            parse: ['users', 'roles', 'everyone'],
            replied_user: false,
        }
    return body
}

/** The message shown while the server has not answered. Its id is the nonce. */
function pendingMessage(
    session: Session,
    channelId: string,
    body: SendBody,
    files: PendingAttachment[],
    previewEmbeds?: Embed[],
    stickers?: StickerItem[],
): Message {
    const author = session.get(usersStore).getState().users[session.userId]
    const reference = body.message_reference
    const referenced = reference
        ? session
              .get(messagesStore)
              .getState()
              .channels[channelId]?.messages.find(
                  message => message.id === reference.message_id,
              )
        : undefined
    return {
        id: body.nonce,
        channel_id: channelId,
        guild_id: session.get(channelsStore).getState().channels[channelId]
            ?.guild_id,
        author: author ?? { id: session.userId, username: '', avatar: null },
        content: body.content,
        timestamp: new Date().toISOString(),
        type: reference ? MessageType.REPLY : MessageType.DEFAULT,
        nonce: body.nonce,
        flags: body.flags,
        message_reference: reference,
        referenced_message: referenced,
        // The server's echo lists the replied-to author when the reply pings them; the reply preview's "@" reads it.
        mentions:
            // Not for a reply to yourself, which would highlight it as a mention until the echo.
            referenced &&
            referenced.author.id !== session.userId &&
            body.allowed_mentions?.replied_user !== false
                ? [referenced.author]
                : [],
        attachments: files.map(toPreview),
        embeds: previewEmbeds ?? [],
        ...(stickers?.length ? { sticker_items: stickers } : {}),
        reactions: [],
    }
}

/** What the pending message shows for a file while the server has not answered: the local file. */
function toPreview(item: PendingAttachment, index: number): Attachment {
    return {
        id: String(index),
        filename: (item.spoiler ? SPOILER_FILENAME_PREFIX : '') + item.filename,
        size: item.size,
        url: item.previewUri,
        proxy_url: item.previewUri,
        width: item.width || null,
        height: item.height || null,
        content_type: item.mimeType,
        description: item.description || undefined,
        flags: item.spoiler ? AttachmentFlag.IS_SPOILER : undefined,
    }
}

async function post(
    session: Session,
    channelId: string,
    nonce: string,
): Promise<void> {
    const { bodies } = work(session)
    const body = bodies.get(nonce)
    if (!body) return
    try {
        const message = await session.rest.post<Message>(
            Endpoint.channelMessages(channelId),
            { body },
        )
        bodies.delete(nonce)
        noteSent(session, channelId)
        confirmPendingMessage(session, channelId, message)
    } catch {
        // The body is kept for the retry.
        setPendingState(session, channelId, nonce, 'failed')
    }
}

/** Sends a failed message again. */
export function retryMessage(
    session: Session,
    channelId: string,
    nonce: string,
): void {
    if (!work(session).bodies.has(nonce)) return
    setPendingState(session, channelId, nonce, 'sending')
    void post(session, channelId, nonce)
}

/** Drops a failed message. */
export function discardMessage(
    session: Session,
    channelId: string,
    nonce: string,
): void {
    work(session).bodies.delete(nonce)
    removePendingMessage(session, channelId, nonce)
}

/**
 * Saves an edit. The new content arrives with MESSAGE_UPDATE. Resolves false while the edit is already saving, or
 * when the server refused it (toasted). Unchanged content saves nothing and resolves true.
 */
export async function saveEdit(
    session: Session,
    channelId: string,
    message: Message,
    content: string,
): Promise<boolean> {
    const { savingEdits } = work(session)
    if (savingEdits.has(message.id)) return false
    if (content === message.content) return true
    savingEdits.add(message.id)
    try {
        await session.rest.patch(
            Endpoint.channelMessage(channelId, message.id),
            { body: { content } },
        )
        return true
    } catch {
        toast(t('composer.editFailed'))
        return false
    } finally {
        savingEdits.delete(message.id)
    }
}

/** Sends a sticker as its own message, showing it as pending until the server confirms it. Resolves false when refused. */
export async function sendSticker(
    session: Session,
    channelId: string,
    sticker: StickerItem,
    flightId?: string,
): Promise<boolean> {
    const nonce = createNonce()
    const body: SendBody = {
        content: '',
        nonce,
        tts: false,
    }
    addPendingMessage(
        session,
        pendingMessage(session, channelId, body, [], undefined, [sticker]),
    )
    if (flightId) NativeIsocordExpressionFlight?.bind(flightId, nonce)
    void jumpToPresent(session, channelId)
    try {
        const message = await session.rest.post<Message>(
            Endpoint.channelMessages(channelId),
            {
                body: {
                    ...body,
                    sticker_ids: [sticker.id],
                },
            },
        )
        noteSent(session, channelId)
        confirmPendingMessage(session, channelId, message)
        return true
    } catch {
        removePendingMessage(session, channelId, nonce)
        return false
    }
}
