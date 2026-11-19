import { create } from 'zustand'
import { deviceStorage } from '../../core/storage'
import {
    clearSpans as clearTraceSpans,
    getSpans,
    isRecording,
    setRecording as setTraceRecording,
    takeNativeSnapshot,
} from '../../core/trace'
import type { Span } from '../../core/trace'

const OVERLAY_KEY = 'perf.overlay'

declare const HermesInternal:
    | { getInstrumentedStats?: () => { js_heapSize?: number } }
    | undefined

interface PerfState {
    recording: boolean
    overlay: boolean
    /** The last second of native stats; zero while not recording. */
    uiFps: number
    jank: number
    worstMs: number
    jsHeapMb: number
    javaHeapMb: number
    nativeHeapMb: number
    /** The recorded spans as of the last poll. */
    spans: Span[]
}

const NO_STATS = {
    uiFps: 0,
    jank: 0,
    worstMs: 0,
    jsHeapMb: 0,
    javaHeapMb: 0,
    nativeHeapMb: 0,
}

/** The perf monitor's switches (device-wide) and its latest numbers. */
export const usePerfStore = create<PerfState>(() => ({
    recording: isRecording(),
    overlay: isRecording() && (deviceStorage.getBoolean(OVERLAY_KEY) ?? false),
    ...NO_STATS,
    spans: getSpans(),
}))

let poller: ReturnType<typeof setInterval> | undefined
let lastPoll = 0

function poll() {
    const now = performance.now()
    const elapsed = (now - lastPoll) / 1000
    lastPoll = now
    const snapshot = takeNativeSnapshot()
    const jsHeap =
        typeof HermesInternal !== 'undefined'
            ? HermesInternal.getInstrumentedStats?.().js_heapSize
            : undefined
    usePerfStore.setState({
        uiFps: snapshot ? Math.round(snapshot.frames / elapsed) : 0,
        jank: snapshot?.jank ?? 0,
        worstMs: snapshot?.worstMs ?? 0,
        jsHeapMb: (jsHeap ?? 0) / 1_048_576,
        javaHeapMb: snapshot?.javaHeapMb ?? 0,
        nativeHeapMb: snapshot?.nativeHeapMb ?? 0,
        spans: getSpans(),
    })
}

function startPolling() {
    if (poller) return
    lastPoll = performance.now()
    poller = setInterval(poll, 1000)
}

function stopPolling() {
    clearInterval(poller)
    poller = undefined
}

export function setRecording(recording: boolean): void {
    setTraceRecording(recording)
    if (recording) startPolling()
    else stopPolling()
    // The overlay shows the recorded numbers, so it goes with recording.
    if (!recording) deviceStorage.set(OVERLAY_KEY, false)
    usePerfStore.setState(({ overlay }) => ({
        recording,
        overlay: recording && overlay,
        ...NO_STATS,
    }))
}

export function setOverlay(overlay: boolean): void {
    if (overlay && !isRecording()) setRecording(true)
    deviceStorage.set(OVERLAY_KEY, overlay)
    usePerfStore.setState({ overlay })
}

export function clearSpans(): void {
    clearTraceSpans()
    usePerfStore.setState({ spans: [] })
}

if (isRecording()) startPolling()
