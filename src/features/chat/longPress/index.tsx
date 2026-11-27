import { openActionSheet } from '../../../design/components/sheets/sheetStore'
import { swipeAction, swipeMode } from '../../../native/IsocordConstants'
import { channelsStore } from '../../../stores/channels/channels'
import { findMessage, messagesStore } from '../../../stores/messages/messages'
import { heldMedia } from '../../mediaViewer/store'
import { composerStore } from '../composer/state/composerStore'
import { canReact, messageActionGroups, messageSwipeActions } from './actions'
import { heldFile } from './fileActions'
import { handleHeldPart } from './heldPart'
import { LongPressMessageActionSheet } from './LongPressMessageActionSheet'
import type { Session } from '../../../core/session'
import type { ComposerApi } from '../composer'
import type { LongPressMessageActionSheetProps } from './LongPressMessageActionSheet'

/** showLongPressMessageActionSheet: opens the sheet for a message. */
function showLongPressMessageActionSheet(
    props: LongPressMessageActionSheetProps,
): void {
    openActionSheet(
        'message-long-press',
        <LongPressMessageActionSheet {...props} />,
    )
}

/**
 * A message swiped in the chat list: replies to it, or (`edit`, after a longer pull) edits it. The native list only
 * offers what `messageSwipeActions` allowed, but the message may have changed since, so the same check runs again.
 */
export function handleMessageSwipe(
    session: Session,
    channelId: string,
    messageId: string,
    action: string,
    composer: ComposerApi,
): void {
    const state = session.get(messagesStore).getState().channels[channelId]
    const message = state?.messages.find(item => item.id === messageId)
    if (!message) return
    const allowed = messageSwipeActions(
        session,
        session.get(channelsStore).getState().channels[channelId],
    )(message)
    if (action === swipeAction.edit && allowed === swipeMode.replyEdit)
        composer.setEditing(message)
    else if (action === swipeAction.reply && allowed) {
        const replyingTo = session.get(composerStore).getState().replies[
            channelId
        ]?.messageId
        composer.setReplyTo(replyingTo === messageId ? null : message)
    }
}

/**
 * A long press on a message in the chat list. A held part with a long press of its own (embed text, the author's
 * name, a link) runs that instead (handleHeldPart). Otherwise opens the message's action sheet, or nothing when it
 * has no actions (a thread starter message, whose only action is a jump to the thread). A held media tile or file
 * card adds its rows.
 */
export function handleMessageLongPress(
    session: Session,
    channelId: string,
    messageId: string,
    {
        media,
        openLink,
        ...options
    }: {
        /** Absent in a message preview (`ChatPreview`), which has no composer. */
        composer?: ComposerApi
        openChannel: (channelId: string) => void
        /** Handles a chat link as a tap would: Go To Channel of a held channel link. */
        openLink?: (url: string) => void
        /** The held part's link, or "" when the message was held elsewhere. */
        media: string
    },
): void {
    const message = findMessage(
        session.get(messagesStore).getState(),
        channelId,
        messageId,
    )
    if (!message) return
    if (
        media &&
        handleHeldPart(session, channelId, message, media, {
            composer: options.composer,
            openLink,
        })
    )
        return
    // Only a held media tile or file card adds rows; any other part opens the plain sheet.
    const held =
        media && (heldMedia(message, media) || heldFile(message, media))
            ? media
            : ''
    if (
        !canReact(session, message) &&
        messageActionGroups({ session, message, ...options }).length === 0 &&
        !held
    )
        return
    showLongPressMessageActionSheet({
        channelId,
        messageId,
        ...options,
        media: held,
    })
}
