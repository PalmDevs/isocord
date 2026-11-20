import { useEffect, useMemo } from 'react'
import { useSession, useSessionStore } from '../../../core/react'
import { channelsStore } from '../../../stores/channels/channels'
import { loadLinkedChannels } from '../../../stores/channels/linkedChannels'
import { threadsStore } from '../../../stores/channels/threads'
import { guildsStore } from '../../../stores/guilds'
import { subscribeToGuild } from '../../../stores/memberList'
import { membersStore, requestMembers } from '../../../stores/members'
import { messagesStore } from '../../../stores/messages/messages'
import { loadMessages } from '../../../stores/messages/messageWindows'
import { relationshipsStore } from '../../../stores/relationships'
import { usersStore } from '../../../stores/users'
import { useForumFirstMessage } from '../../forum/useForumPost'
import { canReact, messageSwipeActions } from '../longPress/actions'
import {
    clearFailedInteractions,
    componentInteractionsStore,
} from '../messageComponents/interactionStore'
import { pollStateStore, refreshPollsAt } from '../polls/pollState'
import { nextPollChange } from '../polls/pollTime'
import { buildRows, hiddenReasonOf } from '../rows/buildRows'
import { encodeRows } from '../rows/rowEncoder'

/** Loads and watches a channel's history, and what its guild needs to show it. */
export function useChatHistory(channelId: string) {
    const session = useSession()
    const channel = useSessionStore(
        channelsStore,
        state => state.channels[channelId],
    )
    const guildId = channel?.guild_id
    const messages = useSessionStore(
        messagesStore,
        state => state.channels[channelId],
    )
    // Cached or pre-reconnect history is shown at once and refreshed in the background.
    const needsLoad = messages === undefined || messages.stale === true
    useEffect(() => {
        if (needsLoad) loadMessages(session, channelId)
    }, [session, channelId, needsLoad])
    // InteractionStore.handleChannelSelect: opening a chat forgets failed interactions.
    useEffect(() => {
        if (channelId) clearFailedInteractions(session)
    }, [session, channelId])
    // Large servers only send live events for guilds the client has subscribed to, per gateway session
    // (GuildSubscriptionsStore.handleChannelSelect). Asked for again after a reconnect with the guild's member lists.
    useEffect(() => {
        if (guildId) subscribeToGuild(session, guildId)
    }, [session, guildId])
    const loadedCount = messages?.messages.length ?? 0
    // History from REST lacks member data, so fetch it.
    useEffect(() => {
        if (!guildId || loadedCount === 0) return
        const loaded =
            session.get(messagesStore).getState().channels[channelId]
                ?.messages ?? []
        requestMembers(
            session,
            guildId,
            loaded.map(message => message.author.id),
        )
    }, [session, channelId, guildId, loadedCount])
    return { channel, messages }
}

type History = ReturnType<typeof useChatHistory>

/** The chat's rows as the JSON the native list takes. */
export function useChatRows({
    channel,
    messages,
    ackedId,
    swipeOpensDetails,
}: History & { ackedId?: string; swipeOpensDetails?: boolean }) {
    const session = useSession()
    const channels = useSessionStore(channelsStore, state => state.channels)
    const guildId = channel?.guild_id
    // Forwards from another server name it in their footer.
    const guilds = useSessionStore(guildsStore, state => state.guilds)
    const guild = useSessionStore(guildsStore, state =>
        guildId ? state.guilds[guildId] : undefined,
    )
    const members = useSessionStore(membersStore, state =>
        guildId ? state.members[guildId] : undefined,
    )
    const users = useSessionStore(usersStore, state => state.users)
    // Thread cards under messages that started a thread.
    const threads = useSessionStore(threadsStore, state => state.active)
    const threadMessages = useSessionStore(
        threadsStore,
        state => state.mostRecent,
    )
    // Answers picked, Show results: the poll rows follow them.
    const polls = useSessionStore(pollStateStore, state => state.polls)
    // Bumped when a poll's time-left label changes or it ends.
    const pollClock = useSessionStore(pollStateStore, state => state.clock)
    // A forum post's first message from the post list, for its action bar before history reaches it.
    const forumPostStarter = useForumFirstMessage(channel?.id ?? '')
    // Messages of blocked and ignored users fold into groups.
    const relationships = useSessionStore(
        relationshipsStore,
        state => state.byId,
    )
    // Buttons and selects waiting on their interaction, failed ones, and select picks.
    const interactions = useSessionStore(
        componentInteractionsStore,
        state => state,
    )
    // Keeps its identity: a JSON string prop of the native view.
    // biome-ignore lint/correctness/useExhaustiveDependencies: pollClock rebuilds the poll rows' time labels.
    const { json, unknownChannels, pollChange } = useMemo(() => {
        const started = __DEV__ ? performance.now() : 0
        const unknownChannels = new Set<string>()
        const json = encodeRows(
            buildRows(messages, {
                session,
                guild,
                guilds,
                members,
                users,
                channels,
                ackedId,
                channel,
                canReact: message => canReact(session, message),
                swipeActions: swipeOpensDetails
                    ? () => undefined
                    : messageSwipeActions(session, channel),
                onUnknownChannel: id => unknownChannels.add(id),
                threads,
                threadMessages,
                polls,
                interactions,
                forumPostStarter,
                hiddenReason: userId => hiddenReasonOf(relationships[userId]),
            }),
        )
        if (__DEV__)
            console.log(
                `[chat] rows: ${json.length} chars in ${Math.round(performance.now() - started)} ms`,
            )
        // The soonest time a shown poll's label changes or it ends.
        const pollChange = Math.min(
            ...(messages?.messages ?? []).map(message =>
                message.poll
                    ? (nextPollChange(message.poll) ?? Infinity)
                    : Infinity,
            ),
        )
        return { json, unknownChannels, pollChange }
    }, [
        messages,
        session,
        guild,
        guilds,
        members,
        users,
        channels,
        ackedId,
        channel,
        swipeOpensDetails,
        threads,
        threadMessages,
        polls,
        pollClock,
        interactions,
        forumPostStarter,
        relationships,
    ])
    useEffect(() => {
        if (Number.isFinite(pollChange)) refreshPollsAt(session, pollChange)
    }, [session, pollChange])
    // A fetched channel lands in the channels store, which rebuilds the rows.
    useEffect(
        () => loadLinkedChannels(session, unknownChannels),
        [session, unknownChannels],
    )
    return json
}
