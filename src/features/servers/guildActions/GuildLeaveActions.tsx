import { GuildFeature } from '../../../core/discord/guild'
import { useSession } from '../../../core/react'
import { showConfirmModal } from '../../../design/components/modals/showAlert'
import {
    ActionSheetRow,
    ActionSheetRowGroup,
    ActionSheetRowIcon,
} from '../../../design/components/sheets/Sheet'
import { useCloseSheet } from '../../../design/components/sheets/sheetContext'
import { t } from '../../../i18n'
import { leaveGuild } from '../../../stores/guildActions'
import { showToast } from '../../toasts'
import type { Session } from '../../../core/session'
import type { Guild } from '../../../stores/guilds'

/** LeaveServerAlert: confirms, then leaves the server. */
function confirmLeaveGuild(session: Session, guild: Guild): void {
    const isHub = guild.features?.includes(GuildFeature.HUB) ?? false
    showConfirmModal({
        key: 'guild-action-sheet-leave-server',
        title: t(isHub ? 'guildActions.leaveHub' : 'guildActions.leaveServer'),
        content: t('guildActions.leaveConfirm', { name: guild.name }),
        confirmText: t('channelActions.leaveConfirm'),
        cancelText: t('channelActions.leaveCancel'),
        onConfirm: async () => {
            try {
                await leaveGuild(session, guild.id)
            } catch {
                showToast({
                    key: 'leave-guild-error',
                    variant: 'critical',
                    content: t('guildActions.error'),
                })
            }
        },
    })
}

/** GuildActionSheetSecondaryActions: the leave server row, hidden for the owner. */
export function GuildLeaveActions({ guild }: { guild: Guild }) {
    const session = useSession()
    const close = useCloseSheet()
    if (guild.ownerId === session.userId) return null
    const isHub = guild.features?.includes(GuildFeature.HUB) ?? false
    return (
        <ActionSheetRowGroup hasIcons>
            <ActionSheetRow
                icon={
                    <ActionSheetRowIcon name="DoorExitIcon" variant="danger" />
                }
                label={t(
                    isHub
                        ? 'guildActions.leaveHub'
                        : 'guildActions.leaveServer',
                )}
                variant="danger"
                onPress={() => {
                    close()
                    confirmLeaveGuild(session, guild)
                }}
            />
        </ActionSheetRowGroup>
    )
}
