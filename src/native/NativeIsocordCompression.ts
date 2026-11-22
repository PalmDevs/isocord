import { TurboModuleRegistry } from 'react-native'
import type { TurboModule } from 'react-native'

/** Native zstd decompression for the gateway socket (CompressionModule.kt). */
export interface Spec extends TurboModule {
    getConstants(): {
        /** Whether the native WebSocket can decompress a zstd-stream socket. */
        supportsZstd: boolean
    }
    /**
     * Decompresses the binary messages of a WebSocket in native code, through
     * WebSocketModule.ContentHandler, so the JS thread only parses the payloads.
     */
    enableZstdStreamSupport(socketId: number): void
    /** Drops the decompressor of a socket and the handler it installed. */
    disableZstdStreamSupport(socketId: number): void
}

export default TurboModuleRegistry.getEnforcing<Spec>('IsocordCompression')
