import { MessageType } from '../../../core/discord/messages'
import { avatarUrl } from '../../../design/components/avatars/avatarUrl'
import { t } from '../../../i18n'
import { displayName } from '../../../stores/users'
import { chatLink } from '../links/chatLink'
import { automodHandlers } from './automod'
import { boostHandlers } from './boosts'
import { callHandlers } from './calls'
import { channelHandlers } from './channel'
import { systemPlain, systemSpans } from './format'
import { guildHandlers } from './guild'
import { memberHandlers } from './members'
import { pinHandlers } from './pins'
import { pollHandlers } from './polls'
import { purchaseHandlers } from './purchases'
import { stageHandlers } from './stage'
import { threadHandlers } from './threads'
import type { Message } from '../../../stores/readStates'
import type { ReactionRow, SystemRow, ThreadEmbedRow } from '../rows/rows'
import type { SystemEnv, SystemHandler } from './types'

export type { SystemEnv } from './types'

/**
 * The system messages drawn as system rows (createSystemMessageContent), one domain per file. A type without a
 * handler is drawn as an ordinary message with its content.
 */
const HANDLERS: Partial<Record<number, SystemHandler>> = {
    ...memberHandlers,
    ...channelHandlers,
    ...pinHandlers,
    ...boostHandlers,
    ...threadHandlers,
    ...callHandlers,
    ...pollHandlers,
    ...automodHandlers,
    ...stageHandlers,
    ...guildHandlers,
    ...purchaseHandlers,
}

/** What the system row takes from the ordinary message row: the time, the reactions and the thread card. */
interface RowCommon {
    timestamp: string
    reactions: ReactionRow[]
    addReaction: boolean
    thread?: ThreadEmbedRow
}

/** Returns the system row of a message, or undefined when its type has no handler. */
export function systemRow(
    message: Message,
    env: SystemEnv,
    common: RowCommon,
): SystemRow | undefined {
    const handler = HANDLERS[message.type ?? MessageType.DEFAULT]
    const content = handler?.content(message, env)
    if (!handler || !content) return undefined
    const { thread, ...shared } = common
    return {
        type: 'system',
        key: message.id,
        id: message.id,
        icon: handler.icon,
        tint: handler.tint,
        content: systemSpans(content),
        ...shared,
        ...handler.parts?.(message, env),
        // createMessageContent gives only a new thread's message its thread card.
        ...(message.type === MessageType.THREAD_CREATED && { thread }),
        ...(content.wave && {
            waveLabel: t('chat.system.wave'),
            waveUrl: chatLink.wave(message.id),
        }),
    }
}

/** A preview knows only the message: global names, no channels or server. */
const PLAIN_ENV: SystemEnv = {
    name: displayName,
    userLink: user => ({ url: chatLink.user(user.id) }),
    channel: () => undefined,
    guild: undefined,
    plain: true,
    userId: '',
    user: () => undefined,
    avatarUrl,
    spans: text => [{ text }],
}

/** Returns a system message as one line of text (SystemMessageUtils.stringify), or undefined without a handler. */
export function systemPlainText(message: Message): string | undefined {
    const content = HANDLERS[message.type ?? MessageType.DEFAULT]?.content(
        message,
        PLAIN_ENV,
    )
    return content && systemPlain(content)
}
