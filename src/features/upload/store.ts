import { createStore } from 'zustand/vanilla'
import { Endpoint } from '../../core/api/paths'
import { ApiError } from '../../core/api/rest'
import { SPOILER_FILENAME_PREFIX } from '../../core/discord/messages'
import { logger } from '../../core/log'
import { useSessionStore } from '../../core/react'
import { defineStore } from '../../core/session'
import { uploader as wire } from '../../native/NativeIsocordConstants'
import Uploader from '../../native/NativeIsocordUploader'
import { MAX_TOTAL_ATTACHMENT_SIZE, MAX_UPLOAD_COUNT } from './limits'
import type { Feature } from '../../core/feature'
import type { Session } from '../../core/session'

/**
 * `prepared`: ready, waiting for the channel to go to (`addAttachments`' `defer`), which `uploadAll` names.
 */
export type AttachmentState =
    | 'preparing'
    | 'prepared'
    | 'uploading'
    | 'uploaded'
    | 'error'

export type AttachmentError =
    | 'too_large'
    | 'unreadable'
    | 'network'
    | 'rejected'
    | 'unknown'

export interface PendingAttachment {
    /** Ties the item to its native work and to the pending list. */
    id: string
    channelId: string
    /** Shows the picked file: the uri it came from. */
    previewUri: string
    filename: string
    mimeType: string
    /** Bytes; after preparing, the size that is uploaded (compressed when it had to be). */
    size: number
    width: number
    height: number
    /** Voice messages and audio: length in seconds, 0 when unknown. */
    durationSecs: number
    /** Voice messages: base64 waveform. */
    waveform?: string
    spoiler: boolean
    description: string
    state: AttachmentState
    /** 0 to 1 within the current state: compressing, then sending. */
    progress: number
    error?: AttachmentError
    /** Set once the upload url was issued; sent as `uploaded_filename`. */
    uploadedFilename?: string
}

export interface AttachmentInput {
    /** `content://` or `file://`. */
    uri: string
    filename?: string
    mimeType?: string
    /** Bytes, when the picker knows them; used to keep within the message's total size limit. */
    size?: number
    width?: number
    height?: number
    durationSecs?: number
    waveform?: string
    spoiler?: boolean
    description?: string
}

export interface AddOptions {
    /** One file's byte limit (see `maxUploadSize`). Larger images and videos are compressed to fit. */
    maxFileSize: number
    /**
     * Prepare the files but upload them only when `uploadAll` names the channel: the first message of a thread that
     * does not exist yet (the reference uploads it once the thread is created).
     */
    defer?: boolean
}

export interface AddResult {
    added: string[]
    /** Files left out: past the count or total size limit. */
    rejected: Array<{ uri: string; reason: 'too_many' | 'total_too_large' }>
}

export interface MessageAttachment {
    id: string
    filename: string
    uploaded_filename: string
    description?: string
    is_spoiler?: true
    duration_secs?: number
    waveform?: string
}

export class UploadError extends Error {
    constructor(readonly failed: PendingAttachment[]) {
        super('Some attachments did not upload')
    }
}

interface UploadsState {
    channels: Record<string, PendingAttachment[]>
}

/** Each list's pending files, by list key (`ComposerApi.attachmentsKey`). */
export const uploadsStore = defineStore('uploads', () =>
    createStore<UploadsState>(() => ({ channels: {} })),
)

const NO_ATTACHMENTS: PendingAttachment[] = []

export const useAttachments = (channelId: string) =>
    useSessionStore(
        uploadsStore,
        state => state.channels[channelId] ?? NO_ATTACHMENTS,
    )

interface Task {
    done: Promise<void>
    maxFileSize: number
    defer: boolean
    /** The uri the native side uploads from, once prepared. */
    uploadUri?: string
    compressed?: boolean
    removed?: boolean
}

const log = logger('Uploads')

/** A session's running work on its files, by file id. */
const sessionTasks = new WeakMap<Session, Map<string, Task>>()
let nextId = 1

/** Sent to Discord for each file, as lodash's uniqueId does in the official client. */
let nextRequestId = 1

/** Returns the session's tasks. */
function tasksOf(session: Session): Map<string, Task> {
    let tasks = sessionTasks.get(session)
    if (!tasks) {
        tasks = new Map()
        sessionTasks.set(session, tasks)
    }
    return tasks
}

