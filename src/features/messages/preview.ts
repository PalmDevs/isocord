import { MessageType, PREVIEW_MESSAGE_TYPES } from '../../core/discord/messages'
import { useSession, useSessionStore } from '../../core/react'
import { t } from '../../i18n'
import { channelsStore } from '../../stores/channels/channels'
import { displayName, usersStore } from '../../stores/users'
import { mentionResolver, replySpans } from '../chat/rows/buildRows'
import { parseMarkdown, toSpans } from '../chat/rows/markdown'
import { messagePreview } from '../chat/rows/messagePreview'
import { systemPlainText } from '../chat/system'
import type { Message } from '../../stores/readStates'
import type { User } from '../../stores/users'
import type { MessagePreview, PreviewIcon } from '../chat/rows/messagePreview'
import type { Span } from '../chat/rows/rows'

function attachmentLabel(message: Message): string | undefined {
    const type = message.attachments?.[0]?.content_type ?? ''
    if (!message.attachments?.length) return undefined
    if (type.startsWith('image/')) return t('messages.previewImage')
    if (type.startsWith('video/')) return t('messages.previewVideo')
    if (type.startsWith('audio/')) return t('messages.previewAudio')
    return t('messages.previewFile')
}

/** The line of a system message: the chat's own wording (system/index.ts), else a label. */
function systemText(message: Message): string {
    if (message.type === MessageType.CALL) return t('messages.previewCall')
    return systemPlainText(message) ?? t('messages.previewSystem')
}

/** One-line text of a message: its content with mentions and emoji flattened, else a label for what it carries. */
export function previewText(message: Message): string | undefined {
    const type = message.type ?? MessageType.DEFAULT
    if (!PREVIEW_MESSAGE_TYPES.has(type)) return systemText(message)
    const names = new Map(
        (message.mentions ?? []).map(user => [user.id, displayName(user)]),
    )
    const content = (message.content ?? '')
        .replace(/<@!?(\d+)>/g, (_, id: string) => `@${names.get(id) ?? ''}`)
        .replace(/<a?:(\w+):\d+>/g, ':$1:')
        .replace(/\s+/g, ' ')
        .trim()
    if (content) return content
    return (
        attachmentLabel(message) ??
        ((message as { message_snapshots?: unknown[] }).message_snapshots
            ?.length
            ? t('messages.previewForwarded')
            : undefined) ??
        (message.sticker_items?.length
            ? message.sticker_items[0]?.name || t('messages.previewSticker')
            : undefined) ??
        (message.embeds?.length ? t('messages.previewEmbed') : undefined)
    )
}

/** Returns the "You: " or "Name: " before a preview (ChannelRowPreview's authorLabel), or undefined. */
export function previewPrefix(
    message: Message,
    selfId: string,
    isGroup: boolean,
    author?: User,
): string | undefined {
    if (message.author.id === selfId) return `${t('messages.previewYou')}: `
    if (isGroup) return `${displayName(author ?? message.author)}: `
    return undefined
}

/** The preview of a message: a chat message by formatMessagePreview, a system message as its one line. */
function previewOf(
    message: Message,
    spansOf: (markup: string) => Span[],
    selfId?: string,
): MessagePreview | undefined {
    const type = message.type ?? MessageType.DEFAULT
    if (type === MessageType.CALL || PREVIEW_MESSAGE_TYPES.has(type))
        return messagePreview(message, spansOf, selfId)
    return { spans: [{ text: systemText(message) }] }
}

/** The icon after a message's preview text (ChannelRowPreview's PreviewIcon). */
export const previewIcon = (
    message: Message | undefined,
    selfId: string,
): PreviewIcon | undefined =>
    message ? previewOf(message, () => [], selfId)?.trailingIcon : undefined

/**
 * Returns a preview's text as JSON spans on one line (MessagePreviewMarkup), or undefined without one.
 * A string from the selector, so a row re-renders only when its own preview changes.
 */
export function usePreviewSpans(
    message: Message | undefined,
    selfId: string,
): string | undefined {
    const session = useSession()
    return useSessionStore(usersStore, ({ users }) => {
        if (!message) return undefined
        // Channel mentions are rare in DMs: read once, not subscribed to.
        const { channels } = session.get(channelsStore).getState()
        const resolver = mentionResolver({
            guild: undefined,
            members: undefined,
            users,
            channels,
        })
        const preview = previewOf(
            message,
            markup => replySpans(toSpans(parseMarkdown(markup), resolver)),
            selfId,
        )
        return preview && JSON.stringify(preview.spans)
    })
}
