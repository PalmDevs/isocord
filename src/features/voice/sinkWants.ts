import { createStore } from 'zustand/vanilla'
import { defineStore } from '../../core/session'
import native from '../../native/IsocordVoice'
import { rtcStore } from './rtc'
import { streamsStore } from './streams'
import type { Session } from '../../core/session'
import type { RtcContext, SinkWants } from '../../native/voiceTypes'

/** The best quality: the sender's top layer. */
export const FULL_QUALITY = 100
/** The lowest quality that still asks for the video (0 turns it off). */
const MIN_QUALITY = 1
/** Pixels of a full-quality video: 720p, the top rung of MediaSinkWantsLadder. */
const FULL_QUALITY_PIXELS = 1280 * 720

/** A video the panel shows now. `pixels` is the area it covers on screen. */
export interface ShownVideo {
    context: RtcContext
    userId: string
    quality: number
    pixels: number
}

interface SinkState {
    /** The videos on screen, by `shownKey`. Empty while the panel is collapsed or minimized. */
    shown: Readonly<Record<string, ShownVideo>>
    /** The stream connection is up, so it takes wants. */
    streamConnected: boolean
}

/** What the panel shows: the source of `setSinkWants` (RTCMediaSinkWantsManager's visible participants). */
export const sinkStore = defineStore('sinkWants', () =>
    createStore<SinkState>(() => ({ shown: {}, streamConnected: false })),
)

/** Returns the quality for a tile of `pixels` on screen: its share of a full-quality video. */
export function tileQuality(pixels: number): number {
    const share = Math.round((FULL_QUALITY * pixels) / FULL_QUALITY_PIXELS)
    return Math.min(FULL_QUALITY, Math.max(MIN_QUALITY, share))
}

/**
 * Returns the key of one on-screen video. A tile and the focused view of the same video are two entries, whatever
 * their quality, so one going leaves the other's.
 */
export function shownKey(video: ShownVideo, focused: boolean): string {
    return `${video.context}:${video.userId}:${focused ? 'focus' : 'tile'}`
}

export function setStreamConnected(session: Session, connected: boolean): void {
    session.get(sinkStore).setState({ streamConnected: connected })
}

/** Wants for one context: the shown videos at their quality, everything else off. Keys are sorted to compare. */
function wantsFor(shown: SinkState['shown'], context: RtcContext): SinkWants {
    const users: Record<string, number> = {}
    const pixelCounts: Record<string, number> = {}
    const videos = Object.values(shown)
        .filter(video => video.context === context)
        .sort((a, b) => a.userId.localeCompare(b.userId))
    for (const video of videos) {
        users[video.userId] = Math.max(users[video.userId] ?? 0, video.quality)
        pixelCounts[video.userId] = Math.max(
            pixelCounts[video.userId] ?? 0,
            video.pixels,
        )
    }
    return { any: 0, users, pixelCounts }
}

/** The last wants sent per context. A context that is not connected has none, so it sends again once it connects. */
const sent = new WeakMap<Session, Partial<Record<RtcContext, string>>>()

const CONTEXTS: readonly RtcContext[] = ['default', 'stream']

function isConnected(session: Session, context: RtcContext): boolean {
    if (context === 'default')
        return session.get(rtcStore).getState().connection === 'connected'
    const { streamKey, own } = session.get(streamsStore).getState()
    // Our own stream only sends.
    return (
        streamKey !== null &&
        !own &&
        session.get(sinkStore).getState().streamConnected
    )
}

/** Sends the wants of each connected context when they changed. */
function syncSinkWants(session: Session): void {
    const last = sent.get(session) ?? {}
    sent.set(session, last)
    const { shown } = session.get(sinkStore).getState()
    for (const context of CONTEXTS) {
        if (!isConnected(session, context)) {
            delete last[context]
            continue
        }
        const json = JSON.stringify(wantsFor(shown, context))
        if (last[context] === json) continue
        last[context] = json
        native?.setSinkWants(context, json)
    }
}

/** Keeps native's wants in step with the panel: on a change of the shown videos or a (re)connect. Returns the cleanup. */
export function registerSinkWants(session: Session): () => void {
    const offs = [
        session.get(sinkStore).subscribe(() => syncSinkWants(session)),
        session.get(rtcStore).subscribe(() => syncSinkWants(session)),
        session.get(streamsStore).subscribe(() => syncSinkWants(session)),
    ]
    return () => {
        for (const off of offs) off()
        sent.delete(session)
    }
}
