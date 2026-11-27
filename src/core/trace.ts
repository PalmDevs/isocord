import native from '../native/IsocordTrace'
import { deviceStorage } from './storage'

/** A timed section: start and duration in ms on `performance.now()`'s clock. */
export interface Span {
    name: string
    start: number
    duration: number
    /** `js`, or the native thread it ran on. */
    thread: string
}

export interface NativeSnapshot {
    frames: number
    jank: number
    worstMs: number
    javaHeapMb: number
    nativeHeapMb: number
}

const MAX_SPANS = 2000
const RECORDING_KEY = 'perf.recording'

/** Ring buffer of recorded spans; `next` is where the following one goes. */
const spans: Span[] = []
let next = 0
/** Open sections' starts. Kept even when not recording, so toggling mid-section can't unbalance it. */
const open: { name: string; start: number }[] = []
let recording = false
/** Native ms minus `performance.now()`, taken when recording starts. */
let nativeOffset = 0

/** Opens a named section in system traces; close it with `endSection`. Nesting is allowed. */
export function beginSection(name: string): void {
    native.beginSection(name)
    open.push({ name, start: performance.now() })
}

export function endSection(): void {
    native.endSection()
    const section = open.pop()
    if (recording && section)
        recordSpan({
            name: section.name,
            start: section.start,
            duration: performance.now() - section.start,
            thread: 'js',
        })
}

/** Runs `work` inside a named trace section. */
export function traced<T>(name: string, work: () => T): T {
    beginSection(name)
    try {
        return work()
    } finally {
        endSection()
    }
}

export function recordSpan(span: Span): void {
    spans[next] = span
    next = (next + 1) % MAX_SPANS
}

/** Recorded spans in the order they were recorded (a section when it ends, native ones at each poll). */
export function getSpans(): Span[] {
    return [...spans.slice(next), ...spans.slice(0, next)]
}

export function clearSpans(): void {
    spans.length = 0
    next = 0
}

export function isRecording(): boolean {
    return recording
}

/** Records spans and native frame stats from now on, and again on the next launches until turned off. */
export function setRecording(enabled: boolean): void {
    recording = enabled
    deviceStorage.set(RECORDING_KEY, enabled)
    nativeOffset = native.setRecording(enabled) - performance.now()
}

/** Native frame stats since the last call; native spans move into the span buffer. */
export function takeNativeSnapshot(): NativeSnapshot {
    const { spans: nativeSpans, ...snapshot } = JSON.parse(
        native.snapshot(),
    ) as NativeSnapshot & { spans: [string, number, number, string][] }
    for (const [name, start, duration, thread] of nativeSpans)
        recordSpan({ name, start: start - nativeOffset, duration, thread })
    return snapshot
}

export function saveTrace(name: string, json: string): Promise<string> {
    return native.saveTrace(name, json)
}

// Turned on in an earlier launch: record from the first section, so startup is included.
if (deviceStorage.getBoolean(RECORDING_KEY)) setRecording(true)
