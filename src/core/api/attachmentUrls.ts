import { Endpoint } from './paths'
import type { Session } from '../session'

/** The `ex` query parameter of a signed attachment URL: its expiry, in hex seconds. */
const EXPIRY_PARAM = /[?&]ex=([0-9a-f]+)/i
/** AttachmentUrlUtils refreshes a URL that expires within the hour. */
const REFRESH_AHEAD_MS = 60 * 60 * 1000
const MS_PER_SECOND = 1000

/** shouldRefreshAttachmentUrl: true when the URL has no expiry or expires within the hour. */
function shouldRefresh(url: string): boolean {
    const expiry = Number.parseInt(url.match(EXPIRY_PARAM)?.[1] ?? '', 16)
    return (
        Number.isNaN(expiry) ||
        expiry * MS_PER_SECOND <= Date.now() + REFRESH_AHEAD_MS
    )
}

/**
 * AttachmentUrlUtils.maybeRefreshAttachmentUrl: the attachment URL, re-signed first when it has expired or is about
 * to (POST /attachments/refresh-urls, read-only). Falls back to the URL as given.
 */
export async function maybeRefreshAttachmentUrl(
    session: Session,
    url: string,
): Promise<string> {
    if (!shouldRefresh(url)) return url
    try {
        const { refreshed_urls } = await session.rest.post<{
            refreshed_urls: { original: string; refreshed: string }[]
        }>(Endpoint.attachmentsRefreshUrls, {
            body: { attachment_urls: [url] },
        })
        return refreshed_urls[0]?.refreshed ?? url
    } catch {
        return url
    }
}
