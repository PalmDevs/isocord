import { createStore } from 'zustand/vanilla'
import { defineStore } from '../../../core/session'
import type { Session } from '../../../core/session'
import type { SelectOption } from './selectOptions'

/** InteractionState: sent, acknowledged by the gateway, or failed. */
export type InteractionPhase = 'queued' | 'created' | 'failed'

/** A component interaction of one message (InteractionStore's entry, MESSAGE_COMPONENT only). */
export interface ComponentInteraction {
    nonce: string
    /** The component's id (see `childPath`). */
    componentId: string
    phase: InteractionPhase
    /** The JSON error code or HTTP status of a failed request. */
    errorCode?: number
    /** INTERACTION_FAILURE's reason_code (InteractionFailureReason). */
    reasonCode?: number
}

export interface ComponentInteractions {
    /** By message id. One at a time per message, as canQueueInteraction allows. */
    byMessage: Record<string, ComponentInteraction>
    /**
     * LocalInteractionComponentStateStore: the options picked in a select, by message, then component id. Kept
     * until the message changes, so the select shows the pick while the bot answers.
     */
    selections: Record<string, Record<string, SelectOption[]>>
}

declare module '../../../core/gateway/events' {
    interface GatewayEvents {
        INTERACTION_CREATE: { id: string; nonce?: string }
        INTERACTION_SUCCESS: { id: string; nonce?: string }
        INTERACTION_FAILURE: {
            id: string
            nonce?: string
            reason_code?: number
        }
    }
}

/** Returns the message whose interaction has `nonce`. */
const messageOf = (state: ComponentInteractions, nonce: string) =>
    Object.keys(state.byMessage).find(
        id => state.byMessage[id]?.nonce === nonce,
    )

function without<T>(record: Record<string, T>, key: string) {
    const { [key]: _dropped, ...rest } = record
    return rest
}

/**
 * The session's component interactions (InteractionStore and LocalInteractionComponentStateStore). Not cached: a
 * restart forgets interactions on their way.
 */
export const componentInteractionsStore = defineStore(
    'componentInteractions',
    session => {
        const store = createStore<ComponentInteractions>(() => ({
            byMessage: {},
            selections: {},
        }))
        const { dispatch } = session.gateway
        const finish = (nonce: string | undefined) => {
            const messageId = nonce && messageOf(store.getState(), nonce)
            if (messageId)
                store.setState(state => ({
                    byMessage: without(state.byMessage, messageId),
                }))
        }
        dispatch.on('INTERACTION_CREATE', ({ nonce }) => {
            const messageId = nonce && messageOf(store.getState(), nonce)
            if (messageId) setPhase(session, messageId, 'created')
        })
        dispatch.on('INTERACTION_SUCCESS', ({ nonce }) => finish(nonce))
        // A response message with the nonce also ends it (InteractionStore.handleMessageCreate).
        dispatch.on('MESSAGE_CREATE', message =>
            finish(message.nonce?.toString()),
        )
        dispatch.on('INTERACTION_FAILURE', ({ nonce, reason_code }) => {
            if (nonce)
                failInteraction(session, nonce, { reasonCode: reason_code })
        })
        // The bot changed the message: its components say what is picked now.
        dispatch.on('MESSAGE_UPDATE', ({ id }) => {
            if (store.getState().selections[id])
                store.setState(state => ({
                    selections: without(state.selections, id),
                }))
        })
        dispatch.on('MESSAGE_DELETE', ({ id }) =>
            store.setState(state => ({
                byMessage: without(state.byMessage, id),
                selections: without(state.selections, id),
            })),
        )
        return store
    },
)

/** Returns whether the message has no interaction running (canQueueInteraction). */
export function canQueueInteraction(session: Session, messageId: string) {
    const running = session.get(componentInteractionsStore).getState()
        .byMessage[messageId]
    return !running || running.phase === 'failed'
}

/** INTERACTION_QUEUE and QUEUE_INTERACTION_COMPONENT_STATE: a new interaction, with the options picked. */
export function queueInteraction(
    session: Session,
    messageId: string,
    interaction: ComponentInteraction,
    picked: SelectOption[] | undefined,
) {
    session.get(componentInteractionsStore).setState(state => ({
        byMessage: { ...state.byMessage, [messageId]: interaction },
        selections: picked
            ? {
                  ...state.selections,
                  [messageId]: {
                      ...state.selections[messageId],
                      [interaction.componentId]: picked,
                  },
              }
            : state.selections,
    }))
}

function setPhase(
    session: Session,
    messageId: string,
    phase: InteractionPhase,
) {
    session.get(componentInteractionsStore).setState(state => {
        const interaction = state.byMessage[messageId]
        return interaction
            ? {
                  byMessage: {
                      ...state.byMessage,
                      [messageId]: { ...interaction, phase },
                  },
              }
            : state
    })
}

/** INTERACTION_FAILURE: marks it failed, and drops what its select picked. */
export function failInteraction(
    session: Session,
    nonce: string,
    reason: { errorCode?: number; reasonCode?: number },
) {
    const store = session.get(componentInteractionsStore)
    const messageId = messageOf(store.getState(), nonce)
    if (!messageId) return
    store.setState(state => {
        const interaction = state.byMessage[messageId]
        if (!interaction) return state
        const picked = state.selections[messageId] ?? {}
        return {
            byMessage: {
                ...state.byMessage,
                [messageId]: { ...interaction, ...reason, phase: 'failed' },
            },
            selections: {
                ...state.selections,
                [messageId]: without(picked, interaction.componentId),
            },
        }
    })
}

/** InteractionStore.handleChannelSelect: failed interactions are forgotten when a chat opens. */
export function clearFailedInteractions(session: Session) {
    const store = session.get(componentInteractionsStore)
    const failed = Object.keys(store.getState().byMessage).filter(
        id => store.getState().byMessage[id]?.phase === 'failed',
    )
    if (failed.length)
        store.setState(state => ({
            byMessage: Object.fromEntries(
                Object.entries(state.byMessage).filter(
                    ([id]) => !failed.includes(id),
                ),
            ),
        }))
}
