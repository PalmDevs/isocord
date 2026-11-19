import { useEffect } from 'react'
import { ChannelType } from '../../core/discord/channelType'
import { useSession, useSessionStore } from '../../core/react'
import { Avatar } from '../../design/components/avatars/Avatar'
import { GuildIcon } from '../../design/components/avatars/GuildIcon'
import {
    ActionSheet,
    ActionSheetIconHeader,
    ActionSheetRow,
    ActionSheetRowGroup,
    ActionSheetRowIcon,
} from '../../design/components/sheets/Sheet'
import { useCloseSheet } from '../../design/components/sheets/sheetContext'
import { t } from '../../i18n'
import { computeChannelName } from '../../stores/channels/channelName'
import {
    channelsStore,
    isForumPost,
    isThread,
} from '../../stores/channels/channels'
import { guildsStore } from '../../stores/guilds'
import { useChannelPermissions } from '../../stores/permissions'
import { isUnread, readStatesStore } from '../../stores/readStates'
import { settingsStore } from '../../stores/settings/settingsStore'
import { isChannelMuted } from '../../stores/unreadPolicy'
import { usersStore } from '../../stores/users'
import { GroupAvatar } from '../messages/GroupAvatar'
import { useDm } from '../messages/useDm'
import { useIsPinned } from '../notificationSettings'
import { channelActionGroups } from './actions'
import type { ChannelActionNavigation } from './actions'

/** The header icon: larger than the reference's GuildIconSizes.LARGE (40), by design. */
const HEADER_ICON_SIZE = 48

/** The guild's icon, or a DM's avatar: the header icon of ChannelLongPressActionSheetConnected. */
function HeaderIcon({ channelId }: { channelId: string }) {
    const guildId = useSessionStore(
        channelsStore,
        state => state.channels[channelId]?.guild_id,
    )
    const guild = useSessionStore(guildsStore, state =>
        guildId ? state.guilds[guildId] : undefined,
    )
    const dm = useDm(channelId)
    if (guild) return <GuildIcon guild={guild} size={HEADER_ICON_SIZE} />
    if (dm?.recipient)
        return <Avatar user={dm.recipient} size={HEADER_ICON_SIZE} />
    return (
        <GroupAvatar
            id={channelId}
            name={dm?.name ?? ''}
            icon={dm?.icon}
            size={HEADER_ICON_SIZE}
        />
    )
}

/**
 * ChannelLongPressActionSheet: the actions of a channel, category, thread, DM or group DM, in groups. The header
 * shows the server's icon or the DM's avatar, the channel's name and, for a group DM, its member count.
 * A pressed row closes the sheet, then runs.
 */
export function ChannelActionSheet({
    channelId,
    navigation,
}: {
    channelId: string
    navigation: ChannelActionNavigation
}) {
    const session = useSession()
    const close = useCloseSheet()
    const channel = useSessionStore(
        channelsStore,
        state => state.channels[channelId],
    )
    const name = useSessionStore(usersStore, state =>
        channel
            ? computeChannelName(channel, state.users, !isThread(channel))
            : '',
    )
    const developerMode = useSessionStore(
        settingsStore,
        state => state.developerMode === true,
    )
    const muted = useSessionStore(
        settingsStore,
        state => channel !== undefined && isChannelMuted(state, channel),
    )
    // ReadStateStore.hasUnreadOrMentions.
    const hasUnread = useSessionStore(
        readStatesStore,
        state =>
            isUnread(state, channelId) || (state.mentions[channelId] ?? 0) > 0,
    )
    const hasLastMessage = useSessionStore(
        readStatesStore,
        state => state.lastMessageIds[channelId] !== undefined,
    )
    const forumPost = useSessionStore(
        channelsStore,
        state =>
            channel !== undefined &&
            isForumPost(channel, state.channels[channel.parent_id ?? '']),
    )
    const pinned = useIsPinned({ id: channelId, guild_id: channel?.guild_id })
    // Re-renders the sheet when the permissions that show the Edit rows change.
    useChannelPermissions(channelId)

    // The channel was deleted while the sheet was open.
    useEffect(() => {
        if (!channel) close()
    }, [channel, close])
    if (!channel) return null

    const groups = channelActionGroups({
        session,
        channel,
        navigation,
        developerMode,
        muted,
        hasUnread,
        canMarkUnread:
            hasLastMessage && channel.type !== ChannelType.GUILD_CATEGORY,
        pinned,
        forumPost,
    })
    return (
        <ActionSheet
            header={
                <ActionSheetIconHeader
                    icon={<HeaderIcon channelId={channelId} />}
                    title={name}
                    subtitle={
                        channel.type === ChannelType.GROUP_DM
                            ? t('messages.members', {
                                  count:
                                      (channel.recipient_ids?.length ?? 0) + 1,
                              })
                            : undefined
                    }
                />
            }
        >
            {groups.map(group => (
                <ActionSheetRowGroup
                    key={group.map(action => action.key).join()}
                    hasIcons
                >
                    {group.map(action => {
                        const variant = action.isDestructive
                            ? 'danger'
                            : 'default'
                        return (
                            <ActionSheetRow
                                key={action.key}
                                label={action.label}
                                variant={variant}
                                icon={
                                    <ActionSheetRowIcon
                                        name={action.icon}
                                        variant={variant}
                                    />
                                }
                                onPress={() => {
                                    close()
                                    action.onPress()
                                }}
                            />
                        )
                    })}
                </ActionSheetRowGroup>
            ))}
        </ActionSheet>
    )
}
