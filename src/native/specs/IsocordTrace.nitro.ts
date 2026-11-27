import type { HybridObject } from 'react-native-nitro-modules'

/** System trace sections and the perf monitor (HybridIsocordTrace.kt). */
export interface IsocordTrace extends HybridObject<{ android: 'kotlin' }> {
    beginSection(name: string): boolean
    endSection(): boolean
    /** Starts or stops the perf monitor and returns the native clock in ms. */
    setRecording(enabled: boolean): number
    /** Frame stats and native spans since the last call, as JSON. */
    snapshot(): string
    /** Saves an exported trace to Downloads and resolves where. */
    saveTrace(name: string, json: string): Promise<string>
}
