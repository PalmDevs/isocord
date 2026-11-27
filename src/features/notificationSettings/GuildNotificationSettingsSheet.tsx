import { ChannelType } from '../../core/discord/channelType'
import { GuildFeature } from '../../core/discord/guild'
import {
    HighlightSettings,
    MAX_MEMBERS_NOTIFY_ALL_MESSAGES,
    UnreadSetting,
    UserNotificationSettings,
} from '../../core/discord/notificationSettings'
import { useSession, useSessionStore } from '../../core/react'
import {
    ActionSheet,
    ActionSheetRow,
    ActionSheetRowGroup,
    ActionSheetRowIcon,
    BottomSheetTitleHeader,
} from '../../design/components/sheets/Sheet'
import {
    TableRadioGroup,
    TableRadioRow,
    TableSwitchRow,
} from '../../design/components/table/TableControlRows'
import { TableRowTrailingText } from '../../design/components/table/TableRow'
import { t } from '../../i18n'
import { channelsStore } from '../../stores/channels/channels'
import { guildsStore } from '../../stores/guilds'
import {
    setGuildMessageNotifications,
    setGuildUnreadSetting,
    unmuteGuild,
    updateGuildSettings,
} from '../../stores/settings/notificationActions'
import { settingsStore } from '../../stores/settings/settingsStore'
import { isChannelMuted, isGuildMuted } from '../../stores/unreadPolicy'
import { systemPlain } from '../chat/system/format'
import { channelIcon } from '../servers/channelIcon'
import { openNotificationSettings } from './openSheets'
import { levelText } from './useNotificationState'
import type { Channel } from '../../stores/channels/channels'
import type { GuildSettings } from '../../stores/settings/userGuildSettings'

/** NotificationSettingsModal's server notification level radio group. */
function ServerLevelRadios({
    guildId,
    level,
    memberCount,
    muted,
}: {
    guildId: string
    level: number
    memberCount: number
    muted: boolean
}) {
    const session = useSession()
    const largeServer = memberCount >= MAX_MEMBERS_NOTIFY_ALL_MESSAGES
    return (
        <TableRadioGroup
            title={t('guildNotificationSettings.serverSettings')}
            value={String(level)}
            onChange={value =>
                setGuildMessageNotifications(session, guildId, Number(value))
            }
        >
            <TableRadioRow
                value={String(UserNotificationSettings.ALL_MESSAGES)}
                label={t('muteSettings.allMessages')}
                subLabel={
                    largeServer
                        ? t('guildNotificationSettings.largeServerPush')
                        : undefined
                }
                disabled={muted}
            />
            <TableRadioRow
                value={String(UserNotificationSettings.ONLY_MENTIONS)}
                label={systemPlain({
                    key: 'channelSettings.onlyMentions',
                    values: {},
                })}
                disabled={muted}
            />
            <TableRadioRow
                value={String(UserNotificationSettings.NO_MESSAGES)}
                label={t('muteSettings.nothing')}
                disabled={muted}
            />
        </TableRadioGroup>
    )
}

/** NotificationSettingsMessageUnreadGuildActionSheet: server-wide unread badge setting. */
function GuildUnreadBadges({
    guildId,
    level,
    unread,
}: {
    guildId: string
    level: number
    unread: UnreadSetting
}) {
    const session = useSession()
    const enabled = useSessionStore(
        settingsStore,
        state => state.newNotifications === true,
    )
    if (!enabled) return null
    const notifiesAll = level === UserNotificationSettings.ALL_MESSAGES
    const resolved = notifiesAll
        ? UnreadSetting.ALL_MESSAGES
        : unread === UnreadSetting.UNSET
          ? UnreadSetting.ONLY_MENTIONS
          : unread
    return (
        <TableRadioGroup
            title={t('unreadSettings.title')}
            value={String(resolved)}
            onChange={value =>
                setGuildUnreadSetting(
                    session,
                    guildId,
                    Number(value) as UnreadSetting,
                )
            }
        >
            <TableRadioRow
                value={String(UnreadSetting.ALL_MESSAGES)}
                label={t('muteSettings.allMessages')}
                subLabel={t('unreadSettings.allMessagesDescription')}
            />
            <TableRadioRow
                value={String(UnreadSetting.ONLY_MENTIONS)}
                label={t('unreadSettings.mentionOnly')}
                subLabel={
                    notifiesAll
                        ? t('unreadSettings.mentionOnlyDisabled')
                        : undefined
                }
                disabled={notifiesAll}
            />
        </TableRadioGroup>
    )
}

