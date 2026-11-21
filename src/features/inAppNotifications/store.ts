import { createStore } from 'zustand/vanilla'
import { ChannelType } from '../../core/discord/channelType'
import { compareSnowflakes } from '../../core/discord/snowflake'
import { defineStore } from '../../core/session'
import { nextInAppNotificationOrder } from '../../design/components/overlays/modalOrder'
import { t } from '../../i18n'
import { computeChannelName } from '../../stores/channels/channelName'
import {
    channelsStore,
    isPrivate,
    isThread,
} from '../../stores/channels/channels'
import { guildsStore } from '../../stores/guilds'
import { settingsStore } from '../../stores/settings/settingsStore'
import { usersStore } from '../../stores/users'
import { hexColor } from '../chat/color'
import { buildMessageRow, standaloneRow } from '../chat/rows/rowEncoder'
import { previewText } from '../messages/preview'
import { channelIcon } from '../servers/channelIcon'
import { forwardMessage } from '../systemNotifications/forward'
import type { Session } from '../../core/session'
import type { IconName } from '../../design/icons/Icon'
import type { Channel } from '../../stores/channels/channels'
import type { Message } from '../../stores/readStates'
import type { User } from '../../stores/users'

/** A MESSAGE in-app notification, with what its card shows worked out when it arrives. */
export interface InAppNotification {
    /** The message id (the reference keys message notifications by it). */
    key: string
    channelId: string
    messageId: string
    author: User
    authorName: string
    /** The author's role colour, `#rrggbb`. */
    authorColor?: string
    /** MessageNotificationHeader getLocationLabel: "channel, server", "thread, channel", the group's name. */
    location?: string
    locationIcon?: IconName
    /** JSON of the message's chat row, for `IsocordMessagePreviewView`. */
    row: string
    /** "Received message from {userName}: {message}", announced when it shows. */
    announcement: string
    /** Place among open overlays, from `nextInAppNotificationOrder`. */
    order: number
}

interface InAppNotificationsState {
    /** On screen. */
    current?: InAppNotification
    /** Waiting their turn, oldest first. */
    queue: InAppNotification[]
    /** The channel whose chat is on screen with the app in front. */
    visibleChannelId?: string
}

/** InAppNotificationStore NotificationQueue.isFull: at most two wait; a third pushes the oldest out. */
const QUEUE_SIZE = 2

/**
 * Called by a chat while it is on screen with the app in front: its messages don't notify
 * (NotificationTextUtils.shouldIncludeSelectedChannel / isChannelFocused). Returns the cleanup.
 */
export function showingChannel(
    session: Session,
    channelId: string,
): () => void {
    const store = session.get(inAppNotificationsStore)
    store.setState({ visibleChannelId: channelId })
    return () => {
        if (store.getState().visibleChannelId === channelId)
            store.setState({ visibleChannelId: undefined })
    }
}

/** Takes the notification off screen and brings in the next one, if it is still the one showing. */
export function dismissInAppNotification(session: Session, key: string): void {
    session.get(inAppNotificationsStore).setState(state => {
        if (state.current?.key !== key) return state
        const next = state.queue[0]
        const current = next
            ? { ...next, order: nextInAppNotificationOrder() }
            : undefined
        return { current, queue: state.queue.slice(1) }
    })
}

function locationOf(
    session: Session,
    channel: Channel,
    channels: Record<string, Channel>,
    users: Record<string, User>,
): string | undefined {
    if (channel.type === ChannelType.DM) return undefined
    if (channel.type === ChannelType.GROUP_DM)
        return computeChannelName(channel, users)
    const parent = isThread(channel)
        ? channels[channel.parent_id ?? '']
        : undefined
    const guild = session.get(guildsStore).getState().guilds[
        channel.guild_id ?? ''
    ]
    const after = parent?.name ?? guild?.name
    return after ? `${channel.name}, ${after}` : channel.name
}

function build(
    session: Session,
    message: Message,
    channel: Channel,
): InAppNotification | undefined {
    const channels = session.get(channelsStore).getState().channels
    const known = session.get(usersStore).getState().users
    const row = buildMessageRow(session, message)
    if (!row) return undefined
    const authorName = row.authorName
    return {
        key: message.id,
        channelId: channel.id,
        messageId: message.id,
        author: message.author,
        authorName,
        authorColor:
            row.authorColor === undefined
                ? undefined
                : hexColor(row.authorColor),
        location: locationOf(session, channel, channels, known),
        locationIcon: isPrivate(channel)
            ? undefined
            : channelIcon(channel.type),
        // Standalone, like a search result: no grouping, reply, reactions or swipe.
        row: JSON.stringify(standaloneRow(row)),
        announcement: t('inAppNotifications.received', {
            userName: authorName,
            message: previewText(message) ?? '',
        }),
        order: nextInAppNotificationOrder(),
    }
}

/** Shows a message's notification without asking whether it should notify: one on screen, the rest wait. */
export function showInAppNotification(
    session: Session,
    message: Message,
    channel: Channel,
): void {
    const notification = build(session, message, channel)
    if (!notification) return
    session.get(inAppNotificationsStore).setState(state => {
        if (!state.current) return { current: notification }
        const queue = [...state.queue, notification]
        if (queue.length > QUEUE_SIZE) queue.shift()
        return { queue }
    })
}

/**
 * The check only the app can make, before the native ones (NotificationTextUtils.shouldIncludeSelectedChannel): the
 * channel is on screen. Native drops messages replayed after the hand-over (Handover.kt).
 */
function hidden(state: InAppNotificationsState, message: Message): boolean {
    return message.channel_id === state.visibleChannelId
}

export const inAppNotificationsStore = defineStore(
    'inAppNotifications',
    session => {
        const store = createStore<InAppNotificationsState>(() => ({
            queue: [],
        }))
        const { dispatch } = session.gateway

        // InAppNotificationStore handleIncomingMessage. The system notification in front is decided with it.
        dispatch.on('MESSAGE_CREATE', message => {
            const channel = session.get(channelsStore).getState().channels[
                message.channel_id
            ]
            if (!channel || hidden(store.getState(), message)) return
            // Native decides from its own state, so the card follows once it answers.
            forwardMessage(session, message).then(notifies => {
                if (
                    notifies &&
                    session.get(settingsStore).getState()
                        .showInAppNotifications !== false
                )
                    showInAppNotification(session, message, channel)
            })
        })

        // handleMessageAck: a channel read up to a message takes its notifications up to it away.
        dispatch.on('MESSAGE_ACK', ack => {
            const covered = (notification: InAppNotification) =>
                notification.channelId === ack.channel_id &&
                compareSnowflakes(notification.messageId, ack.message_id) <= 0
            store.setState(state => {
                const queue = state.queue.filter(item => !covered(item))
                if (state.current && covered(state.current)) {
                    const next = queue[0]
                    const current = next
                        ? { ...next, order: nextInAppNotificationOrder() }
                        : undefined
                    return { current, queue: queue.slice(1) }
                }
                return queue.length === state.queue.length ? state : { queue }
            })
        })

        return store
    },
)
