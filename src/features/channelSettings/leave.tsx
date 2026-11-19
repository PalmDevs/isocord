import { showConfirmModal } from '../../design/components/modals/showAlert'
import { t } from '../../i18n'
import {
    closePrivateChannel,
    isManagedChannel,
} from '../../stores/channels/channelActions'
import { computeChannelName } from '../../stores/channels/channelName'
import { channelsStore } from '../../stores/channels/channels'
import { usersStore } from '../../stores/users'
import { AlertBody } from './AlertBody'
import type { Session } from '../../core/session'

/**
 * ChannelLongPressActionSheet's Close DM row: closePrivateChannel. The chat panels close by themselves when the
 * channel leaves the store, where the reference's second argument transitions away from a selected DM.
 */
export function closeDm(session: Session, channelId: string): Promise<void> {
    return closePrivateChannel(session, channelId)
}

/**
 * ChannelLongPressActionSheet's Leave Group row: asks first, with other words for a group an application manages
 * (isManaged), then closePrivateChannel.
 */
export function confirmLeaveGroup(session: Session, channelId: string): void {
    const channel = session.get(channelsStore).getState().channels[channelId]
    if (!channel) return
    const name = computeChannelName(
        channel,
        session.get(usersStore).getState().users,
    )
    const managed = isManagedChannel(channel)
    showConfirmModal({
        key: 'leave-group',
        title: t(
            managed
                ? 'channelActions.leaveManagedGroupTitle'
                : 'channelActions.leaveGroupTitle',
            { name },
        ),
        content: (
            <AlertBody
                textKey={
                    managed
                        ? 'channelActions.leaveManagedGroupBody'
                        : 'channelActions.leaveGroupBody'
                }
                values={{ name }}
            />
        ),
        confirmText: t('channelActions.leaveConfirm'),
        cancelText: t('channelActions.leaveCancel'),
        onConfirm: () => closePrivateChannel(session, channelId),
    })
}
