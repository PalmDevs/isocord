import { MessageFlag, MessageType } from '../../../core/discord/messages'
import { compareSnowflakes } from '../../../core/discord/snowflake'
import { t } from '../../../i18n'
import { chatLink } from '../links/chatLink'
import type { Channel } from '../../../stores/channels/channels'
import type { Message } from '../../../stores/readStates'
import type { User } from '../../../stores/users'
import type { MessagePreview } from './messagePreview'
import type { ThreadEmbedRow } from './rows'

/** ThreadConstants: the most messages a thread counts, before and after the counter grew. */
const MAX_THREAD_MESSAGE_COUNT = 100_000
const MAX_THREAD_MESSAGE_COUNT_OLD = 50

/** shouldUseOldMaxMessageCount: threads made up to this id counted only up to the old maximum. */
const OLD_MAX_COUNT_THREAD_ID = '992549565104128000'

/** The newest author's avatar: 18dp. The CDN only serves power-of-two sizes (36 gets an error), so the next one up. */
const AUTHOR_AVATAR_SIZE = 64

/** What the thread card reads besides the message: the thread, its newest message and how authors look. */
export interface ThreadEmbedSources {
    /** The thread, by id (the thread started from a message has the message's id). */
    thread: (id: string) => Channel | undefined
    /** ThreadMessageStore.getMostRecentMessage, by thread id. */
    mostRecent: (threadId: string) => Message | undefined
    name: (user: User) => string
    color: (user: User) => number | undefined
    avatarUrl: (user: User, size: number) => string
    /** A message's one-line preview (messagePreview); undefined without anything to show. */
    preview: (message: Message) => MessagePreview | undefined
}

/**
 * getMessageCountText: the count, capped at the maximum the thread counts to.
 * The reference writes the capped labels as literals ("50+", "100k+"), with no intl message.
 */
function countText(count: number, threadId: string): string {
    if (compareSnowflakes(OLD_MAX_COUNT_THREAD_ID, threadId) >= 0)
        return count >= MAX_THREAD_MESSAGE_COUNT_OLD
            ? t('chat.thread.countOldMax', {
                  count: MAX_THREAD_MESSAGE_COUNT_OLD,
              })
            : String(count)
    return count >= MAX_THREAD_MESSAGE_COUNT
        ? t('chat.thread.countMax')
        : String(count)
}

/** formatMobileMessageCountLabel: "{count} ›", or "See Thread ›" without messages. */
const countLabel = (count: number, threadId: string) =>
    count > 0
        ? t('chat.thread.count', { count: countText(count, threadId) })
        : t('chat.thread.see')

const note = (text: string): Pick<ThreadEmbedRow, 'preview' | 'note'> => ({
    preview: [{ text }],
    note: true,
})

/** The card's lower line: the newest message, or the reference's note. */
function previewOf(
    thread: Channel,
    count: number,
    sources: ThreadEmbedSources,
): Pick<
    ThreadEmbedRow,
    | 'preview'
    | 'note'
    | 'trailingIcon'
    | 'authorName'
    | 'authorColor'
    | 'authorAvatarUrl'
> {
    if (count <= 0) return note(t('chat.thread.empty'))
    const recent = sources.mostRecent(thread.id)
    if (
        thread.thread_metadata?.archived ||
        !recent ||
        recent.type === MessageType.CHANNEL_NAME_CHANGE ||
        recent.type === MessageType.THREAD_STARTER_MESSAGE
    )
        return note(t('chat.thread.noRecent'))
    const preview = sources.preview(recent)
    return {
        authorName: sources.name(recent.author),
        authorColor: sources.color(recent.author),
        authorAvatarUrl: sources.avatarUrl(recent.author, AUTHOR_AVATAR_SIZE),
        // A message with nothing to preview reads like a reply to it.
        ...(preview && preview.spans.length > 0
            ? {
                  preview: preview.spans,
                  trailingIcon: preview.trailingIcon,
                  note: false,
              }
            : note(t('chat.attachmentReply'))),
    }
}

/**
 * createThreadEmbed: the card under a message a thread was started from (HAS_THREAD), or undefined. The thread
 * comes from the stores, or the copy the API attaches to the message.
 */
export function threadEmbedRow(
    message: Message,
    guildId: string | undefined,
    sources: ThreadEmbedSources,
): ThreadEmbedRow | undefined {
    if (!((message.flags ?? 0) & MessageFlag.HAS_THREAD)) return undefined
    const thread = sources.thread(message.id) ?? message.thread
    if (!thread) return undefined
    const count = thread.message_count ?? 0
    return {
        name: thread.name ?? '',
        countLabel: countLabel(count, thread.id),
        ...previewOf(thread, count, sources),
        // onTapThreadEmbed opens the thread.
        url: chatLink.channel(thread.guild_id ?? guildId, thread.id),
    }
}
