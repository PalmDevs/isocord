import {
    MAX_MEMBERS_NOTIFY_ALL_MESSAGES,
    UserNotificationSettings,
} from '../../core/discord/notificationSettings'
import {
    THREAD_NOTIFICATION_LEVELS,
    ThreadMemberFlags,
} from '../../core/discord/threadMember'
import { useSession } from '../../core/react'
import {
    ActionSheet,
    ActionSheetRow,
    ActionSheetRowGroup,
    BottomSheetTitleHeader,
} from '../../design/components/sheets/Sheet'
import {
    TableRadioGroup,
    TableRadioRow,
} from '../../design/components/table/TableControlRows'
import { t } from '../../i18n'
import { setThreadNotificationSettings } from '../../stores/channels/threadMemberActions'
import { setChannelMessageNotifications } from '../../stores/settings/notificationActions'
import { systemPlain } from '../chat/system/format'
import { ServerNotice } from './MuteHint'
import { unmuteChannel, unmuteKey } from './muteActions'
import { UnreadBadges } from './UnreadBadges'
import { levelText, useNotificationState } from './useNotificationState'
import type { Channel } from '../../stores/channels/channels'

/** ThreadConstants.getThreadNotificationOptions: the label of each thread level. */
function threadLevelLabel(level: number): string {
    switch (level) {
        case ThreadMemberFlags.ALL_MESSAGES:
            return t('muteSettings.allMessages')
        case ThreadMemberFlags.ONLY_MENTIONS:
            return systemPlain({
                key: 'channelSettings.onlyMentions',
                values: {},
            })
        default:
            return t('muteSettings.nothing')
    }
}

/** ThreadNotificationSettingsBottomSheet: All Messages, Only @mentions or Nothing, by the thread's member flags. */
function ThreadLevelRadios({
    channel,
    setting,
}: {
    channel: Channel
    setting: number
}) {
    const session = useSession()
    return (
        <TableRadioGroup
            title={t('channelActions.notificationSettings')}
            value={String(setting)}
            onChange={value =>
                setThreadNotificationSettings(session, channel, {
                    flags: Number(value),
                })
            }
        >
            {THREAD_NOTIFICATION_LEVELS.map(level => (
                <TableRadioRow
                    key={level}
                    value={String(level)}
                    label={threadLevelLabel(level)}
                />
            ))}
        </TableRadioGroup>
    )
}

/** ChannelSettingsNotifications: the level a channel or category follows, or "use the default". */
function ChannelLevelRadios({ channelId }: { channelId: string }) {
    const session = useSession()
    const { channel, muted, guildMuted, memberCount, level, defaultLevel } =
        useNotificationState(channelId)
    if (!channel) return null
    const disabled = muted || guildMuted
    // Servers this size do not push the messages of an all-messages channel, only the mentions.
    const largeServer =
        memberCount !== undefined &&
        memberCount >= MAX_MEMBERS_NOTIFY_ALL_MESSAGES
    return (
        <TableRadioGroup
            title={t('channelActions.notificationSettings')}
            value={String(level)}
            onChange={value =>
                setChannelMessageNotifications(session, channel, Number(value))
            }
        >
            <TableRadioRow
                value={String(UserNotificationSettings.NULL)}
                label={t(
                    channel.parent_id
                        ? 'channelSettings.useCategoryDefault'
                        : 'channelSettings.useServerDefault',
                )}
                subLabel={levelText(defaultLevel)}
                disabled={disabled}
            />
            <TableRadioRow
                value={String(UserNotificationSettings.ALL_MESSAGES)}
                label={t('muteSettings.allMessages')}
                subLabel={
                    largeServer
                        ? t('channelSettings.largeServerPush')
                        : undefined
                }
                disabled={disabled}
            />
            <TableRadioRow
                value={String(UserNotificationSettings.ONLY_MENTIONS)}
                label={systemPlain({
                    key: 'channelSettings.onlyMentions',
                    values: {},
                })}
                disabled={disabled}
            />
            <TableRadioRow
                value={String(UserNotificationSettings.NO_MESSAGES)}
                label={t('muteSettings.nothing')}
                disabled={disabled}
            />
        </TableRadioGroup>
    )
}

/**
 * ChannelSettingsNotifications and, for a thread, ThreadNotificationSettingsBottomSheet: mutes or unmutes the
 * channel, category or thread, and picks the notification level it follows. The stage and forum variants of the
 * reference are left out.
 */
export function NotificationSettingsSheet({
    channelId,
    onOpenMute,
}: {
    channelId: string
    onOpenMute: (channelId: string) => void
}) {
    const session = useSession()
    const {
        channel,
        thread,
        forumPost,
        threadSetting,
        name,
        muted,
        guildMuted,
        guildLevel,
    } = useNotificationState(channelId)
    if (!channel) return null
    return (
        <ActionSheet
            header={
                <BottomSheetTitleHeader
                    title={t('channelActions.notificationSettings')}
                    subtitle={name}
                />
            }
        >
            <ActionSheetRowGroup>
                <ActionSheetRow
                    label={
                        muted
                            ? t(unmuteKey(channel, forumPost))
                            : systemPlain({
                                  key: 'channelSettings.muteName',
                                  values: { name },
                              })
                    }
                    arrow={!muted}
                    onPress={
                        muted
                            ? () => unmuteChannel(session, channel)
                            : () => onOpenMute(channelId)
                    }
                />
            </ActionSheetRowGroup>
            {thread ? (
                <ThreadLevelRadios channel={channel} setting={threadSetting} />
            ) : (
                <ChannelLevelRadios channelId={channelId} />
            )}
            {!thread && channel.guild_id && (
                <UnreadBadges
                    channel={{ ...channel, guild_id: channel.guild_id }}
                />
            )}
            <ServerNotice guildMuted={guildMuted} guildLevel={guildLevel} />
        </ActionSheet>
    )
}
