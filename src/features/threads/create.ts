import { Endpoint } from '../../core/api/paths'
import { ApiError } from '../../core/api/rest'
import { ChannelType } from '../../core/discord/channelType'
import { holdThread } from '../../stores/channels/channels'
import { unparseMessage } from '../chat/composer/parsing/parse'
import { parseContext } from '../chat/composer/parsing/parseContext'
import type { Session } from '../../core/session'
import type { Channel } from '../../stores/channels/channels'
import type { Message } from '../../stores/readStates'

/** ThreadConstants.DEFAULT_AUTO_ARCHIVE_DURATION: three days, in minutes. */
const DEFAULT_AUTO_ARCHIVE_DURATION = 4320
/** AbortCodes.INVALID_FORM_BODY. */
const INVALID_FORM_BODY = 50035

/** sanitizeThreadName: line breaks become spaces. */
export function sanitizeThreadName(name: string): string {
    return name.replace(/\r\n|[\r\n]/g, ' ').trim()
}

type ContentMessage = Message & {
    poll?: { question?: { text?: string } }
    message_snapshots?: Array<{ message: Message }>
}

const cut = (text: string, max: number) =>
    text.length > max ? `${text.substring(0, max)}...` : text

/**
 * ThreadCreationHooks.getDefaultThreadName: the name a thread from `message` gets when none is typed. Its first
 * embed's title, else its poll's question, else the first line of its text cut at a word within 40 characters.
 */
export function defaultThreadName(
    session: Session,
    channelId: string,
    message: Message | undefined,
): string {
    if (!message) return ''
    const base = message as ContentMessage
    // getContentMessage: a forward's text is its snapshot's.
    const content = base.message_snapshots?.[0]?.message ?? base
    const title = content.embeds?.[0]?.title ?? ''
    if (title !== '') return cut(title, 40)
    const question = base.poll?.question?.text ?? ''
    if (question !== '') return cut(question, 80)
    const text = sanitizeThreadName(
        unparseMessage(
            content.content ?? '',
            parseContext(session, channelId),
        ).split('\n')[0] ?? '',
    ).replace(/^[ #-]+/, '')
    // Words and the separators between them, joined while they fit.
    const parts = text.split(/((?:\s|[!@#$%^&*()_\-+={}[\]:";'<>?,./])+)/)
    let name = parts[0] ?? ''
    for (let i = 1; i < parts.length; i++) {
        const next = name + parts[i]
        if (next.length > 40) break
        name = next
    }
    return cut(name, 40)
}

/** Why a thread was not created: its name was refused, or anything else. */
export type CreateThreadError = 'nameRequired' | 'failed'

/**
 * useCreateThreadCommon's request: a private thread if `isPrivate`, else a public one (an announcement thread in an
 * announcement channel), on `messageId` or on its own, archived after the parent's default. The new thread is held in the channel store so its
 * chat can open before the gateway's THREAD_CREATE arrives.
 */
export async function createThread(
    session: Session,
    parent: Channel,
    options: { name: string; messageId?: string; isPrivate?: boolean },
): Promise<Channel | CreateThreadError> {
    const { name, messageId, isPrivate } = options
    try {
        const thread = await session.rest.post<Channel>(
            messageId
                ? Endpoint.messageThreads(parent.id, messageId)
                : Endpoint.channelThreads(parent.id),
            {
                body: {
                    name,
                    type: isPrivate
                        ? ChannelType.PRIVATE_THREAD
                        : parent.type === ChannelType.GUILD_ANNOUNCEMENT
                          ? ChannelType.ANNOUNCEMENT_THREAD
                          : ChannelType.PUBLIC_THREAD,
                    auto_archive_duration:
                        parent.default_auto_archive_duration ??
                        DEFAULT_AUTO_ARCHIVE_DURATION,
                },
            },
        )
        holdThread(session, thread)
        return thread
    } catch (error) {
        // makeApiNameRequiredError.
        if (
            error instanceof ApiError &&
            error.code === INVALID_FORM_BODY &&
            error.body?.errors?.name != null
        )
            return 'nameRequired'
        return 'failed'
    }
}
