import { MessageType } from '../../../core/discord/messages'
import { snowflakeTimestamp } from '../../../core/discord/snowflake'
import { t } from '../../../i18n'
import { calendarTimestamp, humanizeDuration } from '../timestamp'
import { authorValues } from './types'
import type { MessageKey } from '../../../i18n'
import type { Message } from '../../../stores/readStates'
import type { SystemEnv, SystemHandlers, SystemParts } from './types'

/** OverlappingCirclesView: 24dp circles, asked for at twice their size. */
const CALL_AVATAR_SIZE = 48

/** Whether the call is still going (useIsCallActive): the API sets `ended_timestamp` when it ends. */
const isActive = (message: Message) =>
    message.call !== undefined && !message.call.ended_timestamp

/** getHumanizedCallDuration: the call's length, or undefined while it has not ended. */
function callDuration(message: Message): string | undefined {
    const ended = message.call?.ended_timestamp
    if (!ended) return undefined
    return humanizeDuration(Date.parse(ended) - snowflakeTimestamp(message.id))
}

/** The user missed the call: it ended without them. */
const isMissed = (message: Message, env: SystemEnv) =>
    !isActive(message) &&
    message.call !== undefined &&
    !message.call.participants.includes(env.userId)

function callTitle(message: Message, env: SystemEnv): MessageKey {
    if (isActive(message)) return 'chat.system.call.ongoing'
    return isMissed(message, env)
        ? 'chat.system.call.missed'
        : 'chat.system.call.ended'
}

/** createCallSystemMessage: the title, the length and time, and the avatars. */
function callParts(message: Message, env: SystemEnv): SystemParts {
    const active = isActive(message)
    const time = calendarTimestamp(new Date(snowflakeTimestamp(message.id)))
    const duration = callDuration(message)
    // An ongoing call shows who is in it. The reference reads them from the call store.
    const people = active
        ? (message.call?.participants ?? []).flatMap(id => env.user(id) ?? [])
        : [message.author]
    return {
        call: {
            active,
            missed: isMissed(message, env),
            description: active
                ? undefined
                : duration
                  ? t('chat.system.call.durationTime', {
                        duration,
                        timestamp: time,
                    })
                  : time,
            avatarUrls: people.map(user =>
                env.avatarUrl(user, CALL_AVATAR_SIZE),
            ),
        },
    }
}

/** VOICE_SESSION_HANGOUT_KEYS by the number of people named before "others". */
const HANGOUT_KEYS: Record<number, MessageKey> = {
    1: 'chat.system.voiceSession.1',
    2: 'chat.system.voiceSession.2',
    3: 'chat.system.voiceSession.3',
}

/** createVoiceSessionSystemMessage: the author, then up to two others (getSortedVoiceSessionParticipants). */
function voiceSessionContent(message: Message, env: SystemEnv) {
    const duration = callDuration(message)
    if (!duration)
        return {
            key: 'chat.system.voiceSession.started' as const,
            values: authorValues(message, env),
        }
    const others = (message.call?.participants ?? []).flatMap(id => {
        const user = env.user(id)
        return user && user.id !== message.author.id ? [user] : []
    })
    const [second, third] = others
    return {
        key:
            HANGOUT_KEYS[others.length + 1] ??
            ('chat.system.voiceSession.other' as const),
        values: {
            ...authorValues(message, env),
            ...(second && {
                username2: env.name(second),
                username2OnClick: env.userLink(second),
            }),
            ...(third && {
                username3: env.name(third),
                username3OnClick: env.userLink(third),
            }),
            otherCount: others.length - 1,
            duration,
        },
    }
}

/** Calls in DMs, and voice hangouts. */
export const callHandlers: SystemHandlers = {
    // createCallSystemMessage, drawn by CallSystemMessageView. The row's text is the title.
    [MessageType.CALL]: {
        icon: 'voice',
        tint: 'normal',
        content: (message, env) => ({
            key: callTitle(message, env),
            values: {},
        }),
        parts: callParts,
    },
    // createVoiceSessionSystemMessage.
    [MessageType.VOICE_SESSION]: {
        icon: 'voice',
        tint: 'positive',
        content: voiceSessionContent,
    },
}
