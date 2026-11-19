import { showToast } from '../../design/components/overlays/toastStore'
import { showSimpleActionSheet } from '../../design/components/sheets/showSimpleActionSheet'
import { t } from '../../i18n'
import { openChannel } from '../chat/links/openChannel'
import { notificationsStore } from './store'
import type { Session } from '../../core/session'
import type { SimpleActionSheetOption } from '../../design/components/sheets/SimpleActionSheet'
import type { NotificationItem } from './api'

/**
 * ForYouItem's long press sheet (ForYouItemLongPress): "Remove Notification", here with "Mark As Read" for an
 * unread mention and "Jump to Message".
 */
export function showNotificationItemActions(
    session: Session,
    item: NotificationItem,
    unread: boolean,
): void {
    const store = session.get(notificationsStore).getState()
    const message = item.message
    const options: SimpleActionSheetOption[] = []
    if (unread)
        options.push({
            label: t('notifications.markAsRead'),
            icon: 'ChatCheckIcon',
            onPress: () => store.ack(item),
        })
    if (message)
        options.push({
            label: t('notifications.jumpToMessage'),
            icon: 'ChatArrowRightIcon',
            onPress: () => openChannel(message.channel_id, message.id),
        })
    options.push({
        label: t('notifications.removeNotification'),
        icon: 'TrashIcon',
        onPress: () => {
            store.remove(item).catch(() =>
                showToast({
                    key: 'REMOVE_NOTIFICATION_ERROR',
                    content: t('notifications.removeError'),
                    variant: 'critical',
                }),
            )
        },
    })
    showSimpleActionSheet({
        key: 'ForYouItemLongPress',
        options,
        hasIcons: true,
    })
}
