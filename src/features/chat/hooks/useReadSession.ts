import { useEffect, useState } from 'react'
import { AppState } from 'react-native'
import { compareSnowflakes } from '../../../core/discord/snowflake'
import { useSession, useSessionStore } from '../../../core/react'
import { longestScrollMs } from '../../../native/NativeIsocordConstants'
import { channelsStore } from '../../../stores/channels/channels'
import { guildsStore } from '../../../stores/guilds'
import { messagesStore } from '../../../stores/messages/messages'
import {
    jumpToMessage,
    jumpToPresent,
} from '../../../stores/messages/messageWindows'
import { ackChannel, readStatesStore } from '../../../stores/readStates'
import { showingChannel } from '../../inAppNotifications/store'
import { mentionsUser } from '../rows/buildRows'
import type { Dispatch, SetStateAction } from 'react'
import type { Session } from '../../../core/session'
import type { ChannelMessages } from '../../../stores/messages/messageTypes'

// What the user has read in an open chat: the ack, the NEW divider and the jump to the first unread mention.

/** Longer than any scroll of the native list to a row, with room for the scroll to start. */
const JUMP_SETTLE_MS = longestScrollMs + 500

interface ReadSessionOptions {
    channelId: string
    /** The user can see the chat right now. Only a visible chat is read. */
    visible: boolean
    /** The chat opens at a given message, so it does not jump to the first unread mention. */
    jumping: boolean
    /** Scrolls the list to a message. */
    scrollTo: (messageId: string) => void
}

interface ReadSession {
    /** The NEW divider goes after this message. */
    ackedId?: string
    /** The list has reported where it rests and the opening jump has settled. */
    opened: boolean
    /** Takes the native list's report of whether it rests at the newest message. */
    onAtBottomChange: (scrollKey: string, atBottom: boolean) => void
}

/** The jump to the first unread mention when a chat opens, per channel. */
interface Opening {
    channelId: string
    /** Settled once the list has left the bottom, or had time to get there. */
    settled: boolean
    /** The jump asked the list to scroll. */
    scrolled?: boolean
}

/**
 * Tracks what the user reads in a chat. Acks the newest message while they read it, the reference's
 * ReadStateStore `_shouldAck`: channel focused, app active, scrolled to the bottom. Also keeps
 * the chat's in-app notifications away while it is on screen.
 */
export function useReadSession({
    channelId,
    visible,
    jumping,
    scrollTo,
}: ReadSessionOptions): ReadSession {
    const session = useSession()
    const messages = useSessionStore(
        messagesStore,
        state => state.channels[channelId],
    )
    const active = useAppActive()
    // Unknown (false) until the list reports it, so a chat restored to a spot in its history is not read on opening.
    const [bottom, setBottom] = useState<{
        channelId: string
        atBottom: boolean
    }>()
    // The reference acks a chat opened at the bottom as soon as its list reports where it rests (useScrollHandlers'
    // first updateChannelDimensions, then shouldAutomaticallyAck). With a jump, the at-bottom ack waits for it.
    const [opening, setOpening] = useState<Opening>()
    const settled = opening?.channelId === channelId && opening.settled
    const known = bottom?.channelId === channelId
    // A window jumped to ends before the present: what it shows is not the newest.
    const looking =
        visible &&
        active &&
        messages?.hasMoreAfter !== true &&
        known &&
        bottom.atBottom &&
        settled
    const { ackedId, reading } = useDivider(channelId, messages, looking)
    useFirstMentionJump({
        channelId,
        messages,
        ackedId,
        jumping,
        opening,
        setOpening,
        leftBottom: known && !bottom.atBottom,
        scrollTo,
    })

    const newestId = messages?.messages[0]?.id
    // The user's own message the store acks itself.
    useEffect(() => {
        if (newestId && reading) ackChannel(session, channelId, newestId)
    }, [session, channelId, newestId, reading])
    useEffect(() => {
        if (visible && active) return showingChannel(session, channelId)
    }, [session, channelId, visible, active])

    return {
        ackedId,
        opened: known && settled,
        onAtBottomChange: (scrollKey, atBottom) =>
            setBottom({ channelId: scrollKey, atBottom }),
    }
}

