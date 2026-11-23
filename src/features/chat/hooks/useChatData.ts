import { useEffect, useMemo } from 'react'
import {
    useSession,
    useSessionReady,
    useSessionStore,
} from '../../../core/react'
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
import {
    clearFailedInteractions,
    componentInteractionsStore,
} from '../messageComponents/interactionStore'
import { pollStateStore, refreshPollsAt } from '../polls/pollState'
import { chatRowsFor, prepareChatRows } from './preparedChatRows'

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

/** Schedules data-only work for the selected chat while the list is active. */
export function usePrepareChatRows(
    channelId: string | undefined,
    swipeOpensDetails: boolean,
) {
    const session = useSession()
    const ready = useSessionReady()
    // MainTabsNavigatorPanel: selected background channel preload.
    useEffect(() => {
        if (!ready || !channelId) return
        return prepareChatRows(session, channelId, swipeOpensDetails)
    }, [session, ready, channelId, swipeOpensDetails])
}

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
    // A change elsewhere in these maps rebuilds cheaply: unchanged message rows are reused (rowMemo).
    const { json, unknownChannels, pollChange } = useMemo(
        () =>
            chatRowsFor({
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
            }),
        [
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
        ],
    )
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
