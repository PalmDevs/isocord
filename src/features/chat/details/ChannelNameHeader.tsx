import { View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { ChannelType } from '../../../core/discord/channelType'
import { useSession, useSessionStore } from '../../../core/react'
import { StatusAvatar } from '../../../design/components/avatars/StatusAvatar'
import { RipplePressable } from '../../../design/components/buttons/RipplePressable'
import { Text } from '../../../design/components/Text'
import { Icon } from '../../../design/icons/Icon'
import { t } from '../../../i18n'
import { channelsStore, isPrivate } from '../../../stores/channels/channels'
import { usersStore } from '../../../stores/users'
import { GroupAvatar } from '../../messages/GroupAvatar'
import { useDm } from '../../messages/useDm'
import { useChannelIcon } from '../../servers/channelIcon'
import { openUserProfile } from '../headerActions'
import type { MessageKey } from '../../../i18n'

const ICON_BOX = 40

const TYPE_KEYS: Record<number, MessageKey> = {
    [ChannelType.GUILD_TEXT]: 'details.channelType.text',
    [ChannelType.GUILD_VOICE]: 'details.channelType.voice',
    [ChannelType.GUILD_ANNOUNCEMENT]: 'details.channelType.announcement',
    [ChannelType.GUILD_FORUM]: 'details.channelType.forum',
    [ChannelType.GUILD_MEDIA]: 'details.channelType.media',
    [ChannelType.GUILD_STAGE_VOICE]: 'details.channelType.stage',
    [ChannelType.GUILD_CATEGORY]: 'details.channelType.category',
    [ChannelType.ANNOUNCEMENT_THREAD]: 'details.channelType.thread',
    [ChannelType.PUBLIC_THREAD]: 'details.channelType.thread',
    [ChannelType.PRIVATE_THREAD]: 'details.channelType.privateThread',
}

/**
 * ChannelNameHeader: the channel's icon, name and what it is. A guild channel has its icon in a rounded box and its
 * type under the name. A DM has the person's avatar with status and their username, and tapping it opens their
 * profile; a group DM has its icon and the names of its people.
 */
export function ChannelNameHeader({ channelId }: { channelId: string }) {
    const session = useSession()
    const channel = useSessionStore(
        channelsStore,
        state => state.channels[channelId],
    )
    const dm = useDm(channelId)
    const icon = useChannelIcon(channel)
    const { theme } = useUnistyles()
    // Joined inside the selector: a fresh array each read would never compare equal and re-render forever.
    const recipientNames = useSessionStore(usersStore, state =>
        (channel?.recipient_ids ?? [])
            .map(id => state.users[id]?.username ?? '')
            .join('\u0000'),
    )
    if (!channel) return null

    if (!isPrivate(channel) || !dm) {
        const typeKey = TYPE_KEYS[channel.type]
        return (
            <View style={styles.container}>
                <View style={[styles.icon, styles.typeBox]}>
                    <Icon
                        name={icon}
                        size="md"
                        color="MOBILE_TEXT_HEADING_PRIMARY"
                    />
                </View>
                <View style={styles.data}>
                    <Text
                        variant="redesign/heading-18/bold"
                        color="MOBILE_TEXT_HEADING_PRIMARY"
                        lineClamp={1}
                    >
                        {channel.name ?? ''}
                    </Text>
                    {typeKey && (
                        <Text
                            variant="text-sm/medium"
                            color="TEXT_MUTED"
                            lineClamp={1}
                        >
                            {t(typeKey)}
                        </Text>
                    )}
                </View>
            </View>
        )
    }

    // getPrivateChannelUserTagsString: the first two names, then how many more.
    const names = recipientNames.split('\u0000').filter(Boolean)
    const subtitle =
        names.length > 2
            ? t(names.length === 3 ? 'details.tags.one' : 'details.tags.many', {
                  user1: names[0] ?? '',
                  user2: names[1] ?? '',
                  extras: names.length - 2,
              })
            : names.length === 2
              ? t('details.tags.two', {
                    user1: names[0] ?? '',
                    user2: names[1] ?? '',
                })
              : (names[0] ?? '')
    const recipientId = channel.recipient_ids?.[0]

    const content = (
        <>
            <View style={styles.icon}>
                {dm.recipient ? (
                    <StatusAvatar
                        user={dm.recipient}
                        size={ICON_BOX}
                        status={
                            dm.presence?.status === 'offline'
                                ? undefined
                                : dm.presence?.status
                        }
                        mobile={dm.presence?.mobile}
                        streaming={dm.presence?.streaming}
                        // CutoutBackgroundProvider: the details' background, behind the header.
                        cutoutBackground={
                            theme.colors.MOBILE_ACTIONSHEET_BACKGROUND
                        }
                    />
                ) : (
                    <GroupAvatar
                        id={channelId}
                        name={dm.name}
                        icon={dm.icon}
                        size={32}
                    />
                )}
            </View>
            <View style={styles.data}>
                <Text
                    variant="redesign/heading-18/bold"
                    color="MOBILE_TEXT_HEADING_PRIMARY"
                    lineClamp={1}
                >
                    {dm.name}
                </Text>
                {subtitle !== '' && (
                    <Text
                        variant="text-sm/medium"
                        color="TEXT_MUTED"
                        lineClamp={1}
                    >
                        {subtitle}
                    </Text>
                )}
            </View>
        </>
    )
    return dm.isGroup || !recipientId ? (
        <View style={styles.container}>{content}</View>
    ) : (
        <RipplePressable
            accessibilityRole="button"
            accessibilityLabel={dm.name}
            onPress={() => openUserProfile(session, recipientId)}
            style={styles.container}
        >
            {content}
        </RipplePressable>
    )
}

const styles = StyleSheet.create(theme => ({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.PX_12,
    },
    icon: {
        width: ICON_BOX,
        height: ICON_BOX,
        justifyContent: 'center',
        alignItems: 'center',
    },
    typeBox: {
        borderRadius: theme.modules.mobile.CHANNEL_NAME_CHANNEL_ICON_RADIUS,
        borderWidth: theme.modules.mobile.CHANNEL_NAME_CHANNEL_BORDER_WIDTH,
        borderColor: theme.colors.BORDER_SUBTLE,
        backgroundColor: theme.colors.BACKGROUND_MOD_MUTED,
    },
    data: { flex: 1 },
}))