function patch(
    session: Session,
    channelId: string,
    id: string,
    changes: Partial<PendingAttachment>,
) {
    session.get(uploadsStore).setState(state => {
        const list = state.channels[channelId]
        if (!list?.some(item => item.id === id)) return state
        return {
            channels: {
                ...state.channels,
                [channelId]: list.map(item =>
                    item.id === id ? { ...item, ...changes } : item,
                ),
            },
        }
    })
}

function find(session: Session, channelId: string, id: string) {
    return session
        .get(uploadsStore)
        .getState()
        .channels[channelId]?.find(item => item.id === id)
}

/** Follows the native upload progress of the session's files until it ends. Ids of other sessions' files are not found. */
function listenForProgress(session: Session): () => void {
    const subscription = Uploader.onProgress(event => {
        const channelId = event.id.split(wire.idSeparator)[0]
        if (!channelId) return
        const item = find(session, channelId, event.id)
        if (!item) return
        // Each phase counts on its own scale; a late event of the finished one must not move the bar back.
        const phase =
            item.state === 'preparing'
                ? wire.phaseCompress
                : item.state === 'uploading'
                  ? wire.phaseUpload
                  : undefined
        if (event.phase !== phase) return
        patch(session, channelId, event.id, {
            progress: event.total > 0 ? event.done / event.total : 0,
        })
    })
    return () => subscription.remove()
}

/** Progress listening for each session. */
export const uploadsFeature: Feature = {
    name: 'uploads',
    setup: listenForProgress,
}

const sleep = (ms: number) =>
    new Promise<void>(resolve => setTimeout(() => resolve(), ms))

/**
 * Asks for a signed upload url, retrying server and network errors with a growing wait, as the
 * official client's createAttachmentUrlRetryOpts does (it tries 8 times).
 */
async function requestUploadUrl(
    session: Session,
    channelId: string,
    item: PendingAttachment,
) {
    let wait = 500
    for (let attempt = 0; ; attempt++) {
        try {
            const response = await session.rest.post<{
                attachments: Array<{
                    id: number | string
                    upload_url: string
                    upload_filename: string
                }>
            }>(Endpoint.channelAttachments(channelId), {
                body: {
                    files: [
                        {
                            id: String(nextRequestId++),
                            filename: item.filename,
                            file_size: item.size,
                        },
                    ],
                },
            })
            const first = response.attachments[0]
            if (!first) throw new Error('No upload url')
            return first
        } catch (error) {
            const retryable =
                !(error instanceof ApiError) || error.status >= 500
            if (!retryable || attempt >= 7) throw error
            await sleep(wait)
            wait = Math.min(wait * 2, 30_000)
        }
    }
}

function errorKind(error: unknown): AttachmentError {
    if (error instanceof ApiError)
        return error.status === 413 ? 'too_large' : 'rejected'
    const code = (error as { code?: string } | null)?.code
    if (code?.startsWith(wire.errorHttpPrefix)) return 'rejected'
    if (code === wire.errorFailed) return 'network'
    return error instanceof TypeError ? 'network' : 'unknown'
}

/** An error's code (a status, or the native module's code), never its message. */
function errorCode(error: unknown): string {
    if (error instanceof ApiError) return `HTTP ${error.status}`
    return (error as { code?: string } | null)?.code ?? 'no code'
}

function fail(session: Session, channelId: string, id: string, error: unknown) {
    const kind = errorKind(error)
    // Not the message: native errors can contain the file's URI or path.
    log.warn(`Attachment failed (${kind}, ${errorCode(error)})`)
    patch(session, channelId, id, { state: 'error', error: kind })
}

