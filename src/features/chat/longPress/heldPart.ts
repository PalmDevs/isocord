import * as Clipboard from 'expo-clipboard'
import { channelPermalink } from '../../../core/discord/permalink'
import { t } from '../../../i18n'
import { embedTextPart } from '../../../native/NativeIsocordConstants'
import { channelsStore } from '../../../stores/channels/channels'
import { chatGesturesStore } from '../../../stores/settings/chatGestures'
import { settingsStore } from '../../../stores/settings/settingsStore'
import { toast } from '../composer/toast'
import { handleHeaderPress } from '../headerActions'
import { parseChatLink } from '../links/chatLink'
import {
    showLongPressCommandSheet,
    showLongPressUrlActionSheet,
} from './linkActions'
import type { Session } from '../../../core/session'
import type { Embed } from '../../../stores/messages/messageTypes'
import type { Message } from '../../../stores/readStates'
import type { ForwardingMessage } from '../../mediaViewer/store'
import type { ComposerApi } from '../composer'
import type { ChatLink } from '../links/chatLink'

export interface HeldPartContext {
    composer?: ComposerApi
    /** Handles a chat link as a tap would: Go To Channel of a held channel link. */
    openLink?: (url: string) => void
}

/** The raw text EmbedView hands onTapCopyText for each part (rawName, rawValue and so on). */
const EMBED_TEXT: Record<
    string,
    (embed: Embed, field?: number) => string | undefined
> = {
    [embedTextPart.provider]: embed => embed.provider?.name,
    [embedTextPart.author]: embed => embed.author?.name,
    [embedTextPart.title]: embed => embed.title,
    [embedTextPart.description]: embed => embed.description,
    [embedTextPart.fieldName]: (embed, field) =>
        field === undefined ? undefined : embed.fields?.[field]?.name,
    [embedTextPart.fieldValue]: (embed, field) =>
        field === undefined ? undefined : embed.fields?.[field]?.value,
    [embedTextPart.footer]: embed => embed.footer?.text,
}

function embedText(
    message: Message,
    link: ChatLink & { kind: 'embedText' },
): string | undefined {
    const holder = link.forward
        ? (message as ForwardingMessage).message_snapshots?.[0]?.message
        : message
    const embed = holder?.embeds?.[link.index]
    return embed && EMBED_TEXT[link.part]?.(embed, link.field)
}

/**
 * A held part of a message that has its own long press: embed text (handleCopyText), the author's name
 * (handleLongPressUsername), links (onLongPressLink), channel and message links (handleMessagesLongPressChannel) and
 * command mentions (handleLongPressCommandMention). Returns false for the rest, which open the message's sheet.
 */
export function handleHeldPart(
    session: Session,
    channelId: string,
    message: Message,
    url: string,
    { composer, openLink }: HeldPartContext,
): boolean {
    const link = parseChatLink(url)
    switch (link?.kind) {
        case 'embedText': {
            // Turned off in Settings → Chat: the hold opens the message's sheet instead.
            if (!chatGesturesStore.getState().holdEmbedToCopy) return false
            const text = embedText(message, link)
            if (!text) return false
            Clipboard.setStringAsync(text).catch(() => {})
            toast(t('chat.copiedToClipboard'))
            return true
        }
        case 'author':
            // handleOpenProfile, as a tap on the avatar.
            handleHeaderPress('avatar', message.id, {
                session,
                channelId,
                composer,
            })
            return true
        case 'web':
        case 'masked':
            showLongPressUrlActionSheet(link.url)
            return true
        case 'channel': {
            const guildId = session.get(channelsStore).getState().channels[
                link.channelId
            ]?.guild_id
            showLongPressUrlActionSheet(
                channelPermalink(guildId, link.channelId, link.messageId),
                openLink && (() => openLink(url)),
            )
            return true
        }
        case 'command':
            showLongPressCommandSheet(
                link.id,
                link.name,
                session.get(settingsStore).getState().developerMode === true,
            )
            return true
        default:
            return false
    }
}
