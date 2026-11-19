import * as Clipboard from 'expo-clipboard'
import { Endpoint } from '../../../core/api/paths'
import { channelPermalink } from '../../../core/discord/permalink'
import { showConfirmModal } from '../../../design/components/modals/showAlert'
import { t } from '../../../i18n'
import { membersStore } from '../../../stores/members'
import {
    messagesAround,
    messagesStore,
} from '../../../stores/messages/messages'
import { markMessageUnread } from '../../../stores/readStates'
import { openDmChannel } from '../../../stores/relationships'
import { displayName } from '../../../stores/users'
import { discardMessage, retryMessage } from '../composer/outbox/outbox'
import { toast } from '../composer/toast'
import { openShare, openThreadCreation } from '../links/openChannel'
import { removeAllReactions } from '../reactions'
import { alertMessagePreview } from './AlertMessagePreview'
import type { ReactNode } from 'react'
import type { Session } from '../../../core/session'
import type { Channel } from '../../../stores/channels/channels'
import type { Message } from '../../../stores/readStates'
import type { ComposerApi } from '../composer'
import type {
    FlaggedMessage,
    MessageAction,
    MessageActionContext,
} from './actions'

/** What the rows of one message are built from. */
export interface ActionEnv extends Omit<MessageActionContext, 'message'> {
    message: FlaggedMessage
    channel: Channel | undefined
    /** The text the message has to copy. */
    text: string
}

const confirm = (
    key: string,
    title: string,
    content: string,
    confirmText: string,
    onConfirm: () => void,
    extraContent?: ReactNode,
) =>
    showConfirmModal({
        key,
        title,
        content,
        extraContent,
        confirmText,
        onConfirm,
    })

export const copy = (text: string, toastKey: 'text' | 'link' | 'id') => {
    Clipboard.setStringAsync(text).catch(() => {})
    toast(
        t(
            toastKey === 'text'
                ? 'chat.actions.copiedText'
                : toastKey === 'link'
                  ? 'chat.actions.copiedLink'
                  : 'chat.actions.copiedId',
        ),
    )
}

/** Opens (creating if needed) the DM with a user. */
async function openDm(
    session: Session,
    userId: string,
    openChannel: (channelId: string) => void,
): Promise<void> {
    try {
        openChannel(await openDmChannel(session, userId))
    } catch {
        toast(t('chat.actions.failed'))
    }
}

/** The rows of a message that failed to send. */
export function failedActions({
    session,
    message,
}: ActionEnv): Record<'retry' | 'discard', MessageAction> {
    const { channel_id: channelId } = message
    const nonce = String(message.nonce)
    return {
        retry: {
            key: 'retry',
            label: t('chat.failed.retry'),
            icon: 'RefreshIcon',
            onPress: () => retryMessage(session, channelId, nonce),
        },
        discard: {
            key: 'discard',
            label: t('chat.failed.delete'),
            icon: 'TrashIcon',
            isDestructive: true,
            onPress: () => discardMessage(session, channelId, nonce),
        },
    }
}

export const copyText = (text: string): MessageAction => ({
    key: 'copyText',
    label: t('chat.actions.copyText'),
    icon: 'CopyIcon',
    onPress: () => copy(text, 'text'),
})

export const copyId = (id: string): MessageAction => ({
    key: 'copyId',
    label: t('chat.actions.copyId'),
    icon: 'IdIcon',
    onPress: () => copy(id, 'id'),
})

export const copyLink = (
    channel: Channel | undefined,
    message: Message,
): MessageAction => ({
    key: 'copyLink',
    label: t('chat.actions.copyLink'),
    icon: 'LinkIcon',
    onPress: () =>
        copy(
            channelPermalink(channel?.guild_id, message.channel_id, message.id),
            'link',
        ),
})

/** Forward, which opens the forward screen (openForwardModal; its icon is ForwardingIcon). */
export const forward = (message: Message): MessageAction => ({
    key: 'forward',
    label: t('chat.actions.forward'),
    icon: 'ArrowAngleRightUpIcon',
    onPress: () => openShare({ kind: 'forward', message }),
})

/** The rows that act through the composer. */
export function composerActions({
    session,
    channel,
    composer,
    message,
}: ActionEnv): Record<
    'edit' | 'reply' | 'createThread' | 'mention',
    MessageAction
> {
    return {
        edit: {
            key: 'edit',
            label: t('chat.actions.edit'),
            icon: 'PencilIcon',
            onPress: () => composer?.setEditing(message),
        },
        reply: {
            key: 'reply',
            label: t('chat.actions.reply'),
            icon: 'ArrowAngleLeftUpIcon',
            onPress: () => composer?.setReplyTo(message),
        },
        createThread: {
            key: 'createThread',
            label: t('threads.create'),
            icon: 'ThreadIcon',
            onPress: () => openThreadCreation(message.channel_id, message.id),
        },
        mention: mentionAction(session, channel, message, composer),
    }
}

