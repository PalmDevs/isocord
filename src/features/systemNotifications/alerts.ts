import { THREADS_ONLY_CHANNEL_TYPES } from '../../core/discord/channelType'
import { channelsStore } from '../../stores/channels/channels'
import { subscribeToGuildThreads } from '../../stores/memberList'
import { forward } from './forward'
import type { Session } from '../../core/session'

// What the app's session hears besides messages, forwarded while in front: calls, friend requests, reactions, forum
// posts and events. The native side alerts about them as the background session would (SessionNotifier.kt).

interface CallEvent {
    channel_id: string
    voice_states?: Array<{ user_id: string }>
}
interface ScheduledEvent {
    guild_id: string
}
interface ScheduledEventUser {
    guild_scheduled_event_id: string
    user_id: string
    guild_id?: string
}
declare module '../../core/gateway/events' {
    interface GatewayEvents {
        CALL_CREATE: CallEvent
        CALL_UPDATE: CallEvent
        CALL_DELETE: CallEvent
        GUILD_SCHEDULED_EVENT_UPDATE: ScheduledEvent
        GUILD_SCHEDULED_EVENT_USER_ADD: ScheduledEventUser
        GUILD_SCHEDULED_EVENT_USER_REMOVE: ScheduledEventUser
    }
}

const CALL_EVENTS = ['CALL_CREATE', 'CALL_UPDATE', 'CALL_DELETE'] as const
const RELATIONSHIP_EVENTS = [
    'RELATIONSHIP_ADD',
    'RELATIONSHIP_UPDATE',
    'RELATIONSHIP_REMOVE',
] as const
const EVENT_USER_EVENTS = [
    'GUILD_SCHEDULED_EVENT_USER_ADD',
    'GUILD_SCHEDULED_EVENT_USER_REMOVE',
] as const

function subscribeForumGuilds(session: Session): void {
    const channels = session.get(channelsStore).getState().channels
    for (const channel of Object.values(channels)) {
        if (channel.guild_id && THREADS_ONLY_CHANNEL_TYPES.has(channel.type)) {
            subscribeToGuildThreads(session, channel.guild_id)
        }
    }
}

/** Forwards a session's alert dispatches. Returns the cleanup. */
export function forwardAlerts(session: Session): () => void {
    const { dispatch } = session.gateway
    subscribeForumGuilds(session)
    const offs = [
        // Only the relationships, to tell an accepted request (ReadyRelationships in AppSession.kt).
        dispatch.on('READY', ready => {
            for (const guild of ready.guilds ?? []) {
                if (
                    guild.channels?.some(channel =>
                        THREADS_ONLY_CHANNEL_TYPES.has(channel.type),
                    )
                ) {
                    subscribeToGuildThreads(session, guild.id)
                }
            }
            return forward(
                session,
                'READY',
                { relationships: ready.relationships ?? [] },
                {},
            )
        }),
        dispatch.on('GUILD_CREATE', guild => {
            if (
                guild.channels?.some(channel =>
                    THREADS_ONLY_CHANNEL_TYPES.has(channel.type),
                )
            ) {
                subscribeToGuildThreads(session, guild.id)
            }
        }),
        dispatch.on('CHANNEL_CREATE', channel => {
            if (
                channel.guild_id &&
                THREADS_ONLY_CHANNEL_TYPES.has(channel.type)
            ) {
                subscribeToGuildThreads(session, channel.guild_id)
            }
        }),
        ...CALL_EVENTS.map(type =>
            dispatch.on(type, call =>
                forward(session, type, call, {
                    channelId: call.channel_id,
                    userIds: call.voice_states?.map(state => state.user_id),
                }),
            ),
        ),
        ...RELATIONSHIP_EVENTS.map(type =>
            dispatch.on(type, relationship =>
                forward(session, type, relationship, {
                    userIds: [relationship.id],
                }),
            ),
        ),
        dispatch.on('MESSAGE_REACTION_ADD', reaction =>
            forward(session, 'MESSAGE_REACTION_ADD', reaction, {
                channelId: reaction.channel_id,
                userIds: [reaction.user_id],
            }),
        ),
        // The forum is the place: the thread is new to the stores' lookups.
        dispatch.on('THREAD_CREATE', thread =>
            forward(session, 'THREAD_CREATE', thread, {
                channelId: thread.parent_id,
            }),
        ),
        dispatch.on('GUILD_SCHEDULED_EVENT_UPDATE', event =>
            forward(session, 'GUILD_SCHEDULED_EVENT_UPDATE', event, {
                guildId: event.guild_id,
            }),
        ),
        ...EVENT_USER_EVENTS.map(type =>
            dispatch.on(type, event =>
                forward(session, type, event, {
                    guildId: event.guild_id,
                }),
            ),
        ),
    ]
    return () => {
        for (const off of offs) off()
    }
}
