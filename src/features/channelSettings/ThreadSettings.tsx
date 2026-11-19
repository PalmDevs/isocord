import { AUTO_ARCHIVE_DURATIONS } from '../../core/discord/threads'
import { useSession } from '../../core/react'
import {
    TableRadioGroup,
    TableRadioRow,
    TableSwitchRow,
} from '../../design/components/table/TableControlRows'
import { TableRow, TableRowIcon } from '../../design/components/table/TableRow'
import { TableRowGroup } from '../../design/components/table/TableRowGroup'
import { t } from '../../i18n'
import { threadMetadataOf } from '../../stores/channels/threadModeration'
import {
    canArchiveThread,
    canDeleteThread,
    canLockThread,
    confirmDeleteThread,
    toggleArchive,
    toggleLock,
} from './threadActions'
import type { MessageKey } from '../../i18n'
import type { Channel } from '../../stores/channels/channels'

/** ThreadAutoArchive.getAutoArchiveOptions: the label of each duration, in minutes. */
const DURATION_OPTIONS: { value: number; label: MessageKey }[] = [
    {
        value: AUTO_ARCHIVE_DURATIONS.HOUR,
        label: 'channelSettings.duration1Hour',
    },
    {
        value: AUTO_ARCHIVE_DURATIONS.DAY,
        label: 'channelSettings.duration24Hours',
    },
    {
        value: AUTO_ARCHIVE_DURATIONS.THREE_DAYS,
        label: 'channelSettings.duration3Days',
    },
    {
        value: AUTO_ARCHIVE_DURATIONS.WEEK,
        label: 'channelSettings.duration1Week',
    },
]

/** ChannelSettingsOverview's renderAutoArchiveDuration and renderDefaultAutoArchiveDuration: the minutes of inactivity before a thread is hidden. */
export function AutoArchiveSetting({
    minutes,
    description,
    disabled,
    onChange,
}: {
    minutes: number
    description: MessageKey
    /** AutoArchiveDurationOptions: a pinned post does not hide. */
    disabled?: boolean
    onChange: (minutes: number) => void
}) {
    return (
        <TableRadioGroup
            value={String(minutes)}
            title={t('channelSettings.hideAfterInactivity')}
            description={t(description)}
            accessibilityLabel={t('channelSettings.autoHideOptions')}
            onChange={value => onChange(Number(value))}
        >
            {DURATION_OPTIONS.map(option => (
                <TableRadioRow
                    key={option.value}
                    value={String(option.value)}
                    label={t(option.label)}
                    disabled={disabled}
                />
            ))}
        </TableRadioGroup>
    )
}

/** ChannelSettingsOverview's renderInvitable: who can add members to a private thread. */
export function InvitableSetting({
    invitable,
    disabled,
    onChange,
}: {
    invitable: boolean
    disabled: boolean
    onChange: (invitable: boolean) => void
}) {
    return (
        <TableRowGroup helperText={t('channelSettings.anyoneCanInviteHelper')}>
            <TableSwitchRow
                label={t('channelSettings.anyoneCanInvite')}
                value={invitable}
                disabled={disabled}
                onValueChange={onChange}
            />
        </TableRowGroup>
    )
}

/**
 * ChannelSettingsOverview's renderThreadManagementActions and renderDeleteButton: close or open, lock or unlock, and
 * delete, each for who may. They write at once and do not wait for Save.
 */
export function ThreadActionRows({
    thread,
    forumPost,
}: {
    thread: Channel
    forumPost: boolean
}) {
    const session = useSession()
    const metadata = threadMetadataOf(thread)
    const archived = metadata?.archived === true
    const locked = metadata?.locked === true
    const archiveKey: MessageKey = archived
        ? forumPost
            ? 'threadActions.openPost'
            : 'threadActions.openThread'
        : forumPost
          ? 'threadActions.closePost'
          : 'threadActions.closeThread'
    const lockKey: MessageKey = locked
        ? forumPost
            ? 'threadActions.unlockPost'
            : 'threadActions.unlockThread'
        : forumPost
          ? 'threadActions.lockPost'
          : 'threadActions.lockThread'
    const canArchive = canArchiveThread(session, thread)
    const canLock = canLockThread(session, thread)
    return (
        <>
            {(canArchive || canLock) && (
                <TableRowGroup hasIcons>
                    {canArchive && (
                        <TableRow
                            icon={
                                <TableRowIcon
                                    name={archived ? 'ClockIcon' : 'XLargeIcon'}
                                />
                            }
                            label={t(archiveKey)}
                            onPress={() => toggleArchive(session, thread)}
                        />
                    )}
                    {canLock && (
                        <TableRow
                            icon={<TableRowIcon name="LockIcon" />}
                            label={t(lockKey)}
                            onPress={() => toggleLock(session, thread)}
                        />
                    )}
                </TableRowGroup>
            )}
            {canDeleteThread(session, thread) && (
                <TableRowGroup hasIcons>
                    <TableRow
                        variant="danger"
                        icon={
                            <TableRowIcon name="TrashIcon" variant="danger" />
                        }
                        label={t(
                            forumPost
                                ? 'threadActions.deletePost'
                                : 'threadActions.deleteThread',
                        )}
                        onPress={() => confirmDeleteThread(session, thread)}
                    />
                </TableRowGroup>
            )}
        </>
    )
}
