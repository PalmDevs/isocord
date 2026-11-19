import { MessageType } from '../../../core/discord/messages'
import { chatLink } from '../links/chatLink'
import { systemSpans } from '../system/format'
import type { Message } from '../../../stores/readStates'
import type { EphemeralRow, InteractionRow } from './rows'

/** `interaction_metadata` (or the older `interaction`) on an interaction response. */
export interface InteractionMeta {
    name?: string
    user?: {
        id: string
        username: string
        global_name?: string | null
        avatar?: string | null
    }
}

/** How the user who ran a command is drawn: their name in the chat, its colours and their avatar. */
export type InteractionAuthor = Pick<
    InteractionRow,
    'avatarUrl' | 'authorColor' | 'authorColors'
> & { name: string }

/** The command's link hook: the command is not tappable here, the hook only marks its part. */
const COMMAND_HOOK = 'command'

/**
 * createExecutedCommand: "{username} used {commandName}" over a slash command or context menu command's
 * response, with the user's avatar. The command name has its slash only for a slash command.
 */
export function executedCommand(
    message: Message & {
        interaction_metadata?: InteractionMeta
        interaction?: InteractionMeta
    },
    author: (user: NonNullable<InteractionMeta['user']>) => InteractionAuthor,
): InteractionRow | undefined {
    const meta = message.interaction_metadata ?? message.interaction
    if (!meta?.name || !meta.user) return undefined
    const user = author(meta.user)
    const command =
        message.type === MessageType.CHAT_INPUT_COMMAND
            ? `/${meta.name}`
            : meta.name
    const userUrl = chatLink.user(meta.user.id)
    return {
        avatarUrl: user.avatarUrl,
        authorColor: user.authorColor,
        authorColors: user.authorColors,
        userUrl,
        parts: systemSpans({
            key: 'chat.interaction',
            values: {
                username: user.name,
                usernameOnClick: { url: userUrl },
                commandName: command,
                commandNameOnClick: { url: COMMAND_HOOK },
            },
        }).map(span => ({
            text: span.text,
            role:
                span.link === userUrl
                    ? 'name'
                    : span.link === COMMAND_HOOK
                      ? 'command'
                      : undefined,
        })),
    }
}

/** createEphemeralIndication: "Only you can see this • Dismiss message", the dismiss part deleting it locally. */
export function ephemeralIndication(messageId: string): EphemeralRow {
    return {
        parts: systemSpans({
            key: 'chat.ephemeral',
            values: { handleDelete: { url: chatLink.dismiss(messageId) } },
        }).map(span => ({ text: span.text, url: span.link })),
    }
}
