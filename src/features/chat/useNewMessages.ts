import { useEffect, useState } from 'react'
import { compareSnowflakes } from '../../core/discord/snowflake'
import { useSession, useSessionStore } from '../../core/react'
import { messagesStore } from '../../stores/messages/messages'
import { readStatesStore } from '../../stores/readStates'

export interface NewMessages {
    count: number
    /** The count is a lower bound ("N+"). */
    estimated: boolean
    oldestUnreadId: string
    newestId: string
}

/**
 * Returns the loaded messages newer than the read marker, while the gateway is connected (ChatBanner's
 * unreadCount). Undefined when there are none.
 */
export function useNewMessages(channelId: string): NewMessages | undefined {
    const session = useSession()
    const ackId = useSessionStore(
        readStatesStore,
        state => state.acks[channelId],
    )
    const messages = useSessionStore(
        messagesStore,
        state => state.channels[channelId],
    )
    const [connected, setConnected] = useState(
        session.gateway.state === 'connected',
    )
    useEffect(() => {
        setConnected(session.gateway.state === 'connected')
        return session.gateway.events.on('state', state =>
            setConnected(state === 'connected'),
        )
    }, [session])

    if (!connected || !ackId || !messages) return undefined
    // ReadState.rebuildChannelState: the loaded messages after the marker. The count is a lower bound ("N+") when
    // the window is not the newest, or every loaded message is unread (the marker is further back).
    const list = messages.messages
    let count = 0
    let oldestUnreadId: string | undefined
    for (const message of list) {
        if (compareSnowflakes(message.id, ackId) <= 0) break
        count++
        oldestUnreadId = message.id
    }
    if (count === 0 || !oldestUnreadId || !list[0]) return undefined
    return {
        count,
        estimated: messages.hasMoreAfter === true || count === list.length,
        oldestUnreadId,
        newestId: list[0].id,
    }
}
