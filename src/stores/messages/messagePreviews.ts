import { Endpoint } from '../../core/api/paths'
import { ApiError } from '../../core/api/rest'
import { compareSnowflakes } from '../../core/discord/snowflake'
import { messagesStore, PAGE_SIZE } from './messages'
import { AROUND_HALF, upsertUsers } from './messageWindows'
import type { Session } from '../../core/session'
import type { Message } from '../readStates'
import type { MessagePreview } from './messageTypes'

/** A session's preview requests. */
interface PreviewRequests {
    /** Bumped by every `loadPreview` and `clearPreview`. A preview request that started before is discarded. */
    current: number
    /** Pages of the preview in flight, by request and direction. */
    pages: Set<string>
}

const previewRequests = new WeakMap<Session, PreviewRequests>()

function requests(session: Session): PreviewRequests {
    let state = previewRequests.get(session)
    if (!state) {
        state = { current: 0, pages: new Set() }
        previewRequests.set(session, state)
    }
    return state
}

/**
 * MessagePreviewActionCreators.fetchMessages: the messages around a search result, for its preview. A newer
 * preview replaces an older one still loading.
 */
export async function loadPreview(
    session: Session,
    channelId: string,
    messageId: string,
): Promise<void> {
    const store = session.get(messagesStore)
    const preview: MessagePreview = {
        channelId,
        messageId,
        messages: [],
        loading: true,
        hasMore: false,
        hasMoreAfter: false,
    }
    store.setState({ preview })
    // Not the preview object itself: gateway events (`edit`) replace it while the request is in flight.
    const request = ++requests(session).current
    const current = () => requests(session).current === request
    try {
        const page = await session.rest.get<Message[]>(
            Endpoint.channelMessages(channelId),
            { query: { limit: PAGE_SIZE, around: messageId }, retries: 2 },
        )
        if (!current()) return
        const messages = [...page].sort((a, b) => compareSnowflakes(b.id, a.id))
        upsertUsers(session, messages)
        // As jumpToMessage: more on a side when that side came back full.
        const index = messages.findIndex(message => message.id === messageId)
        store.setState({
            preview: {
                ...preview,
                messages,
                loading: false,
                hasMore:
                    index >= 0 &&
                    messages.length - index - 1 >= AROUND_HALF - 1,
                hasMoreAfter: index >= AROUND_HALF - 1,
                // The API answers with the messages near a deleted one as well.
                error: messages.some(message => message.id === messageId)
                    ? undefined
                    : 'missing',
            },
        })
    } catch (error) {
        if (!current()) return
        store.setState({
            preview: {
                ...preview,
                loading: false,
                error:
                    error instanceof ApiError &&
                    error.status >= 400 &&
                    error.status < 500 &&
                    error.status !== 429
                        ? 'missing'
                        : 'failed',
            },
        })
    }
}

/** The page before the preview's oldest message (`older`) or after its newest one, as the chat pages. */
export async function loadPreviewPage(
    session: Session,
    older: boolean,
): Promise<void> {
    const store = session.get(messagesStore)
    const preview = store.getState().preview
    if (!preview || preview.loading) return
    if (older ? !preview.hasMore : !preview.hasMoreAfter) return
    const { pages } = requests(session)
    const request = requests(session).current
    const key = `${request}:${older}`
    if (pages.has(key)) return
    pages.add(key)
    const edge = older ? preview.messages.at(-1)?.id : preview.messages[0]?.id
    try {
        const page = await session.rest.get<Message[]>(
            Endpoint.channelMessages(preview.channelId),
            {
                // MessageActionCreators `fetchMessages`.
                retries: 2,
                query: older
                    ? { limit: PAGE_SIZE, before: edge }
                    : { limit: PAGE_SIZE, after: edge },
            },
        )
        const latest = store.getState().preview
        if (requests(session).current !== request || !latest) return
        upsertUsers(session, page)
        const ids = new Set(latest.messages.map(message => message.id))
        store.setState({
            preview: {
                ...latest,
                messages: [
                    ...latest.messages,
                    ...page.filter(message => !ids.has(message.id)),
                ].sort((a, b) => compareSnowflakes(b.id, a.id)),
                ...(older
                    ? { hasMore: page.length === PAGE_SIZE }
                    : { hasMoreAfter: page.length === PAGE_SIZE }),
            },
        })
    } catch {
        // The list asks again as it scrolls (its own retry interval).
    } finally {
        pages.delete(key)
    }
}

/** MessagePreviewActionCreators.clearMessages: the preview closed. */
export function clearPreview(session: Session): void {
    requests(session).current++
    session.get(messagesStore).setState({ preview: undefined })
}
