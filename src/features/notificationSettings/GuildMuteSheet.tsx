import { UserNotificationSettings } from '../../core/discord/notificationSettings'
import { useSession, useSessionStore } from '../../core/react'
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
import { guildsStore } from '../../stores/guilds'
import {
    muteGuild,
    unmuteGuild,
} from '../../stores/settings/notificationActions'
import { settingsStore } from '../../stores/settings/settingsStore'
import { isGuildMuted } from '../../stores/unreadPolicy'
import { systemPlain } from '../chat/system/format'
import { MuteSettingsHint } from './MuteHint'
import { MUTE_OPTIONS } from './muteOptions'
import { levelText } from './useNotificationState'

/**
 * MuteSettingsActionSheet for a server: durations to mute the server, or unmute when muted, plus
 * a link to the server's Notification Settings.
 */
export function GuildMuteSheet({
    guildId,
    onOpenSettings,
}: {
    guildId: string
    onOpenSettings: (guildId: string) => void
}) {
    const session = useSession()
    const close = useCloseSheet()
    const guild = useSessionStore(guildsStore, state => state.guilds[guildId])
    const muted = useSessionStore(settingsStore, state =>
        isGuildMuted(state, guildId),
    )
    const ownLevel = useSessionStore(
        settingsStore,
        state => state.guildSettings[guildId]?.messageNotifications,
    )
    if (!guild) return null
    const guildLevel =
        ownLevel === undefined || ownLevel === UserNotificationSettings.NULL
            ? (guild.defaultMessageNotifications ??
              UserNotificationSettings.ALL_MESSAGES)
            : ownLevel
    const levelName = levelText(guildLevel)
    return (
        <ActionSheet
            header={
                <BottomSheetTitleHeader
                    title={t('muteSettings.muteServer')}
                    subtitle={guild.name}
                />
            }
        >
            {muted ? (
                <ActionSheetRowGroup hasIcons>
                    <ActionSheetRow
                        icon={<ActionSheetRowIcon name="BellIcon" />}
                        label={systemPlain({
                            key: 'guildSettings.unmuteName',
                            values: { name: guild.name },
                        })}
                        onPress={() => {
                            close()
                            unmuteGuild(session, guildId)
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
                                muteGuild(session, guildId, seconds)
                            }}
                        />
                    ))}
                </ActionSheetRowGroup>
            )}
            <ActionSheetRowGroup
                helperText={
                    <MuteSettingsHint
                        muted={false}
                        guildMuted={muted}
                        guildLevel={guildLevel}
                    />
                }
            >
                <ActionSheetRow
                    label={t('channelActions.notificationSettings')}
                    arrow
                    trailing={
                        levelName && <TableRowTrailingText text={levelName} />
                    }
                    disabled={muted}
                    onPress={() => onOpenSettings(guildId)}
                />
            </ActionSheetRowGroup>
        </ActionSheet>
    )
}
