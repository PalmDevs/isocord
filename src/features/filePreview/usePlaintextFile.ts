import { useEffect, useState } from 'react'
import { logger } from '../../core/log'

const log = logger('FilePreview')

/** useDownloadedFile reads the first 50 KB of the file. */
const PREVIEW_BYTES = 50000
const PREVIEW_RANGE = `bytes=0-${PREVIEW_BYTES}`
const HTTP_PARTIAL_CONTENT = 206

export type PlaintextFile =
    | { state: 'loading' }
    | { state: 'error' }
    /** `bytesLeft`: what the preview leaves unread. */
    | { state: 'done'; contents: string; bytesLeft: number }

/**
 * useDownloadedFile: the start of a text file, and how much of it is left. A cut file loses its last character,
 * which may be half of one. Unlike the reference, whitespace is kept as sent (sanitizeWhitespaceExcludingTabs).
 */
export function usePlaintextFile(url: string): PlaintextFile {
    const [file, setFile] = useState<PlaintextFile>({ state: 'loading' })
    useEffect(() => {
        let cancelled = false
        const download = async () => {
            const response = await fetch(url, {
                headers: { Range: PREVIEW_RANGE, Accept: 'text/plain' },
            })
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            const text = await response.text()
            if (response.status !== HTTP_PARTIAL_CONTENT) {
                // The server ignored the range and sent the whole file: keep the preview's share of it.
                const cut = text.length > PREVIEW_BYTES
                return {
                    state: 'done' as const,
                    contents: cut ? text.slice(0, PREVIEW_BYTES) : text,
                    bytesLeft: cut ? text.length - PREVIEW_BYTES : 0,
                }
            }
            // "bytes <start>-<end>/<total>"; content-length is unreliable for gzip or chunked replies.
            const [, end, total] =
                /\d+-(\d+)\/(\d+)/
                    .exec(response.headers.get('content-range') ?? '')
                    ?.map(Number) ?? []
            const bytesLeft =
                end === undefined || total === undefined
                    ? 0
                    : Math.max(0, total - (end + 1))
            return {
                state: 'done' as const,
                contents: bytesLeft === 0 ? text : text.slice(0, -1),
                bytesLeft,
            }
        }
        download().then(
            result => {
                if (!cancelled) setFile(result)
            },
            error => {
                log.warn('Preview failed', error)
                if (!cancelled) setFile({ state: 'error' })
            },
        )
        return () => {
            cancelled = true
        }
    }, [url])
    return file
}
