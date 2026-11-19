import { Dimensions } from 'react-native'
import { createStore } from 'zustand/vanilla'
import { compareSnowflakes } from '../../core/discord/snowflake'
import { defineStore } from '../../core/session'
import { ackMessage, readStatesStore } from '../../stores/readStates'
import {
    ackNotificationItem,
    deleteNotificationItem,
    fetchNotificationItems,
    initialPageSize,
    isMentionItem,
    isUnreadMention,
    mentionTarget,
    PAGE_SIZE,
} from './api'
import type { MentionTarget, NotificationItem } from './api'

declare module '../../core/gateway/events' {
    interface GatewayEvents {
        NOTIFICATION_CENTER_ITEM_CREATE: NotificationItem
        NOTIFICATION_CENTER_ITEM_DELETE: { id: string }
        NOTIFICATION_CENTER_ITEMS_ACK: { id: string }
    }
}

interface NotificationsState {
    items: NotificationItem[]
    /** The cursor of the last page loaded; null when there is none. */
    cursor: string | null
    hasMore: boolean
    /** A first page is on its way. */
    loading: boolean
    /** The last first page failed. */
    error: boolean
    /** A first page asked for by a pull to refresh is on its way. */
    refreshing: boolean
    /** Fetches the first page again, replacing the items (the reference resets them whenever the tab is left). */
    refresh: (limit: number, pulled?: boolean) => void
    /** Appends the next page; one request at a time. */
    loadMore: () => void
    /** Removes an item, locally first (deleteNotificationCenterItem). Rejects, with the item back, on failure. */
    remove: (item: NotificationItem) => Promise<void>
    /**
     * Marks an item read, locally first (markNotificationCenterItemAcked). A mention moves its channel's read marker.
     * Other items are acked on the server, undone on failure.
     */
    ack: (item: NotificationItem) => void
}

/**
 * The notification centre's items (NotificationCenterItemsStore), cached so the tab shows the last ones at once
 * while the first page is fetched again. The first page is also fetched on READY, so the tab's badge is current
 * before the tab is opened; the gateway's item events keep it so.
 */
export const notificationsStore = defineStore(
    'notifications',
    session => {
        // Bumped by every first page, so a later page of the previous list is dropped.
        let generation = 0
        let abort: AbortController | undefined
        let loadingMore = false

        const refresh = (limit: number, pulled = false) => {
            abort?.abort()
            const controller = new AbortController()
            abort = controller
            const current = ++generation
            loadingMore = false
            store.setState({ loading: true, refreshing: pulled, error: false })
            fetchNotificationItems(
                session.rest,
                limit,
                undefined,
                controller.signal,
            )
                .then(page => {
                    if (current !== generation) return
                    store.setState({
                        items: page.items,
                        cursor: page.cursor ?? null,
                        hasMore: page.has_more === true && page.cursor != null,
                        loading: false,
                        refreshing: false,
                    })
                })
                .catch(() => {
                    if (current !== generation) return
                    store.setState({
                        loading: false,
                        refreshing: false,
                        error: true,
                    })
                })
        }

        const loadMore = () => {
            const { cursor, hasMore, loading } = store.getState()
            if (loadingMore || loading || !hasMore || !cursor) return
            loadingMore = true
            const current = generation
            fetchNotificationItems(session.rest, PAGE_SIZE, cursor)
                .then(page => {
                    if (current !== generation) return
                    store.setState(state => ({
                        items: [...state.items, ...page.items],
                        cursor: page.cursor ?? null,
                        hasMore: page.has_more === true && page.cursor != null,
                    }))
                })
                .catch(() => {
                    // The list asks again while it stays at the end.
                })
                .finally(() => {
                    if (current === generation) loadingMore = false
                })
        }

        const setAcked = (itemId: string, acked: boolean) =>
            store.setState(state => ({
                items: state.items.map(item =>
                    item.id === itemId ? { ...item, acked } : item,
                ),
            }))

        const remove = async (item: NotificationItem) => {
            const index = store.getState().items.indexOf(item)
            store.setState(state => ({
                items: state.items.filter(known => known.id !== item.id),
            }))
            try {
                await deleteNotificationItem(session.rest, item)
            } catch (error) {
                // NOTIFICATION_CENTER_ITEM_DELETE_FAILURE: the item goes back where it was.
                store.setState(state => {
                    if (state.items.some(known => known.id === item.id))
                        return state
                    const items = [...state.items]
                    items.splice(index === -1 ? 0 : index, 0, item)
                    return { items }
                })
                throw error
            }
        }

        const ack = (item: NotificationItem) => {
            setAcked(item.id, true)
            const target = isMentionItem(item) ? mentionTarget(item) : undefined
            if (target) {
                // The reference only acks a mention item locally, so a refetch brings it back unread.
                // Its unread state is the channel's read marker, so that is what moves.
                ackMessage(
                    session,
                    target.channelId,
                    target.messageId,
                    mentionsAfter(target),
                )
                return
            }
            ackNotificationItem(session.rest, item.id).catch(() =>
                setAcked(item.id, item.acked ?? false),
            )
        }

        /** Unread mentions the list holds in a channel after a message: the local mention count after the ack. */
        const mentionsAfter = (target: MentionTarget) => {
            const { acks } = session.get(readStatesStore).getState()
            return store.getState().items.filter(known => {
                const other = isMentionItem(known) && mentionTarget(known)
                return (
                    other &&
                    other.channelId === target.channelId &&
                    compareSnowflakes(other.messageId, target.messageId) > 0 &&
                    isUnreadMention(known, acks)
                )
            }).length
        }

        const { dispatch } = session.gateway
        dispatch.on('READY', () =>
            refresh(initialPageSize(Dimensions.get('window').height)),
        )
        // NotificationCenterItemsStore: NOTIFICATION_CENTER_ITEM_CREATE (handleAddItem), _DELETE and _ITEMS_ACK.
        dispatch.on('NOTIFICATION_CENTER_ITEM_CREATE', item =>
            store.setState(state =>
                state.items.some(known => known.id === item.id)
                    ? state
                    : { items: [item, ...state.items] },
            ),
        )
        dispatch.on('NOTIFICATION_CENTER_ITEM_DELETE', ({ id }) =>
            store.setState(state => ({
                items: state.items.filter(item => item.id !== id),
            })),
        )
        dispatch.on('NOTIFICATION_CENTER_ITEMS_ACK', ({ id }) =>
            setAcked(id, true),
        )

        const store = createStore<NotificationsState>(() => ({
            items: [],
            cursor: null,
            hasMore: true,
            loading: false,
            refreshing: false,
            error: false,
            refresh,
            loadMore,
            remove,
            ack,
        }))
        return store
    },
    { cache: ['items', 'cursor', 'hasMore'] },
)
