import { ChannelType } from '../../core/discord/channelType'
import { useSession } from '../../core/react'
import {
    ActionSheet,
    ActionSheetRow,
    ActionSheetRowGroup,
    ActionSheetRowIcon,
    BottomSheetTitleHeader,
} from '../../design/components/sheets/Sheet'
import { useCloseSheet } from '../../design/components/sheets/sheetContext'
import { TableRowTrailingText } from '../../design/components/table/TableRow'
import { t } from '../../i18n'
import { isPrivate, isThread } from '../../stores/channels/channels'
import { MuteSettingsHint } from './MuteHint'
import { muteChannel, unmuteChannel, unmuteKey } from './muteActions'
import { MUTE_OPTIONS } from './muteOptions'
import { levelText, useNotificationState } from './useNotificationState'
import type { MessageKey } from '../../i18n'
import type { Channel } from '../../stores/channels/channels'

/** MuteSettingsUtils.getMuteSettingLabel. */
function titleKey(channel: Channel, forumPost: boolean): MessageKey {
    if (forumPost) return 'muteSettings.mutePost'
    if (isThread(channel)) return 'muteSettings.muteThread'
    if (isPrivate(channel)) return 'muteSettings.muteConversation'
    if (channel.type === ChannelType.GUILD_CATEGORY)
        return 'muteSettings.muteCategory'
    return 'muteSettings.muteChannel'
}

/**
 * MuteSettingsActionSheet, with the Notification Settings row and hint of MuteSettingsScreen: the durations to
 * mute a channel, category or private channel for, or, when it is muted, a row to unmute it.
 */
export function MuteSheet({
    channelId,
    onOpenSettings,
}: {
    channelId: string
    onOpenSettings: (channelId: string) => void
}) {
    const session = useSession()
    const close = useCloseSheet()
    const { channel, forumPost, name, muted, guildMuted, guildLevel, level } =
        useNotificationState(channelId)
    if (!channel) return null
    const levelName = levelText(level)
    return (
        <ActionSheet
            header={
                <BottomSheetTitleHeader
                    title={t(titleKey(channel, forumPost))}
                    subtitle={name}
                />
            }
        >
            {muted ? (
                <ActionSheetRowGroup hasIcons>
                    <ActionSheetRow
                        icon={<ActionSheetRowIcon name="BellIcon" />}
                        label={t(unmuteKey(channel, forumPost))}
                        onPress={() => {
                            close()
                            unmuteChannel(session, channel)
                        }}
                    />
                </ActionSheetRowGroup>
            ) : (
                <ActionSheetRowGroup>
                    {MUTE_OPTIONS.map(({ label, seconds }) => (
                        <ActionSheetRow
                            key={label}
                            label={t(label)}
                            onPress={() => {
                                close()
                                muteChannel(session, channel, seconds)
                            }}
                        />
                    ))}
                </ActionSheetRowGroup>
            )}
            {isPrivate(channel) ? null : (
                <ActionSheetRowGroup
                    helperText={
                        <MuteSettingsHint
                            muted={muted}
                            guildMuted={guildMuted}
                            guildLevel={guildLevel}
                        />
                    }
                >
                    <ActionSheetRow
                        label={t('channelActions.notificationSettings')}
                        arrow
                        trailing={
                            levelName && (
                                <TableRowTrailingText text={levelName} />
                            )
                        }
                        disabled={muted || guildMuted}
                        onPress={() => onOpenSettings(channelId)}
                    />
                </ActionSheetRowGroup>
            )}
        </ActionSheet>
    )
}
