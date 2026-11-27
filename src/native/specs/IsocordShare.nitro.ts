import type { HybridObject } from 'react-native-nitro-modules'

/** Content shared to the app with a SEND or SEND_MULTIPLE intent (HybridIsocordShare.kt). */
export interface IsocordShare extends HybridObject<{ android: 'kotlin' }> {
    /** Returns the pending share as SharedContent JSON, once. Undefined when there is none. */
    takeShared(): Promise<string | undefined>
    /** Registers a listener called when a share arrives; returns an unsubscribe function. */
    onShared(listener: () => void): () => void
}
