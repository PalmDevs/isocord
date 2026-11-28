import { Endpoint } from '../../../core/api/paths'
import { BASE64_JPEG_PREFIX } from '../../../core/discord/streams'
import { logger } from '../../../core/log'
import native from '../../../native/IsocordVoice'
import { voiceSettingsStore } from '../settings/voiceSettings'
import { streamsStore } from '../streams'
import type { Session } from '../../../core/session'

const log = logger('Voice')

// VoiceEngineStreamingManager: the first preview 15 s after going live, then every 300 s
// (`setBroadcastThumbnailCallback`). A failed post tries again after 60 s.
const FIRST_PREVIEW_MS = 15_000
const PREVIEW_INTERVAL_MS = 300_000
const RETRY_MS = 60_000

const timers = new WeakMap<Session, ReturnType<typeof setTimeout>>()

function schedule(session: Session, streamKey: string, delay: number): void {
    clearTimeout(timers.get(session))
    timers.set(
        session,
        setTimeout(() => void upload(session, streamKey), delay),
    )
}

/** VoiceEngineStreamingManager `handleThumbnailUpload`. Skipped while Hide Stream Previews is on. */
async function upload(session: Session, streamKey: string): Promise<void> {
    const { streamKey: current, own } = session.get(streamsStore).getState()
    if (!native || current !== streamKey || !own) return
    if (voiceSettingsStore.getState().disableStreamPreviews) {
        schedule(session, streamKey, PREVIEW_INTERVAL_MS)
        return
    }
    try {
        const jpeg = await native.captureStreamPreview()
        if (!jpeg) throw new Error('No preview frame yet')
        await session.rest.post(Endpoint.streamPreview(streamKey), {
            body: { thumbnail: BASE64_JPEG_PREFIX + jpeg },
        })
        schedule(session, streamKey, PREVIEW_INTERVAL_MS)
    } catch (error) {
        log.warn(`Failed to post stream preview: ${String(error)}`)
        schedule(session, streamKey, RETRY_MS)
    }
}

/** Starts posting our stream's previews, once its connection is up. */
export function startPreviewUploads(session: Session, streamKey: string): void {
    schedule(session, streamKey, FIRST_PREVIEW_MS)
}

/** Stops posting previews: our stream ended. */
export function stopPreviewUploads(session: Session): void {
    clearTimeout(timers.get(session))
    timers.delete(session)
}
