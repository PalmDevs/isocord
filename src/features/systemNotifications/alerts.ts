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
declare module '../../core/gateway/events' {
    interface GatewayEvents {
        CALL_CREATE: CallEvent
        CALL_UPDATE: CallEvent
        CALL_DELETE: CallEvent
        GUILD_SCHEDULED_EVENT_UPDATE: ScheduledEvent
    }
}

const CALL_EVENTS = ['CALL_CREATE', 'CALL_UPDATE', 'CALL_DELETE'] as const
const RELATIONSHIP_EVENTS = [
    'RELATIONSHIP_ADD',
    'RELATIONSHIP_UPDATE',
    'RELATIONSHIP_REMOVE',
] as const

/** Forwards a session's alert dispatches. Returns the cleanup. */
export function forwardAlerts(session: Session): () => void {
    const { dispatch } = session.gateway
    const offs = [
        // Only the relationships, to tell an accepted request (ReadyRelationships in AppSession.kt).
        dispatch.on('READY', ready =>
            forward(
                session,
                'READY',
                { relationships: ready.relationships ?? [] },
                {},
            ),
        ),
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
    ]
    return () => {
        for (const off of offs) off()
    }
}
