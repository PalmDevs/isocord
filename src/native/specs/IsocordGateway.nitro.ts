import type { HybridObject } from 'react-native-nitro-modules'

/** Native WebSocket zstd decompression and fast-connect IDENTIFY for the gateway (HybridIsocordGateway.kt). */
export interface IsocordGateway extends HybridObject<{ android: 'kotlin' }> {
    /** Whether the native WebSocket can decompress a zstd-stream socket. */
    readonly supportsZstd: boolean
    /**
     * Decompresses the binary messages of a WebSocket in native code, through
     * WebSocketModule.ContentHandler, so the JS thread only parses the payloads.
     */
    enableZstdStreamSupport(socketId: number): void
    /** Drops the decompressor of a socket and the handler it installed. */
    disableZstdStreamSupport(socketId: number): void
    /**
     * FastConnectModule `prepareIdentify`: sends this IDENTIFY on the first frame (HELLO), or now if it came.
     * Returns false when native code cannot send it, so JS must identify.
     */
    prepareIdentify(socketId: number, payload: string): boolean
}
