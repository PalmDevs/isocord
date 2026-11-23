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
    pollClock: number
    relationships: Record<string, Relationship>
}

interface EncodedChatRows {
    json: string
    unknownChannels: Set<string>
    pollChange: number
}

interface PreparedChatRows {
    inputs: ChatRowInputs
    rows: EncodedChatRows
    day: string
}

/** Spare JS time held for input and frame work. */
const IDLE_ROW_MARGIN_MS = 3
/** Timestamp mentions can show relative text. */
const TIMESTAMP_SPAN = '"timestamp":true'
const prepared = new WeakMap<Session, PreparedChatRows>()

function expired(cached: PreparedChatRows): 'day' | 'poll' | undefined {
    if (cached.day !== new Date().toDateString()) return 'day'
    if (Date.now() >= cached.rows.pollChange) return 'poll'
}

function firstChangedInput(previous: ChatRowInputs, current: ChatRowInputs) {
    for (const key in current) {
        const field = key as keyof ChatRowInputs
        if (previous[field] !== current[field]) return field
    }
}

function rowBuild(inputs: ChatRowInputs) {
    const { session, channel, swipeOpensDetails, relationships, messages } =
        inputs
    const unknownChannels = new Set<string>()
    const context: RowContext = {
        ...inputs,
        canReact: message => canReact(session, message),
        swipeActions: swipeOpensDetails
            ? undefined
            : messageSwipeActions(session, channel),
        onUnknownChannel: id => unknownChannels.add(id),
        hiddenReason: userId => hiddenReasonOf(relationships[userId]),
    }
    const pollChange = Math.min(
        ...(messages?.messages ?? []).map(message =>
            message.poll
                ? (nextPollChange(message.poll) ?? Infinity)
                : Infinity,
        ),
    )
    return { context, unknownChannels, pollChange }
}

/** Encodes a live window, reusing the prepared payload while its inputs match. */
export function chatRowsFor(inputs: ChatRowInputs): EncodedChatRows {
    const cached = prepared.get(inputs.session)
    if (cached && cached.inputs.channel?.id === inputs.channel?.id) {
        const miss = firstChangedInput(cached.inputs, inputs) ?? expired(cached)
        if (!miss) return traced('js:chat:prepared-rows-hit', () => cached.rows)
        traced(`js:chat:prepared-rows-miss-${miss}`, () => undefined)
    } else {
        traced('js:chat:prepared-rows-miss-no-candidate', () => undefined)
    }

    return traced('js:chat:build-rows', () => {
        const { context, unknownChannels, pollChange } = rowBuild(inputs)
        const json = encodeRows(buildRows(inputs.messages, context))
        return { json, unknownChannels, pollChange }
    })
}

/** Releases the prepared payload after the opening chat commits. */
export function releasePreparedChatRows(session: Session, channelId?: string) {
    if (prepared.get(session)?.inputs.channel?.id === channelId)
        prepared.delete(session)
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

function startBuild(inputs: ChatRowInputs, day: string) {
    const { context, unknownChannels, pollChange } = rowBuild(inputs)
    const iterator = buildRowsIncrementally(inputs.messages, context)
    return { inputs, day, iterator, unknownChannels, pollChange }
}

/** Prepares one cached page for the selected channel during idle slices. */
export function prepareChatRows(
    session: Session,
    channelId: string,
    swipeOpensDetails: boolean,
): () => void {
    if (prepared.get(session)?.inputs.channel?.id !== channelId)
        prepared.delete(session)
    let idle: number | undefined
    let work: ReturnType<typeof startBuild> | undefined
    let rejectedTimestamps: ChannelMessages | undefined
    function schedule() {
        idle ??= requestIdleCallback(run)
    }
    function run(deadline: IdleDeadline) {
        idle = undefined
        if (deadline.timeRemaining() <= IDLE_ROW_MARGIN_MS) {
            schedule()
            return
        }
        const inputs = readInputs(session, channelId, swipeOpensDetails)
        const count = inputs.messages?.messages.length ?? 0
        if (
            !inputs.channel ||
            count === 0 ||
            count > PAGE_SIZE ||
            inputs.messages === rejectedTimestamps
        )
            return
        const cached = prepared.get(session)
        if (
            cached &&
            !firstChangedInput(cached.inputs, inputs) &&
            !expired(cached)
        )
            return
        const day = new Date().toDateString()
        if (!work || work.day !== day || firstChangedInput(work.inputs, inputs))
            work = startBuild(inputs, day)
        const { iterator, unknownChannels, pollChange } = work
        const rows = traced('js:chat:prepare-rows', () => {
            let step = iterator.next()
            while (!step.done && deadline.timeRemaining() > IDLE_ROW_MARGIN_MS)
                step = iterator.next()
            return step.done ? step.value : undefined
        })
        if (rows === undefined) {
            schedule()
            return
        }
        work = undefined
        // Encoding in its own idle slice after the last message.
        idle = requestIdleCallback(function encode(deadline) {
            idle = undefined
            if (deadline.timeRemaining() <= IDLE_ROW_MARGIN_MS) {
                idle = requestIdleCallback(encode)
                return
            }
            const changed = firstChangedInput(
                inputs,
                readInputs(session, channelId, swipeOpensDetails),
            )
            if (changed) {
                traced(
                    `js:chat:prepare-invalidated-${changed}`,
                    () => undefined,
                )
                schedule()
                return
            }
            const json = traced('js:chat:prepare-encode', () =>
                encodeRows(rows),
            )
            if (json.includes(TIMESTAMP_SPAN)) {
                rejectedTimestamps = inputs.messages
                traced('js:chat:prepare-timestamp-mention', () => undefined)
            } else {
                prepared.set(session, {
                    inputs,
                    rows: { json, unknownChannels, pollChange },
                    day,
                })
                traced('js:chat:prepare-cached', () => undefined)
            }
        })
    }
    schedule()
    // A live update can invalidate a candidate before the first gesture.
    const unsubscribes = [
        session.get(channelsStore).subscribe(schedule),
        session.get(threadsStore).subscribe(schedule),
        session.get(forumPostsStore).subscribe(schedule),
        session.get(guildsStore).subscribe(schedule),
        session.get(membersStore).subscribe(schedule),
        session.get(messagesStore).subscribe(schedule),
        session.get(readStatesStore).subscribe(schedule),
        session.get(relationshipsStore).subscribe(schedule),
        session.get(usersStore).subscribe(schedule),
        session.get(componentInteractionsStore).subscribe(schedule),
        session.get(pollStateStore).subscribe(schedule),
    ]
    return () => {
        if (idle !== undefined) cancelIdleCallback(idle)
        for (const unsubscribe of unsubscribes) unsubscribe()
        // The opening chat can consume the candidate after preparation stops.
    }
}
