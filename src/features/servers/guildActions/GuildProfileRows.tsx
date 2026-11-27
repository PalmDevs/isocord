import { Permission } from '../../../core/discord/permissions'
import { useSession, useSessionStore } from '../../../core/react'
import {
    ActionSheetRow,
    ActionSheetRowIcon,
} from '../../../design/components/sheets/Sheet'
import { TableSwitchRow } from '../../../design/components/table/TableControlRows'
import { TableRowTrailingText } from '../../../design/components/table/TableRow'
import { t } from '../../../i18n'
import { channelsStore, isThread } from '../../../stores/channels/channels'
import { setMyGuildTag } from '../../../stores/guildActions'
import { membersStore } from '../../../stores/members'
import { can } from '../../../stores/permissions'
import { toggleHideMutedChannels } from '../../../stores/settings/notificationActions'
import {
    setGuildMessageRequestRestricted,
    setGuildRestricted,
    toggleShowAllChannels,
} from '../../../stores/settings/settingsActions'
import { settingsStore } from '../../../stores/settings/settingsStore'
import { isOptInEnabledForGuild } from '../../../stores/unreadPolicy'
import { usersStore } from '../../../stores/users'
import { showToast } from '../../toasts'
import { openEditNicknameAlert } from './EditNicknameAlert'
import type { Guild } from '../../../stores/guilds'

/** GuildActionSheetActions ChangeIdentityOption: opens the nickname alert. */
export function NicknameRow({ guildId }: { guildId: string }) {
    const session = useSession()
    const nick = useSessionStore(
        membersStore,
        state => state.members[guildId]?.[session.userId]?.nick,
    )
    return (
        <ActionSheetRow
            icon={<ActionSheetRowIcon name="PencilIcon" />}
            label={t('guildActions.editNickname')}
            subLabel={nick ?? undefined}
            onPress={() => openEditNicknameAlert(guildId)}
        />
    )
}

/** ServerTagOption: adopts the server's tag, or clears it when it is the equipped one. */
export function ServerTagRow({ guild, tag }: { guild: Guild; tag: string }) {
    const session = useSession()
    const equipped = useSessionStore(usersStore, state => {
        const primary = state.users[session.userId]?.primary_guild
        return primary?.identity_enabled === true
            ? primary.identity_guild_id === guild.id
            : false
    })
    const toggle = async () => {
        try {
            await setMyGuildTag(session, guild.id, !equipped)
        } catch {
            showToast({
                key: 'guild-tag-error',
                variant: 'critical',
                content: t('guildActions.error'),
            })
        }
    }
    return (
        <ActionSheetRow
            icon={<ActionSheetRowIcon name="TagIcon" />}
            label={t('guildActions.serverTag')}
            subLabel={tag}
            trailing={
                equipped ? undefined : (
                    <TableRowTrailingText text={t('guildActions.adoptTag')} />
                )
            }
            onPress={toggle}
        />
    )
}

/** Show All Channels switch: turns the server's opt-in channel list off. */
export function ShowAllChannelsRow({ guild }: { guild: Guild }) {
    const session = useSession()
    const optInEnabled = useSessionStore(settingsStore, state =>
        isOptInEnabledForGuild(state, guild),
    )
    const viewableIds = () => {
        const { byGuild, channels } = session.get(channelsStore).getState()
        return (byGuild[guild.id] ?? []).filter(id => {
            const channel = channels[id]
            return (
                channel !== undefined &&
                !isThread(channel) &&
                can(session, id, Permission.VIEW_CHANNEL)
            )
        })
    }
    return (
        <TableSwitchRow
            icon={<ActionSheetRowIcon name="ChannelListIcon" />}
            label={t('guildActions.showAllChannels')}
            value={!optInEnabled}
            onValueChange={() =>
                toggleShowAllChannels(session, guild, viewableIds())
            }
        />
    )
}

/** HideMutedChannelsOption. */
export function HideMutedChannelsRow({ guildId }: { guildId: string }) {
    const session = useSession()
    const hideMuted = useSessionStore(
        settingsStore,
        state => state.guildSettings[guildId]?.hideMutedChannels === true,
    )
    return (
        <TableSwitchRow
            icon={<ActionSheetRowIcon name="EyeSlashIcon" />}
            label={t('guildActions.hideMutedChannels')}
            value={hideMuted}
            onValueChange={() => toggleHideMutedChannels(session, guildId)}
        />
    )
}

/** RestrictedGuildPrivacyOption: the direct messages and message requests switches. */
export function AllowDmsRow({
    guildId,
    isHub,
}: {
    guildId: string
    isHub: boolean
}) {
    const session = useSession()
    const allowDms = useSessionStore(
        settingsStore,
        state => !(state.restrictedGuildIds ?? []).includes(guildId),
    )
    return (
        <TableSwitchRow
            icon={<ActionSheetRowIcon name="ChatIcon" />}
            label={t('guildActions.allowDms')}
            subLabel={t(
                isHub
                    ? 'guildActions.allowDmsHubDescription'
                    : 'guildActions.allowDmsDescription',
            )}
            value={allowDms}
            onValueChange={value => setGuildRestricted(session, guildId, value)}
        />
    )
}

export function AllowMessageRequestsRow({ guildId }: { guildId: string }) {
    const session = useSession()
    const allowDms = useSessionStore(
        settingsStore,
        state => !(state.restrictedGuildIds ?? []).includes(guildId),
    )
    const allowRequests = useSessionStore(
        settingsStore,
        state =>
            !(state.messageRequestRestrictedGuildIds ?? []).includes(guildId),
    )
    return (
        <TableSwitchRow
            icon={<ActionSheetRowIcon name="ChatShieldIcon" />}
            label={t('guildActions.allowMessageRequests')}
            subLabel={t('guildActions.allowMessageRequestsDescription')}
            value={allowDms && allowRequests}
            disabled={!allowDms}
            onValueChange={value =>
                setGuildMessageRequestRestricted(session, guildId, value)
            }
        />
    )
}
