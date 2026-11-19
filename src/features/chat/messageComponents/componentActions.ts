import {
    ButtonStyle,
    ComponentType,
    SELECT_COMPONENT_TYPES,
} from '../../../core/discord/components'
import { showAlert } from '../../../design/components/modals/showAlert'
import { t } from '../../../i18n'
import { findMessage, messagesStore } from '../../../stores/messages/messages'
import { findByPath } from './apiComponent'
import { executeComponentInteraction } from './interactions'
import { openSelectSheet } from './SelectSheet'
import type { Session } from '../../../core/session'
import type { RichMessage } from '../rows/rich'

/**
 * handleTapButtonActionComponent and handleTapSelectActionComponent: a tapped button sends its interaction, a
 * premium one explains it cannot be bought here, and a select opens its sheet.
 */
export function handleComponentLink(
    session: Session,
    channelId: string,
    messageId: string,
    componentId: string,
): void {
    const message: RichMessage | undefined = findMessage(
        session.get(messagesStore).getState(),
        channelId,
        messageId,
    )
    const component = findByPath(message?.components, componentId)
    if (!message || !component) return
    if (component.type === ComponentType.BUTTON) {
        if (component.style === ButtonStyle.PREMIUM)
            showAlert({
                key: 'premium-component',
                title: t('chat.components.premiumTitle'),
                content: t('chat.components.premiumBody'),
                confirmText: t('chat.components.premiumConfirm'),
            })
        else if (component.custom_id)
            void executeComponentInteraction(session, {
                message,
                componentId,
                componentType: component.type,
                customId: component.custom_id,
            })
        return
    }
    if (SELECT_COMPONENT_TYPES.has(component.type))
        openSelectSheet({ message, componentId, component })
}
