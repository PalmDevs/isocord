import { createStore } from 'zustand/vanilla'
import { Endpoint } from '../core/api/paths'
import { ApiError } from '../core/api/rest'
import { ChannelType } from '../core/discord/channelType'
import { RelationshipType } from '../core/discord/relationships'
import { useSessionStore } from '../core/react'
import { defineStore } from '../core/session'
import { channelsStore } from './channels/channels'
import type { Session } from '../core/session'
import type { Channel } from './channels/channels'

export interface Relationship {
    id: string
    type: number
    /** Whether the current user ignores the user (`user_ignored`). */
    user_ignored?: boolean
}

declare module '../core/gateway/events' {
    interface GatewayEvents {
        RELATIONSHIP_ADD: Relationship
        RELATIONSHIP_UPDATE: Relationship
        RELATIONSHIP_REMOVE: Relationship
    }
    interface ReadyPayload {
        relationships?: Relationship[]
    }
}

interface RelationshipsState {
    byId: Record<string, Relationship>
}

/** Relationships of the current user, from READY and RELATIONSHIP_ADD, _UPDATE and _REMOVE. */
export const relationshipsStore = defineStore('relationships', session => {
    const store = createStore<RelationshipsState>(() => ({ byId: {} }))
    const { dispatch } = session.gateway
    const put = (relationship: Relationship) =>
        store.setState(state => ({
            byId: { ...state.byId, [relationship.id]: relationship },
        }))

    dispatch.on('READY', ready =>
        store.setState({
            byId: Object.fromEntries(
                (ready.relationships ?? []).map(r => [r.id, r]),
            ),
        }),
    )
    dispatch.on('RELATIONSHIP_ADD', put)
    dispatch.on('RELATIONSHIP_UPDATE', put)
    dispatch.on('RELATIONSHIP_REMOVE', payload =>
        store.setState(state => {
            const { [payload.id]: _removed, ...byId } = state.byId
            return { byId }
        }),
    )

    return store
})

/** RelationshipStore.isBlockedOrIgnored: whether the relationship hides a user's messages. */
export const isBlockedOrIgnored = (
    relationship: Relationship | undefined,
): boolean =>
    relationship?.type === RelationshipType.BLOCKED ||
    relationship?.user_ignored === true

/** Returns the relationship type with a user (RelationshipType), undefined when there is none. */
export const useRelationshipType = (userId: string): number | undefined =>
    useSessionStore(relationshipsStore, state => state.byId[userId]?.type)

/** Returns whether the current user ignores a user. */
export const useIsIgnored = (userId: string): boolean =>
    useSessionStore(
        relationshipsStore,
        state => state.byId[userId]?.user_ignored === true,
    )

/** RelationshipActionCreators.blockUser: the gateway then reports the new relationship. */
export const blockUser = (session: Session, userId: string): Promise<void> =>
    session.rest.put(Endpoint.userRelationship(userId), {
        body: { type: RelationshipType.BLOCKED },
    })

/** RelationshipActionCreators.unblockUser (removeRelationship). */
export const unblockUser = (session: Session, userId: string): Promise<void> =>
    session.rest.delete(Endpoint.userRelationship(userId))

/** RelationshipActionCreators.ignoreUser. */
export const ignoreUser = (session: Session, userId: string): Promise<void> =>
    session.rest.put(Endpoint.ignoreUser(userId))

/** RelationshipActionCreators.unignoreUser. */
export const unignoreUser = (session: Session, userId: string): Promise<void> =>
    session.rest.delete(Endpoint.ignoreUser(userId))

const HTTP_NOT_FOUND = 404

/** Returns the current user's note about a user, '' when there is none. */
export async function fetchNote(
    session: Session,
    userId: string,
): Promise<string> {
    try {
        const { note } = await session.rest.get<{ note?: string }>(
            Endpoint.userNote(userId),
        )
        return note ?? ''
    } catch (error) {
        if (error instanceof ApiError && error.status === HTTP_NOT_FOUND)
            return ''
        throw error
    }
}

/** NoteActionCreators.updateNote. */
export const saveNote = (
    session: Session,
    userId: string,
    note: string,
): Promise<void> =>
    session.rest.put(Endpoint.userNote(userId), { body: { note } })

/** RelationshipActionCreators.sendRequest: a PUT with no type adds a friend or accepts an incoming request. */
export const sendFriendRequest = (
    session: Session,
    userId: string,
): Promise<void> =>
    session.rest.put(Endpoint.userRelationship(userId), { body: {} })

/** RelationshipActionCreators.removeRelationship: unfriends or cancels a request. */
export const removeFriend = unblockUser

/** Returns the id of the DM with a user, creating it when none is known (`openPrivateChannel`). */
export async function openDmChannel(
    session: Session,
    userId: string,
): Promise<string> {
    const existing = Object.values(
        session.get(channelsStore).getState().channels,
    ).find(
        channel =>
            channel.type === ChannelType.DM &&
            channel.recipient_ids?.[0] === userId,
    )
    if (existing) return existing.id
    const channel = await session.rest.post<Channel>(Endpoint.myChannels, {
        body: { recipient_id: userId },
        retries: 3,
    })
    session.gateway.dispatch.emit('CHANNEL_CREATE', channel)
    return channel.id
}
