import { Linking } from 'react-native'
import { maybeRefreshAttachmentUrl } from '../../../core/api/attachmentUrls'
import { AttachmentFlag } from '../../../core/discord/messages'
import { isPlaintextPreviewableFile } from '../../../core/discord/plaintextFiles'
import { openLink } from '../../../core/openLink'
import { t } from '../../../i18n'
import { copyMediaLink } from '../../mediaViewer/actions'
import { parseChatLink } from '../links/chatLink'
import { openPlaintextFilePreview } from '../links/openChannel'
import type { Session } from '../../../core/session'
import type { Attachment } from '../../../stores/messages/messageTypes'
import type { Message } from '../../../stores/readStates'
import type { ForwardingMessage } from '../../mediaViewer/store'
import type { MessageAction } from './actions'

/** The attachment a `file` link names: the message's own, or the forwarded snapshot's. */
export function heldFile(
    message: Message,
    link: string,
): Attachment | undefined {
    const file = parseChatLink(link)
    if (file?.kind !== 'file') return undefined
    const holder = file.forward
        ? (message as ForwardingMessage).message_snapshots?.[0]?.message
        : message
    // Counted among the attachments the chat shows, as the native list does (thumbnails left out).
    return holder?.attachments?.filter(
        attachment => !((attachment.flags ?? 0) & AttachmentFlag.IS_THUMBNAIL),
    )[file.index]
}

/**
 * onTapAttachmentLink and onTapAttachmentTextPreview: re-signs an expired URL first, then opens a text file in the
 * plain-text preview and any other file in the browser. The reference previews only from the card's "View" button.
 * Here the whole card does, as the row has no such button.
 */
export async function openAttachment(
    session: Session,
    attachment: Attachment,
): Promise<void> {
    const url = await maybeRefreshAttachmentUrl(session, attachment.url)
    if (isPlaintextPreviewableFile(attachment.filename))
        openPlaintextFilePreview(url, attachment.filename)
    else void openLink(url)
}

/**
 * Returns the rows for a held file or audio card, matching the media rows: Save File, Copy Link, Copy Proxied Link
 * (when it differs) and Open Link. The reference's onLongPressAttachmentLink shows Link Options instead.
 * Each row re-signs an expired URL first (maybeRefreshAttachmentUrl).
 */
export function fileActions(
    session: Session,
    attachment: Attachment,
): MessageAction[] {
    const fresh = (url: string) => maybeRefreshAttachmentUrl(session, url)
    return [
        {
            key: 'saveFile',
            label: t('chat.file.saveFile'),
            icon: 'DownloadIcon',
            // The reference's Save File hands the URL to the system (handleClick), which downloads it.
            onPress: () =>
                void fresh(attachment.url).then(url =>
                    Linking.openURL(url).catch(() => {}),
                ),
        },
        {
            key: 'copyFileLink',
            label: t('mediaViewer.copyMediaLink'),
            icon: 'LinkIcon',
            onPress: () => void fresh(attachment.url).then(copyMediaLink),
        },
        ...(attachment.proxy_url && attachment.proxy_url !== attachment.url
            ? [
                  {
                      key: 'copyProxiedFileLink',
                      label: t('chat.file.copyProxiedLink'),
                      icon: 'LinkIcon' as const,
                      onPress: () =>
                          void fresh(attachment.proxy_url).then(copyMediaLink),
                  },
              ]
            : []),
        {
            key: 'openFileLink',
            label: t('chat.linkOptions.openLink'),
            icon: 'WindowLaunchIcon',
            onPress: () => void fresh(attachment.url).then(openLink),
        },
    ]
}
