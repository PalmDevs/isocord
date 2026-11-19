import { ChannelType } from '../../core/discord/channelType'
import { HelpdeskArticle, helpArticleUrl } from '../../core/discord/helpdesk'
import { logger } from '../../core/log'
import { openLink } from '../../core/openLink'
import { useSession } from '../../core/react'
import { showConfirmModal } from '../../design/components/modals/showAlert'
import { Text } from '../../design/components/Text'
import { TableSwitchRow } from '../../design/components/table/TableControlRows'
import { TableRow, TableRowIcon } from '../../design/components/table/TableRow'
import { TableRowGroup } from '../../design/components/table/TableRowGroup'
import { t } from '../../i18n'
import { deleteChannel } from '../../stores/channels/channelActions'
import { showToast } from '../toasts'
import { AlertBody } from './AlertBody'
import type { Session } from '../../core/session'
import type { Channel } from '../../stores/channels/channels'

const log = logger('ChannelSettings')

/** ChannelSettingsOverview's renderAnnouncement: switches the channel between text and announcement. */
export function AnnouncementSetting({
    announcement,
    onChange,
}: {
    announcement: boolean
    onChange: (announcement: boolean) => void
}) {
    return (
        <TableRowGroup
            description={
                // One Text so the plain parts need no raw text wrapper. Matches TableRowGroup's description style.
                <Text variant="text-sm/normal" color="TEXT_SUBTLE">
                    {`${t('channelSettings.announcementFollow')} `}
                    <Text
                        variant="text-sm/normal"
                        color="TEXT_LINK"
                        onPress={() =>
                            openLink(
                                helpArticleUrl(
                                    HelpdeskArticle.ANNOUNCEMENT_CHANNELS,
                                ),
                            )
                        }
                    >
                        {t('channelSettings.announcementLearnMore')}
                    </Text>
                    {`\n\n${t('channelSettings.announcementProfile')}`}
                </Text>
            }
        >
            <TableSwitchRow
                label={t('channelSettings.announcementChannel')}
                value={announcement}
                onValueChange={onChange}
            />
        </TableRowGroup>
    )
}

/** ChannelSettingsOverview's renderPermissions: the row to the permissions of a channel or category. */
export function PermissionsRow({ channel }: { channel: Channel }) {
    return (
        <TableRowGroup
            hasIcons
            helperText={t('channelSettings.permissionsHelper')}
        >
            <TableRow
                icon={<TableRowIcon name="ShieldUserIcon" />}
                label={t(
                    channel.type === ChannelType.GUILD_CATEGORY
                        ? 'channelSettings.categoryPermissions'
                        : 'channelSettings.channelPermissions',
                )}
                arrow
                // Deferred: no permissions screen yet.
                onPress={() => {}}
            />
        </TableRowGroup>
    )
}

/** renderCommonSettingsSection's Invites row. */
export function InvitesRow() {
    return (
        <TableRowGroup hasIcons>
            <TableRow
                icon={<TableRowIcon name="LinkIcon" />}
                label={t('channelSettings.invites')}
                arrow
                // Deferred: no invites screen yet.
                onPress={() => {}}
            />
        </TableRowGroup>
    )
}

/** ChannelSettingsOverview's handleDeleteChannel alert. The screen leaves once the channel is gone. */
function confirmDeleteChannel(session: Session, channel: Channel): void {
    showConfirmModal({
        key: 'delete-channel',
        // showDeleteAlert titles a category "Delete Channel" too.
        title: t('channelSettings.deleteChannel'),
        content: (
            <AlertBody
                textKey="threadActions.deleteThreadBody"
                values={{ channelName: channel.name ?? '' }}
            />
        ),
        confirmText: t('threadActions.yes'),
        cancelText: t('threadActions.no'),
        onConfirm: async () => {
            try {
                await deleteChannel(session, channel.id)
            } catch (error) {
                log.warn('Could not delete the channel', error)
                showToast({
                    key: 'delete-channel-error',
                    variant: 'critical',
                    content: t('channelSettings.saveError'),
                })
            }
        },
    })
}

const deleteKey = (channel: Channel) =>
    channel.type === ChannelType.GUILD_CATEGORY
        ? 'channelSettings.deleteCategory'
        : 'channelSettings.deleteChannel'

/** ChannelSettingsOverview's renderDeleteButton for a channel or category. The screen already needs MANAGE_CHANNELS. */
export function DeleteChannelRow({ channel }: { channel: Channel }) {
    const session = useSession()
    return (
        <TableRowGroup hasIcons>
            <TableRow
                variant="danger"
                icon={<TableRowIcon name="TrashIcon" variant="danger" />}
                label={t(deleteKey(channel))}
                onPress={() => confirmDeleteChannel(session, channel)}
            />
        </TableRowGroup>
    )
}
