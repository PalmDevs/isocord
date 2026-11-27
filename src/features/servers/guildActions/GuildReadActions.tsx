import { ChannelType } from '../../../core/discord/channelType'
import { GuildFeature } from '../../../core/discord/guild'
import {
    computePermissions,
    Permission,
} from '../../../core/discord/permissions'
import { useSession } from '../../../core/react'
import {
    ActionSheetRow,
    ActionSheetRowGroup,
    ActionSheetRowIcon,
} from '../../../design/components/sheets/Sheet'
import { useCloseSheet } from '../../../design/components/sheets/sheetContext'
import { t } from '../../../i18n'
import { ackGuild } from '../../../stores/readStates'
import { openCreateChannel } from '../../channelSettings'
import { openChannelBrowser } from '../../chat/links/openChannel'
import { useGuildHasUnread } from './useGuildHasUnread'
import type { Guild } from '../../../stores/guilds'
import type { GuildActionNavigation } from './types'

/** Mark as read, channel browser and the create channel and category rows. */
export function GuildReadActions({
    guild,
    navigation,
}: {
    guild: Guild
    navigation?: GuildActionNavigation
}) {
    const session = useSession()
    const close = useCloseSheet()
    const hasUnread = useGuildHasUnread(guild.id)
    const isCommunity =
        guild.features?.includes(GuildFeature.COMMUNITY) ?? false
    const isHub = guild.features?.includes(GuildFeature.HUB) ?? false
    const onboarding =
        guild.features?.includes(GuildFeature.GUILD_ONBOARDING_HAS_PROMPTS) ??
        false
    const canManageChannels =
        (computePermissions(guild, undefined, session.userId) &
            Permission.MANAGE_CHANNELS) !==
        0n

    const openBrowser = () => {
        close()
        if (navigation)
            navigation.navigate('channelBrowser', { guildId: guild.id })
        else openChannelBrowser(guild.id, 'customize')
    }

    return (
        <ActionSheetRowGroup hasIcons>
            <ActionSheetRow
                icon={<ActionSheetRowIcon name="EyeIcon" />}
                label={t('chat.markAsRead')}
                disabled={!hasUnread}
                onPress={() => {
                    close()
                    ackGuild(session, guild.id)
                }}
            />
            {isCommunity && !isHub && (
                <ActionSheetRow
                    icon={
                        <ActionSheetRowIcon name="ChannelListMagnifyingGlassIcon" />
                    }
                    label={t(
                        onboarding
                            ? 'channelsAndRoles.title'
                            : 'channelBrowser.title',
                    )}
                    arrow
                    onPress={openBrowser}
                />
            )}
            {canManageChannels && navigation && (
                <>
                    <ActionSheetRow
                        icon={<ActionSheetRowIcon name="PlusLargeIcon" />}
                        label={t('channelActions.createChannel')}
                        arrow
                        onPress={() => {
                            close()
                            openCreateChannel(navigation, guild.id)
                        }}
                    />
                    <ActionSheetRow
                        icon={<ActionSheetRowIcon name="FolderPlusIcon" />}
                        label={t('createChannel.createCategory')}
                        arrow
                        onPress={() => {
                            close()
                            openCreateChannel(
                                navigation,
                                guild.id,
                                ChannelType.GUILD_CATEGORY,
                            )
                        }}
                    />
                </>
            )}
        </ActionSheetRowGroup>
    )
}