async function run(
    session: Session,
    channelId: string,
    id: string,
    task: Task,
) {
    const item = find(session, channelId, id)
    if (!item) return
    try {
        patch(session, channelId, id, {
            state: 'preparing',
            progress: 0,
            error: undefined,
        })
        let prepared: Awaited<ReturnType<typeof Uploader.prepare>>
        try {
            prepared = await Uploader.prepare(id, item.previewUri, {
                maxBytes: task.maxFileSize,
                filename: item.filename,
            })
        } catch (error) {
            if ((error as { code?: string }).code === wire.errorCancelled)
                return
            log.warn(`Preparing an attachment failed (${errorCode(error)})`)
            patch(session, channelId, id, {
                state: 'error',
                error: 'unreadable',
            })
            return
        }
        task.uploadUri = prepared.uri
        task.compressed = prepared.compressed
        if (task.removed) {
            if (prepared.compressed) Uploader.deleteFile(prepared.uri)
            return
        }
        if (prepared.size > task.maxFileSize) {
            patch(session, channelId, id, {
                state: 'error',
                error: 'too_large',
            })
            return
        }
        patch(session, channelId, id, {
            filename: prepared.filename,
            mimeType: prepared.mimeType,
            size: prepared.size,
            width: prepared.width || item.width,
            height: prepared.height || item.height,
            durationSecs: item.durationSecs || prepared.durationSecs,
            state: task.defer ? 'prepared' : 'uploading',
            progress: 0,
        })
    } catch (error) {
        if (task.removed) return
        if ((error as { code?: string }).code === wire.errorCancelled) return
        fail(session, channelId, id, error)
        return
    }
    if (!task.defer) await upload(session, channelId, id, task, channelId)
}

/** Sends a prepared file to Discord's storage, with an upload url issued for `target`. */
async function upload(
    session: Session,
    channelId: string,
    id: string,
    task: Task,
    targetChannelId: string,
) {
    const item = find(session, channelId, id)
    const uri = task.uploadUri
    if (!item || !uri) return
    try {
        patch(session, channelId, id, { state: 'uploading', progress: 0 })
        const target = await requestUploadUrl(session, targetChannelId, item)
        if (task.removed) {
            session.rest
                .delete(Endpoint.attachment(target.upload_filename))
                .catch(() => {})
            return
        }
        patch(session, channelId, id, {
            uploadedFilename: target.upload_filename,
        })
        await Uploader.upload(
            id,
            uri,
            target.upload_url,
            item.mimeType,
            item.size,
        )
        log.info(`Uploaded an attachment of ${item.size} bytes`)
        patch(session, channelId, id, { state: 'uploaded', progress: 1 })
    } catch (error) {
        if (task.removed) return
        if ((error as { code?: string }).code === wire.errorCancelled) return
        fail(session, channelId, id, error)
    }
}

function start(
    session: Session,
    item: PendingAttachment,
    maxFileSize: number,
    defer: boolean,
) {
    const task: Task = { done: Promise.resolve(), maxFileSize, defer }
    tasksOf(session).set(item.id, task)
    task.done = run(session, item.channelId, item.id, task)
}

/**
 * Adds picked files to a channel's pending list and starts preparing and uploading them right away,
 * as the official client does. At most 10 files and 500 MiB in total fit in one message.
 */
export function addAttachments(
    session: Session,
    channelId: string,
    inputs: AttachmentInput[],
    options: AddOptions,
): AddResult {
    const store = session.get(uploadsStore)
    const result: AddResult = { added: [], rejected: [] }
    const created: PendingAttachment[] = []
    const existing = store.getState().channels[channelId] ?? []
    let count = existing.length
    let total = existing.reduce((sum, item) => sum + item.size, 0)

    for (const input of inputs) {
        const size = input.size ?? 0
        if (count >= MAX_UPLOAD_COUNT) {
            result.rejected.push({ uri: input.uri, reason: 'too_many' })
            continue
        }
        if (total + size > MAX_TOTAL_ATTACHMENT_SIZE) {
            result.rejected.push({ uri: input.uri, reason: 'total_too_large' })
            continue
        }
        const name = input.filename ?? input.uri.split('/').pop() ?? 'file'
        const spoiler =
            input.spoiler ?? name.startsWith(SPOILER_FILENAME_PREFIX)
        const id = `${channelId}${wire.idSeparator}${nextId++}`
        created.push({
            id,
            channelId,
            previewUri: input.uri,
            filename: name.startsWith(SPOILER_FILENAME_PREFIX)
                ? name.slice(SPOILER_FILENAME_PREFIX.length)
                : name,
            mimeType: input.mimeType ?? 'application/octet-stream',
            size,
            width: input.width ?? 0,
            height: input.height ?? 0,
            durationSecs: input.durationSecs ?? 0,
            waveform: input.waveform,
            spoiler,
            description: input.description ?? '',
            state: 'preparing',
            progress: 0,
        })
        result.added.push(id)
        count++
        total += size
    }
    if (created.length === 0) return result

    store.setState(state => ({
        channels: {
            ...state.channels,
            [channelId]: [...existing, ...created],
        },
    }))
    for (const item of created)
        start(session, item, options.maxFileSize, options.defer ?? false)
    return result
}

