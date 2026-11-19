import { openActionSheet } from '../../../design/components/sheets/sheetStore'
import { recordEmojiUsage } from '../../expressions'
import { ReactionPickerSheet } from '../longPress/ReactionPickerSheet'
import { toggleReaction } from '../reactions'
import type { Session } from '../../../core/session'
import type { SearchEmoji } from '../../expressions'

/** The add reaction button: opens the emoji picker and reacts with the pick. */
export function openReactionPicker(
    session: Session,
    channelId: string,
    messageId: string,
): void {
    const react = (emoji: SearchEmoji) => {
        recordEmojiUsage(
            session,
            emoji.type === 'unicode' ? (emoji.parent ?? emoji) : emoji,
            { reaction: true },
        )
        toggleReaction(
            session,
            channelId,
            messageId,
            emoji.type === 'custom'
                ? {
                      id: emoji.id,
                      name: emoji.originalName ?? emoji.name,
                      animated: emoji.animated,
                  }
                : { id: null, name: emoji.surrogates },
        )
    }
    openActionSheet(
        'message-reaction-picker',
        <ReactionPickerSheet channelId={channelId} onPickEmoji={react} />,
    )
}
