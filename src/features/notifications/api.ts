import { Endpoint } from '../../core/api/paths'
import { compareSnowflakes } from '../../core/discord/snowflake'
import type { RestClient } from '../../core/api/rest'
import type { Message } from '../../stores/readStates'

/** NotificationCenterItems: the item types that carry a message mentioning the user. */
export const MENTION_ITEM_TYPES = new Set(['recent_mention', 'reply_mention'])

/** A notification centre item, with the fields the mention rows use. */
export interface NotificationItem {
    id: string
    type: string
    acked?: boolean
    message?: Message
    message_id?: string
    message_channel_id?: string
    guild_id?: string
}

/** The mention items the tab shows: the types above, with their message. */
export const isMentionItem = (item: NotificationItem) =>
    MENTION_ITEM_TYPES.has(item.type) && item.message != null

/**
 * NotificationCenterForYou's unread check for a mention item: not acked, and the channel's read marker (`acks` of
 * the read states, ReadStateStore.ackMessageId) is before the message.
 */
export function isUnreadMention(
    item: NotificationItem,
    acks: Record<string, string>,
): boolean {
    if (item.acked) return false
    const target = mentionTarget(item)
    if (!target) return false
    const ack = acks[target.channelId]
    return ack == null || compareSnowflakes(target.messageId, ack) > 0
}

/** The channel and message a mention item points at. */
export interface MentionTarget {
    channelId: string
    messageId: string
}

/** Returns the message a mention item points at, when it has one. */
export function mentionTarget(
    item: NotificationItem,
): MentionTarget | undefined {
    const channelId = item.message_channel_id ?? item.message?.channel_id
    const messageId = item.message_id ?? item.message?.id
    return channelId && messageId ? { channelId, messageId } : undefined
}

/** PAGE_SIZE_WITH_MENTIONS (useNotificationCenterItemsLoader): every page after the first. */
export const PAGE_SIZE = 8

/**
 * NotificationCenterForYou's initialPageSize: enough 68 dp rows to fill the screen, between 8 and 50.
 * (The reference uses 48 dp rows in the compact channel list layout, which we don't have.)
 */
export const initialPageSize = (height: number) =>
    Math.min(50, Math.max(8, Math.ceil(height / 68)))

/**
 * fetchNotificationCenterItems: GET /users/@me/notification-center/items with mentions, @role and @everyone
 * mentions included. `after` is the cursor of the previous page.
 */
export function fetchNotificationItems(
    rest: RestClient,
    limit: number,
    after?: string,
    signal?: AbortSignal,
): Promise<{
    items: NotificationItem[]
    cursor?: string | null
    has_more?: boolean
}> {
    return rest.get(Endpoint.notificationCenterItems, {
        query: {
            limit,
            with_mentions: true,
            roles_filter: true,
            everyone_filter: true,
            after,
        },
        signal,
    })
}

/** deleteNotificationCenterItem: DELETE /users/@me/notification-center/items/<id>, with its kind. */
export function deleteNotificationItem(
    rest: RestClient,
    item: NotificationItem,
): Promise<unknown> {
    return rest.delete(Endpoint.notificationCenterItem(item.id), {
        body: { item_type: isMentionItem(item) ? 'mention' : 'regular' },
    })
}

/** markNotificationCenterRemoteItemAcked: POST /users/@me/notification-center/items/<id>/ack. */
export function ackNotificationItem(
    rest: RestClient,
    itemId: string,
): Promise<unknown> {
    return rest.post(Endpoint.notificationCenterItemAck(itemId))
}