/** Drops the file; stops it if running, and tells Discord to forget an upload already made. */
export function removeAttachment(
    session: Session,
    channelId: string,
    id: string,
) {
    const item = find(session, channelId, id)
    const tasks = tasksOf(session)
    const task = tasks.get(id)
    session.get(uploadsStore).setState(state => ({
        channels: {
            ...state.channels,
            [channelId]: (state.channels[channelId] ?? []).filter(
                other => other.id !== id,
            ),
        },
    }))
    if (task) {
        task.removed = true
        Uploader.cancel(id)
        if (task.compressed && task.uploadUri)
            Uploader.deleteFile(task.uploadUri)
        tasks.delete(id)
        if (item?.uploadedFilename)
            session.rest
                .delete(Endpoint.attachment(item.uploadedFilename))
                .catch(() => {})
    }
}

export function setSpoiler(
    session: Session,
    channelId: string,
    id: string,
    spoiler: boolean,
) {
    patch(session, channelId, id, { spoiler })
}

export function setDescription(
    session: Session,
    channelId: string,
    id: string,
    description: string,
) {
    patch(session, channelId, id, { description })
}

/** Starts a failed file again from the beginning. */
export function retryAttachment(
    session: Session,
    channelId: string,
    id: string,
) {
    const item = find(session, channelId, id)
    const task = tasksOf(session).get(id)
    if (item?.state !== 'error' || !task) return
    if (task.compressed && task.uploadUri) Uploader.deleteFile(task.uploadUri)
    start(session, item, task.maxFileSize, task.defer)
}

/**
 * Waits for every pending file of the list and returns the `attachments` array of the message
 * body, matching UploadUtils.getAttachmentPayload: the id is the file's index in the array. Rejects
 * with `UploadError` when a file failed. Call `clearAttachments` once the message is sent.
 * Deferred files are uploaded now, for `targetChannelId`: the channel the message goes to.
 */
export async function uploadAll(
    session: Session,
    channelId: string,
    targetChannelId = channelId,
): Promise<MessageAttachment[]> {
    const store = session.get(uploadsStore)
    const tasks = tasksOf(session)
    const items = store.getState().channels[channelId] ?? []
    await Promise.all(items.map(item => tasks.get(item.id)?.done))
    const held = store.getState().channels[channelId] ?? []
    await Promise.all(
        held.map(item => {
            const task = tasks.get(item.id)
            if (item.state !== 'prepared' || !task) return task?.done
            task.done = upload(
                session,
                channelId,
                item.id,
                task,
                targetChannelId,
            )
            return task.done
        }),
    )
    const settled = store.getState().channels[channelId] ?? []
    const failed = settled.filter(item => item.state !== 'uploaded')
    if (failed.length > 0) throw new UploadError(failed)
    return settled.map((item, index) => {
        const attachment: MessageAttachment = {
            id: String(index),
            filename:
                (item.spoiler ? SPOILER_FILENAME_PREFIX : '') + item.filename,
            uploaded_filename: item.uploadedFilename ?? '',
        }
        if (item.description) attachment.description = item.description
        if (item.spoiler) attachment.is_spoiler = true
        if (item.waveform) {
            attachment.duration_secs = item.durationSecs
            attachment.waveform = item.waveform
        }
        return attachment
    })
}

/** Forgets the channel's files after they were sent, removing compressed copies. Not the uploads. */
export function clearAttachments(session: Session, channelId: string) {
    const store = session.get(uploadsStore)
    const tasks = tasksOf(session)
    for (const item of store.getState().channels[channelId] ?? []) {
        const task = tasks.get(item.id)
        if (task?.compressed && task.uploadUri)
            Uploader.deleteFile(task.uploadUri)
        tasks.delete(item.id)
    }
    store.setState(state => {
        const { [channelId]: _gone, ...rest } = state.channels
        return { channels: rest }
    })
}
