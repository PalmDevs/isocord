import { useEffect } from 'react'
import { createStore } from 'zustand/vanilla'
import { Endpoint } from '../../../core/api/paths'
import { ApiError, HTTP_TOO_MANY_REQUESTS } from '../../../core/api/rest'
import { Permission } from '../../../core/discord/permissions'
import { streamKey } from '../../../core/discord/streams'
import { logger } from '../../../core/log'
import { useSession, useSessionStore } from '../../../core/react'
import { defineStore } from '../../../core/session'
import { MINUTE, SECOND } from '../../../core/time'
import { useChannelPermissions } from '../../../stores/permissions'
import { rtcStore } from '../rtc'
import type { Session } from '../../../core/session'

const log = logger('Voice')

/** STREAM_PREVIEW_FETCH_SUCCESS: a preview stays fresh this long. */
const PREVIEW_TTL_MS = 2 * MINUTE
/** shouldFetchPreview: a stream that never got a preview is tried this many times. */
const MAX_ATTEMPTS = 5
/** STREAM_PREVIEW_FETCH_FAIL: without a rate limit, each failed attempt waits this much longer. */
const RETRY_STEP_MS = 10 * SECOND
/** A preview is stale only past its expiry, so the refresh waits this long after it. */
const STALE_SLACK_MS = 1

interface Preview {
    /** The thumbnail, null after a failed fetch. */
    url: string | null
    /** When to fetch again, in epoch ms. */
    expires: number
}

interface StreamPreviewsState {
    /** By stream key. */
    previews: Readonly<Record<string, Preview>>
    /** Fetches since the last success, by stream key. */
    attempts: Readonly<Record<string, number>>
    loading: Readonly<Record<string, true>>
}

const EMPTY: StreamPreviewsState = { previews: {}, attempts: {}, loading: {} }

const without = <T>(record: Readonly<Record<string, T>>, key: string) => {
    const { [key]: _removed, ...rest } = record
    return rest
}

/**
 * ApplicationStreamPreviewStore: Go Live thumbnails by stream key. Reset on READY (CONNECTION_OPEN). A voice state
 * that stops streaming drops its stream's preview.
 */
export const streamPreviewsStore = defineStore('streamPreviews', session => {
    const store = createStore<StreamPreviewsState>(() => EMPTY)
    const { dispatch } = session.gateway
    dispatch.on('READY', () => store.setState(EMPTY, true))
    dispatch.on('VOICE_STATE_UPDATE', update => {
        if (update.self_stream || !update.channel_id) return
        const key = streamKey(
            update.guild_id ?? null,
            update.channel_id,
            update.user_id,
        )
        store.setState(state =>
            key in state.previews || key in state.attempts
                ? {
                      previews: without(state.previews, key),
                      attempts: without(state.attempts, key),
                  }
                : state,
        )
    })
    return store
})

/** ApplicationStreamPreviewStore.shouldFetchPreview. */
function shouldFetch(state: StreamPreviewsState, key: string): boolean {
    if (state.loading[key]) return false
    const preview = state.previews[key]
    if (preview) return Date.now() > preview.expires
    return (state.attempts[key] ?? 0) < MAX_ATTEMPTS
}

/** StreamActionCreators.fetchStreamPreview: GET the stream's preview, with `version` busting caches. */
async function fetchStreamPreview(session: Session, key: string) {
    const store = session.get(streamPreviewsStore)
    if (!shouldFetch(store.getState(), key)) return
    const attempts = (store.getState().attempts[key] ?? 0) + 1
    store.setState(state => ({
        attempts: { ...state.attempts, [key]: attempts },
        loading: { ...state.loading, [key]: true },
    }))
    try {
        const body = await session.rest.get<{ url: string }>(
            Endpoint.streamPreview(key),
            { query: { version: Date.now() } },
        )
        store.setState(state => ({
            previews: {
                ...state.previews,
                [key]: { url: body.url, expires: Date.now() + PREVIEW_TTL_MS },
            },
            attempts: { ...state.attempts, [key]: 0 },
            loading: without(state.loading, key),
        }))
    } catch (error) {
        log.warn('Stream preview fetch failed', error)
        const limited =
            error instanceof ApiError &&
            error.status === HTTP_TOO_MANY_REQUESTS &&
            typeof error.body?.retry_after === 'number'
        const retryAfter = limited
            ? error.body.retry_after * SECOND
            : RETRY_STEP_MS * attempts
        store.setState(state => ({
            previews: {
                ...state.previews,
                [key]: { url: null, expires: Date.now() + retryAfter },
            },
            loading: without(state.loading, key),
        }))
    }
}

/**
 * useFetchStreamPreview: the thumbnail of a user's stream, fetched while we may connect to the channel or are in it.
 * It is fetched again when it goes stale, every two minutes.
 */
export function useStreamPreview(
    guildId: string,
    channelId: string,
    ownerId: string,
): string | null {
    const session = useSession()
    const key = streamKey(guildId, channelId, ownerId)
    const canConnect =
        (useChannelPermissions(channelId) & Permission.CONNECT) !== 0n
    const inChannel = useSessionStore(
        rtcStore,
        state => state.channelId === channelId,
    )
    const allowed = canConnect || inChannel
    const url = useSessionStore(
        streamPreviewsStore,
        state => state.previews[key]?.url ?? null,
    )
    const expires = useSessionStore(
        streamPreviewsStore,
        state => state.previews[key]?.expires ?? 0,
    )
    useEffect(() => {
        if (!allowed) return
        void fetchStreamPreview(session, key)
        // The reference checks freshness on its next render. A timer stands in for it.
        const timer = setTimeout(
            () => void fetchStreamPreview(session, key),
            Math.max(0, expires - Date.now()) + STALE_SLACK_MS,
        )
        return () => clearTimeout(timer)
    }, [session, key, allowed, expires])
    return allowed ? url : null
}