/** NotificationSettingsModal's renderNotificationOptions switches. */
function GuildNotificationToggles({
    guildId,
    settings,
    muted,
}: {
    guildId: string
    settings: GuildSettings | undefined
    muted: boolean
}) {
    const session = useSession()
    const suppressHighlights =
        muted || settings?.notifyHighlights === HighlightSettings.DISABLED
    return (
        <>
            <ActionSheetRowGroup>
                <TableSwitchRow
                    label={systemPlain({
                        key: 'guildNotificationSettings.suppressEveryone',
                        values: {},
                    })}
                    value={settings?.suppressEveryone ?? false}
                    onValueChange={value =>
                        updateGuildSettings(session, guildId, {
                            suppress_everyone: value,
                        })
                    }
                />
                <TableSwitchRow
                    label={t('guildNotificationSettings.suppressRoles')}
                    value={settings?.suppressRoles ?? false}
                    onValueChange={value =>
                        updateGuildSettings(session, guildId, {
                            suppress_roles: value,
                        })
                    }
                />
                <TableSwitchRow
                    label={t('guildNotificationSettings.suppressHighlights')}
                    subLabel={t(
                        'guildNotificationSettings.highlightsDescription',
                    )}
                    value={suppressHighlights}
                    disabled={muted}
                    onValueChange={value =>
                        updateGuildSettings(session, guildId, {
                            notify_highlights: value
                                ? HighlightSettings.DISABLED
                                : HighlightSettings.ENABLED,
                        })
                    }
                />
            </ActionSheetRowGroup>
            <ActionSheetRowGroup>
                <TableSwitchRow
                    label={t('guildNotificationSettings.muteEvents')}
                    value={settings?.muteScheduledEvents ?? false}
                    onValueChange={value =>
                        updateGuildSettings(session, guildId, {
                            mute_scheduled_events: value,
                        })
                    }
                />
                <TableSwitchRow
                    label={t('guildNotificationSettings.mobilePush')}
                    value={!muted && (settings?.mobilePush ?? true)}
                    disabled={muted}
                    onValueChange={value =>
                        updateGuildSettings(session, guildId, {
                            mobile_push: value,
                        })
                    }
                />
            </ActionSheetRowGroup>
        </>
    )
}

/** Existing channel and category notification overrides in the guild. */
function ChannelOverridesSection({
    guildId,
    settings,
}: {
    guildId: string
    settings: GuildSettings | undefined
}) {
    const byGuild = useSessionStore(
        channelsStore,
        state => state.byGuild[guildId],
    )
    const channels = useSessionStore(channelsStore, state => state.channels)
    const state = useSessionStore(settingsStore, s => s)
    if (!settings) return null
    const overridden: Channel[] = []
    for (const id of byGuild ?? []) {
        const channel = channels[id]
        if (!channel) continue
        const hasMute = isChannelMuted(state, channel)
        const hasLevel = settings.channelMessageNotifications?.[id] != null
        const hasUnread = settings.channelUnreadSettings?.[id] != null
        if (hasMute || hasLevel || hasUnread) overridden.push(channel)
    }
    if (overridden.length === 0) return null
    return (
        <ActionSheetRowGroup
            title={t('guildNotificationSettings.overrides')}
            hasIcons
        >
            {overridden.map(channel => {
                const muted = isChannelMuted(state, channel)
                const customLevel =
                    settings.channelMessageNotifications?.[channel.id]
                const status = muted
                    ? t('guildNotificationSettings.muted')
                    : customLevel != null
                      ? levelText(customLevel)
                      : undefined
                return (
                    <ActionSheetRow
                        key={channel.id}
                        icon={
                            <ActionSheetRowIcon
                                name={
                                    channel.type === ChannelType.GUILD_CATEGORY
                                        ? 'FolderIcon'
                                        : channelIcon(channel.type)
                                }
                            />
                        }
                        label={channel.name ?? ''}
                        trailing={
                            status ? (
                                <TableRowTrailingText text={status} />
                            ) : undefined
                        }
                        arrow
                        onPress={() => openNotificationSettings(channel.id)}
                    />
                )
            })}
        </ActionSheetRowGroup>
    )
}

/**
 * NotificationSettingsModal for a server: mute/unmute, default notification level, unread badges,
 * suppression switches, mobile push, and channel overrides.
 */
export function GuildNotificationSettingsSheet({
    guildId,
    onOpenMute,
}: {
    guildId: string
    onOpenMute: (guildId: string) => void
}) {
    const session = useSession()
    const guild = useSessionStore(guildsStore, state => state.guilds[guildId])
    const settings = useSessionStore(
        settingsStore,
        state => state.guildSettings[guildId],
    )
    const muted = useSessionStore(settingsStore, state =>
        isGuildMuted(state, guildId),
    )
    if (!guild) return null
    const isHub = guild.features?.includes(GuildFeature.HUB) ?? false
    const own = settings?.messageNotifications
    const level =
        own === undefined || own === UserNotificationSettings.NULL
            ? (guild.defaultMessageNotifications ??
              UserNotificationSettings.ALL_MESSAGES)
            : own
    return (
        <ActionSheet
            scrollable
            startExpanded
            header={
                <BottomSheetTitleHeader
                    title={t('channelActions.notificationSettings')}
                    subtitle={guild.name}
                />
            }
        >
            <ActionSheetRowGroup
                hasIcons
                helperText={t('guildNotificationSettings.muteHelper')}
            >
                <ActionSheetRow
                    icon={
                        <ActionSheetRowIcon
                            name={muted ? 'BellIcon' : 'BellSlashIcon'}
                        />
                    }
                    label={systemPlain({
                        key: muted
                            ? 'guildSettings.unmuteName'
                            : 'guildSettings.muteName',
                        values: { name: guild.name },
                    })}
                    arrow={!muted}
                    onPress={
                        muted
                            ? () => unmuteGuild(session, guildId)
                            : () => onOpenMute(guildId)
                    }
                />
            </ActionSheetRowGroup>
            {!isHub && (
                <>
                    <ServerLevelRadios
                        guildId={guildId}
                        level={level}
                        memberCount={guild.memberCount}
                        muted={muted}
                    />
                    <GuildUnreadBadges
                        guildId={guildId}
                        level={level}
                        unread={settings?.unreadSetting ?? UnreadSetting.UNSET}
                    />
                    <GuildNotificationToggles
                        guildId={guildId}
                        settings={settings}
                        muted={muted}
                    />
                    <ChannelOverridesSection
                        guildId={guildId}
                        settings={settings}
                    />
                </>
            )}
        </ActionSheet>
    )
}
