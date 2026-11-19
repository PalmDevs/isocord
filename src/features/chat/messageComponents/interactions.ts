import { Endpoint } from '../../../core/api/paths'
import { ApiError } from '../../../core/api/rest'
import { InteractionType } from '../../../core/discord/components'
import { snowflakeFromTimestamp } from '../../../core/discord/snowflake'
import { logger } from '../../../core/log'
import { channelsStore } from '../../../stores/channels/channels'
import {
    canQueueInteraction,
    failInteraction,
    queueInteraction,
} from './interactionStore'
import type { Session } from '../../../core/session'
import type { RichMessage } from '../rows/rich'
import type { SelectOption } from './selectOptions'

const log = logger('Interactions')

/** executeMessageComponentInteraction's request timeout. A request still open then fails the interaction. */
const REQUEST_TIMEOUT_MS = 3000

interface ComponentPress {
    message: RichMessage
    componentId: string
    componentType: number
    customId: string
    /** Selects: the options picked, sent as `values`. */
    picked?: SelectOption[]
}

/**
 * executeMessageComponentInteraction: queues the interaction, then POST /interactions. The gateway's
 * INTERACTION_SUCCESS, INTERACTION_FAILURE or a message with the nonce ends it (interactionStore.ts). Does nothing
 * while another interaction of the message runs.
 */
export async function executeComponentInteraction(
    session: Session,
    { message, componentId, componentType, customId, picked }: ComponentPress,
): Promise<void> {
    if (!canQueueInteraction(session, message.id)) return
    const nonce = snowflakeFromTimestamp(Date.now())
    queueInteraction(
        session,
        message.id,
        { nonce, componentId, phase: 'queued' },
        picked,
    )
    const sessionId = session.gateway.currentSessionId
    // Before READY there is no session to answer: fails here rather than sending session_id null.
    if (!sessionId) {
        failInteraction(session, nonce, {})
        return
    }
    const channel = session.get(channelsStore).getState().channels[
        message.channel_id
    ]
    const timeout = new AbortController()
    const timer = setTimeout(() => timeout.abort(), REQUEST_TIMEOUT_MS)
    try {
        await session.rest.post(Endpoint.interactions, {
            signal: timeout.signal,
            body: {
                type: InteractionType.MESSAGE_COMPONENT,
                nonce,
                guild_id: channel?.guild_id ?? message.guild_id,
                channel_id: message.channel_id,
                message_flags: message.flags ?? 0,
                message_id: message.id,
                // A message from an application's webhook names it; a bot's own message is the bot.
                application_id: message.application_id ?? message.author.id,
                session_id: sessionId,
                data: {
                    component_type: componentType,
                    custom_id: customId,
                    // mapMessageComponentLocalStateForAPI.
                    ...(picked && {
                        type: componentType,
                        values: picked.map(option => option.value),
                    }),
                },
            },
        })
    } catch (error) {
        // handleInteractionResponse: a rejected or timed out request fails the interaction with its code.
        log.warn(`Interaction failed: ${String(error)}`)
        failInteraction(session, nonce, {
            // A rate limit's body has no JSON code: its status is kept instead.
            errorCode:
                error instanceof ApiError
                    ? error.code || error.status
                    : undefined,
        })
    } finally {
        clearTimeout(timer)
    }
}