function mentionAction(
    session: Session,
    channel: Channel | undefined,
    message: Message,
    composer: ComposerApi | undefined,
): MessageAction {
    return {
        key: 'mention',
        label: t('chat.actions.mention'),
        icon: 'AtIcon',
        onPress: () => {
            const nick = channel?.guild_id
                ? session.get(membersStore).getState().members[
                      channel.guild_id
                  ]?.[message.author.id]?.nick
                : undefined
            // `@name`, which parse.ts turns into <@id> on send.
            composer?.insertText(`@${nick ?? displayName(message.author)}`, {
                space: true,
            })
            composer?.focus()
        },
    }
}

/** The rows that open another chat or move the read mark. */
export function navigationActions({
    session,
    message,
    openChannel,
}: ActionEnv): Record<
    'openThread' | 'markUnread' | 'messageAuthor',
    MessageAction
> {
    const { id, channel_id: channelId } = message
    return {
        openThread: {
            key: 'openThread',
            label: t('chat.actions.openThread'),
            icon: 'ThreadIcon',
            onPress: () => openChannel(id),
        },
        markUnread: {
            key: 'markUnread',
            label: t('chat.actions.markUnread'),
            icon: 'ChatMarkUnreadIcon',
            onPress: () =>
                markMessageUnread(
                    session,
                    channelId,
                    id,
                    messagesAround(
                        session.get(messagesStore).getState(),
                        channelId,
                        id,
                    ),
                ),
        },
        messageAuthor: {
            key: 'message',
            label: t('chat.actions.message'),
            icon: 'ChatIcon',
            onPress: () => void openDm(session, message.author.id, openChannel),
        },
    }
}

/** The rows that change the message for everyone: publish, pin, remove reactions and delete. */
export function moderationActions({
    session,
    message,
}: ActionEnv): Record<
    'publish' | 'pin' | 'removeReactions' | 'remove',
    MessageAction
> {
    const { id, channel_id: channelId } = message
    const pinned = message.pinned === true
    return {
        publish: {
            key: 'publish',
            label: t('chat.actions.publish'),
            icon: 'AnnouncementsIcon',
            onPress: () =>
                confirm(
                    'message-publish',
                    t('chat.actions.publish'),
                    t('chat.actions.publishBody'),
                    t('chat.actions.publishConfirm'),
                    () =>
                        session.rest
                            .post(Endpoint.messageCrosspost(channelId, id))
                            .catch(() => toast(t('chat.actions.failed'))),
                ),
        },
        pin: {
            key: pinned ? 'unpin' : 'pin',
            label: t(pinned ? 'chat.actions.unpin' : 'chat.actions.pin'),
            icon: 'PinIcon',
            onPress: () =>
                confirm(
                    pinned ? 'message-unpin' : 'message-pin',
                    t(pinned ? 'chat.actions.unpin' : 'chat.actions.pin'),
                    t(
                        pinned
                            ? 'chat.actions.unpinBody'
                            : 'chat.actions.pinBody',
                    ),
                    t(
                        pinned
                            ? 'chat.actions.unpinConfirm'
                            : 'chat.actions.pinConfirm',
                    ),
                    () =>
                        session.rest[pinned ? 'delete' : 'put'](
                            Endpoint.channelPin(channelId, id),
                        ).catch(() => toast(t('chat.actions.failed'))),
                    alertMessagePreview(session, message),
                ),
        },
        removeReactions: {
            key: 'removeAllReactions',
            label: t('chat.actions.removeAllReactions'),
            icon: 'TrashIcon',
            isDestructive: true,
            onPress: () =>
                confirm(
                    'message-remove-reactions',
                    t('chat.actions.removeAllReactions'),
                    t('chat.actions.removeReactionsBody'),
                    t('chat.actions.removeReactionsConfirm'),
                    () => removeAllReactions(session, channelId, id),
                ),
        },
        remove: {
            key: 'delete',
            label: t('chat.actions.delete'),
            icon: 'TrashIcon',
            isDestructive: true,
            onPress: () =>
                confirm(
                    'message-delete',
                    t('chat.actions.delete'),
                    t('chat.actions.deleteBody'),
                    t('chat.actions.deleteConfirm'),
                    () =>
                        session.rest
                            .delete(Endpoint.channelMessage(channelId, id))
                            .catch(() => toast(t('chat.actions.failed'))),
                    alertMessagePreview(session, message),
                ),
        },
    }
}