function useAppActive(): boolean {
    const [active, setActive] = useState(AppState.currentState === 'active')
    useEffect(() => {
        const subscription = AppState.addEventListener('change', state =>
            setActive(state === 'active'),
        )
        return () => subscription.remove()
    }, [])
    return active
}

/**
 * The NEW divider goes after `ackedId` (ReadStateStore's oldestUnreadMessageId): what was unread when the chat
 * opened. Acking while the chat is open does not move it. ReadStateStore MESSAGE_CREATE: a message that arrives
 * while the user is reading the newest one is acked at once and starts no divider. One that arrives while they
 * are scrolled away, or the chat is not on screen, is unread. When nothing was unread before, the divider moves
 * above it. The user's own message is acked and clears it (a local ack nulls oldestUnreadMessageId). Updated
 * while rendering, so no frame shows it. `reading` is `looking` unless the user marked the chat unread.
 */
function useDivider(
    channelId: string,
    messages: ChannelMessages | undefined,
    looking: boolean,
): { ackedId?: string; reading: boolean } {
    const session = useSession()
    const newestId = messages?.messages[0]?.id
    const readAck = () =>
        session.get(readStatesStore).getState().acks[channelId]
    // ReadStateStore MESSAGE_ACK `manual`: a channel marked unread joins the set `_shouldAck` refuses, so it is not
    // read again by being looked at. Selecting another channel, or an ack of its own (the user sending), ends that.
    const [manualUnread, setManualUnread] = useState<string>()
    const reading = looking && manualUnread !== channelId
    const [divider, setDivider] = useState(() => ({
        channelId,
        newestId,
        ackedId: readAck(),
    }))
    let ackedId = divider.ackedId
    if (divider.channelId !== channelId) {
        ackedId = readAck()
        setDivider({ channelId, newestId, ackedId })
        setManualUnread(undefined)
    } else if (divider.newestId !== newestId) {
        const previousId = divider.newestId
        // One message arrived at the newest end (a gateway MESSAGE_CREATE), rather than a new window, a refresh of
        // cached history or a pending message confirmed under its new id.
        const arrived =
            previousId !== undefined && messages?.messages[1]?.id === previousId
        const caughtUp =
            ackedId !== undefined && compareSnowflakes(ackedId, previousId) >= 0
        // What the user had read before the message came: the store's marker follows the acks made while they read.
        const read = readAck()
        const hadUnread =
            read !== undefined && compareSnowflakes(read, previousId) < 0
        if (messages?.messages[0]?.author.id === session.userId) {
            ackedId = newestId
            setManualUnread(undefined)
        } else if (arrived && reading) {
            if (caughtUp) ackedId = newestId
        } else if (arrived && !hadUnread) ackedId = previousId
        setDivider({ channelId, newestId, ackedId })
    }

    // Marking a message unread moves the divider above it at once (MESSAGE_ACK `manual`: rebuildChannelState).
    useEffect(
        () =>
            session.gateway.dispatch.on('MESSAGE_ACK', ack => {
                if (!ack.manual || ack.channel_id !== channelId) return
                setManualUnread(channelId)
                setDivider(current =>
                    current.channelId === channelId
                        ? { ...current, ackedId: ack.message_id }
                        : current,
                )
            }),
        [session, channelId],
    )
    return { ackedId, reading }
}

/**
 * Finds the oldest loaded message after `ackedId` that mentions the user, by the test that highlights it.
 * `reached` says the oldest unread message is loaded.
 */
