import type { HybridObject } from 'react-native-nitro-modules'

export interface ProgressEvent {
    id: string
    /** `compress` while preparing the file, `upload` while sending it. */
    phase: string
    /** Bytes sent, or percent (0-100) for `compress`. */
    done: number
    /** Total bytes, or 100 for `compress`. */
    total: number
}

export interface PrepareOptions {
    /** The largest size the upload may have; bigger images and videos are compressed. 0 = no limit. */
    maxBytes: number
    /** Show the file name as given instead of the one resolved from the uri. */
    filename?: string
}

export interface PreparedFile {
    /** Uri to hand to `upload`: the original, or a compressed copy in the cache. */
    uri: string
    filename: string
    mimeType: string
    size: number
    width: number
    height: number
    /** Video or audio length in seconds, 0 when unknown. */
    durationSecs: number
    /** True when `uri` is a copy this module made, which `deleteFile` may remove. */
    compressed: boolean
}

export interface IsocordUploader extends HybridObject<{ android: 'kotlin' }> {
    /**
     * Reads the file's name, size and type, and re-encodes it when needed: HEIC to JPEG, and images
     * or videos larger than `maxBytes` scaled down.
     */
    prepare(
        id: string,
        uri: string,
        options: PrepareOptions,
    ): Promise<PreparedFile>
    /**
     * Streams the file to a signed Google Cloud Storage `uploadUrl` in resumable chunks, checking the
     * committed offset and retrying after network errors. Progress arrives via `onProgress`.
     */
    upload(
        id: string,
        uri: string,
        uploadUrl: string,
        mimeType: string,
        size: number,
    ): Promise<void>
    /** Stops a `prepare` or `upload` that is running. */
    cancel(id: string): void
    /** Removes a compressed copy made by `prepare`. Other uris are left alone. */
    deleteFile(uri: string): void
    onProgress(listener: (event: ProgressEvent) => void): () => void
}
