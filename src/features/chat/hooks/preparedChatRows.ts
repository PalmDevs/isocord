import { traced } from '../../../core/trace'
import { channelsStore } from '../../../stores/channels/channels'
import { threadsStore } from '../../../stores/channels/threads'
import { forumPostsStore } from '../../../stores/forumPosts'
import { guildsStore } from '../../../stores/guilds'
import { membersStore } from '../../../stores/members'
import { messagesStore, PAGE_SIZE } from '../../../stores/messages/messages'
import { readStatesStore } from '../../../stores/readStates'
import { relationshipsStore } from '../../../stores/relationships'
import { usersStore } from '../../../stores/users'
import { canReact, messageSwipeActions } from '../longPress/actions'
import { componentInteractionsStore } from '../messageComponents/interactionStore'
import { pollStateStore } from '../polls/pollState'
import { nextPollChange } from '../polls/pollTime'
import {
    buildRows,
    buildRowsIncrementally,
    hiddenReasonOf,
} from '../rows/buildRows'
import { encodeRows } from '../rows/rowEncoder'
import type { Session } from '../../../core/session'
import type { ChannelMessages } from '../../../stores/messages/messageTypes'
import type { Relationship } from '../../../stores/relationships'
import type { RowContext } from '../rows/buildRows'

export interface ChatRowInputs
    extends Pick<
        RowContext,
        | 'session'
        | 'channel'
        | 'ackedId'
        | 'channels'
        | 'guild'
        | 'guilds'
        | 'members'
        | 'users'
        | 'threads'
        | 'threadMessages'
        | 'polls'
        | 'interactions'
        | 'forumPostStarter'
    > {
    messages: ChannelMessages | undefined
    swipeOpensDetails: boolean | undefined
    /** Bumped when a poll's time-left label changes or it ends. */
    pollClock: number
    relationships: Record<string, Relationship>
}

/** Spare JS time held for input and frame work. */
const IDLE_ROW_MARGIN_MS = 3

function rowContext(
    inputs: ChatRowInputs,
    unknownChannels: Set<string>,
): RowContext {
    const { session, channel, swipeOpensDetails, relationships } = inputs
    return {
        ...inputs,
        canReact: message => canReact(session, message),
        swipeActions: swipeOpensDetails
            ? undefined
            : messageSwipeActions(session, channel),
        onUnknownChannel: id => unknownChannels.add(id),
        hiddenReason: userId => hiddenReasonOf(relationships[userId]),
    }
}

/** Encodes the chat's rows. Message rows built before, by the chat or `prepareChatRows`, are reused. */
export function chatRowsFor(inputs: ChatRowInputs) {
    return traced('js:chat:build-rows', () => {
        const unknownChannels = new Set<string>()
        const json = encodeRows(
            buildRows(inputs.messages, rowContext(inputs, unknownChannels)),
        )
        // The soonest time a shown poll's label changes or it ends.
        const pollChange = Math.min(
            ...(inputs.messages?.messages ?? []).map(message =>
                message.poll
                    ? (nextPollChange(message.poll) ?? Infinity)
                    : Infinity,
            ),
        )
        return { json, unknownChannels, pollChange }
    })
}

function readInputs(
    session: Session,
    channelId: string,
    swipeOpensDetails: boolean,
): ChatRowInputs {
    const { channels } = session.get(channelsStore).getState()
    const { guilds } = session.get(guildsStore).getState()
    const channel = channels[channelId]
    const guildId = channel?.guild_id
    const { active, mostRecent } = session.get(threadsStore).getState()
    const { polls, clock } = session.get(pollStateStore).getState()
    return {
        session,
        channel,
        messages: session.get(messagesStore).getState().channels[channelId],
        ackedId: session.get(readStatesStore).getState().acks[channelId],
        swipeOpensDetails,
        channels,
        guilds,
        guild: guildId ? guilds[guildId] : undefined,
        members: guildId
            ? session.get(membersStore).getState().members[guildId]
            : undefined,
        users: session.get(usersStore).getState().users,
        threads: active,
        threadMessages: mostRecent,
        polls,
        pollClock: clock,
        interactions: session.get(componentInteractionsStore).getState(),
        forumPostStarter: session.get(forumPostsStore).getState().firstMessages[
            channelId
        ],
        relationships: session.get(relationshipsStore).getState().byId,
    }
}

/**
 * Builds the selected channel's message rows during idle slices. Opening the chat then reuses them and rebuilds
 * only rows whose data changed since.
 */
export function prepareChatRows(
    session: Session,
    channelId: string,
    swipeOpensDetails: boolean,
): () => void {
    let idle: number | undefined
    let work: ReturnType<typeof buildRowsIncrementally> | undefined
    let built: ChannelMessages | undefined
    function schedule() {
        idle ??= requestIdleCallback(run)
    }
    function run(deadline: IdleDeadline) {
        idle = undefined
        if (deadline.timeRemaining() <= IDLE_ROW_MARGIN_MS) {
            schedule()
            return
        }
        if (!work) {
            const inputs = readInputs(session, channelId, swipeOpensDetails)
            const count = inputs.messages?.messages.length ?? 0
            if (
                !inputs.channel ||
                count === 0 ||
                count > PAGE_SIZE ||
                inputs.messages === built
            )
                return
            built = inputs.messages
            work = buildRowsIncrementally(
                inputs.messages,
                rowContext(inputs, new Set()),
            )
        }
        const generator = work
        const done = traced('js:chat:prepare-rows', () => {
            let step = generator.next()
            while (!step.done && deadline.timeRemaining() > IDLE_ROW_MARGIN_MS)
                step = generator.next()
            return step.done
        })
        if (done) work = undefined
        // Continues the build, or catches history that changed during it.
        schedule()
    }
    schedule()
    // History can arrive, or change, before the first gesture.
    const unsubscribe = session.get(messagesStore).subscribe(schedule)
    return () => {
        if (idle !== undefined) cancelIdleCallback(idle)
        unsubscribe()
    }
}