function firstUnreadMention(
    session: Session,
    channelId: string,
    ackedId: string,
    myRoles: string[],
): { id?: string; reached: boolean } {
    const loaded = session.get(messagesStore).getState().channels[channelId]
    const list = loaded?.messages ?? []
    // From the oldest loaded message after the marker toward the newest (the list is newest first).
    let index = list.length - 1
    while (index >= 0 && compareSnowflakes(list[index]?.id, ackedId) <= 0)
        index--
    // Every loaded message is unread and older ones exist: the oldest unread is not loaded.
    const reached = index < list.length - 1 || loaded?.hasMore === false
    for (; index >= 0; index--) {
        const message = list[index]
        if (message && mentionsUser(message, session.userId, myRoles))
            return { id: message.id, reached }
    }
    return { reached }
}

/**
 * Scrolls a chat opened with unread mentions to the first of them.
 * Without unread mentions it opens where it was. The divider and the new messages bar lead to what is unread.
 * When the oldest unread message is not loaded, the window around the read marker loads (jumpToMessage)
 * and is searched from there.
 */
function useFirstMentionJump({
    channelId,
    messages,
    ackedId,
    jumping,
    opening,
    setOpening,
    leftBottom,
    scrollTo,
}: {
    channelId: string
    messages: ChannelMessages | undefined
    ackedId: string | undefined
    jumping: boolean
    opening: Opening | undefined
    setOpening: Dispatch<SetStateAction<Opening | undefined>>
    leftBottom: boolean
    scrollTo: (messageId: string) => void
}): void {
    const session = useSession()
    const guildId = useSessionStore(
        channelsStore,
        state => state.channels[channelId]?.guild_id,
    )
    const myRoles = useSessionStore(guildsStore, state =>
        guildId ? state.guilds[guildId]?.myRoles : undefined,
    )
    const historyReady =
        messages !== undefined &&
        messages.stale !== true &&
        messages.loading === false
    useEffect(() => {
        if (!historyReady || opening?.channelId === channelId) return
        // A page that arrives after the user moved to another channel settles nothing there.
        const mark = (scrolled: boolean) =>
            setOpening(current =>
                current?.channelId === channelId
                    ? { channelId, settled: !scrolled, scrolled }
                    : current,
            )
        const settle = () => mark(false)
        const jumpTo = (messageId: string) => {
            mark(true)
            scrollTo(messageId)
        }
        setOpening({ channelId, settled: false })
        // The ack is held until this is decided, so the count is still the one the chat opened with.
        const unreadMentions =
            session.get(readStatesStore).getState().mentions[channelId] ?? 0
        if (jumping || !ackedId || unreadMentions === 0) return settle()
        const find = () =>
            firstUnreadMention(session, channelId, ackedId, myRoles ?? [])
        const first = find()
        if (first.reached) return first.id ? jumpTo(first.id) : settle()
        // A mention in the newest page, in case the window around the marker holds none.
        const later = first.id
        void jumpToMessage(session, channelId, ackedId).then(async result => {
            const found = result === 'loaded' ? find().id : undefined
            if (found) return jumpTo(found)
            if (
                later &&
                (await jumpToMessage(session, channelId, later)) === 'loaded'
            )
                return jumpTo(later)
            // Nothing to show: back to the newest messages, where the chat would have opened.
            await jumpToPresent(session, channelId)
            settle()
        })
    }, [
        session,
        channelId,
        historyReady,
        opening,
        setOpening,
        jumping,
        ackedId,
        myRoles,
        scrollTo,
    ])
    // The jump has settled once the list leaves the bottom, or after the scroll's longest run when the oldest
    // unread message was close enough to the bottom that the list stays there (the user then sees it and it is read).
    const scrolled = opening?.channelId === channelId && opening.scrolled
    useEffect(() => {
        if (opening?.channelId !== channelId || opening.settled) return
        const settle = () => setOpening({ channelId, settled: true })
        if (leftBottom) return settle()
        if (!scrolled) return
        const timer = setTimeout(settle, JUMP_SETTLE_MS)
        return () => clearTimeout(timer)
    }, [channelId, opening, setOpening, leftBottom, scrolled])
}
