import { useNavigation } from '@react-navigation/native'
import { FlashList } from '@shopify/flash-list'
import { useEffect, useState } from 'react'
import { useWindowDimensions, View } from 'react-native'
import Animated, { useAnimatedScrollHandler } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { ChannelType } from '../../core/discord/channelType'
import { GuildFeature } from '../../core/discord/guild'
import { UnreadSetting } from '../../core/discord/notificationSettings'
import { snowflakeFromTimestamp } from '../../core/discord/snowflake'
import { useSession, useSessionStore } from '../../core/react'
import { Badge } from '../../design/components/Badge'
import { RipplePressable } from '../../design/components/buttons/RipplePressable'
import { Skeleton, SkeletonPulse } from '../../design/components/Skeleton'
import {
    skeletonKeys,
    skeletonWidth,
} from '../../design/components/skeletonUtils'
import { Text } from '../../design/components/Text'
import { Icon } from '../../design/icons/Icon'
import { t } from '../../i18n'
import { channelsStore } from '../../stores/channels/channels'
import { guildsStore } from '../../stores/guilds'
import { isUnread, readStatesStore } from '../../stores/readStates'
import { setCategoryCollapsed } from '../../stores/settings/settingsActions'
import { settingsStore } from '../../stores/settings/settingsStore'
import { isChannelMuted, resolveUnreadSetting } from '../../stores/unreadPolicy'
import { openChannelActionSheet } from '../channelActions'
import { channelIcon } from './channelIcon'
import { buildChannelRows } from './channelList'
import { serversUiStore } from './store'
import { useServersPanels } from './useServersPanels'
import type { ReactElement } from 'react'
import type { SharedValue } from 'react-native-reanimated'
import type { Guild } from '../../stores/guilds'
import type { ChannelRow } from './channelList'

// Reanimated's scroll handler runs on the UI thread, so the guild header follows the list without a JS round trip.
const AnimatedFlashList = Animated.createAnimatedComponent(
    FlashList<ChannelRow>,
)

/** Channel types that open the chat panel, a forum's or media channel's showing its posts. Voice and stage do not yet. */
const TEXT_BASED: ReadonlySet<number> = new Set([
    ChannelType.GUILD_TEXT,
    ChannelType.GUILD_ANNOUNCEMENT,
    ChannelType.GUILD_FORUM,
    ChannelType.GUILD_MEDIA,
    ChannelType.ANNOUNCEMENT_THREAD,
    ChannelType.PUBLIC_THREAD,
    ChannelType.PRIVATE_THREAD,
])

function CategoryRow({
    guildId,
    id,
    collapsed,
}: {
    guildId: string
    id: string
    collapsed: boolean
}) {
    const session = useSession()
    const navigation = useNavigation()
    const name = useSessionStore(
        channelsStore,
        state => state.channels[id]?.name,
    )
    // The chevron flips on the frame of the tap; rebuilding the list (and saving) follows a frame later.
    const [shown, setShown] = useState(collapsed)
    useEffect(() => setShown(collapsed), [collapsed])
    return (
        <RipplePressable
            accessibilityRole="button"
            accessibilityState={{ expanded: !shown }}
            onPress={() => {
                const next = !shown
                setShown(next)
                requestAnimationFrame(() =>
                    setCategoryCollapsed(session, guildId, id, next),
                )
            }}
            onLongPress={() => openChannelActionSheet(id, navigation)}
            style={styles.category}
        >
            <Text
                variant="text-sm/semibold"
                color="CHANNELS_DEFAULT"
                lineClamp={1}
                style={styles.categoryText}
            >
                {name}
            </Text>
            <Icon
                name={shown ? 'ChevronSmallRightIcon' : 'ChevronSmallDownIcon'}
                size="xxs"
                color="CHANNELS_DEFAULT"
            />
        </RipplePressable>
    )
}

/** ChannelListState's FAVORITES section header: CategoryRow without a chevron, as it cannot be collapsed. */
function PinnedHeader() {
    return (
        <View style={styles.category}>
            <Text
                variant="text-sm/semibold"
                color="CHANNELS_DEFAULT"
                lineClamp={1}
                style={styles.categoryText}
            >
                {t('channelList.pinnedChannels')}
            </Text>
        </View>
    )
}

interface ChannelRowProps {
    guildId: string
    id: string
    /** Read marker for channels the user has never opened. */
    joinedAck: string
    thread?: { first: boolean; last: boolean }
}

function ChannelItem({ guildId, id, joinedAck, thread }: ChannelRowProps) {
    const session = useSession()
    const navigation = useNavigation()
    const { openChat } = useServersPanels()
    const channel = useSessionStore(channelsStore, state => state.channels[id])
    const selected = useSessionStore(
        serversUiStore,
        state => state.selectedChannelIds[guildId] === id,
    )
    const unread = useSessionStore(readStatesStore, state =>
        isUnread(state, id, joinedAck),
    )
    const mentions = useSessionStore(
        readStatesStore,
        state => state.mentions[id] ?? 0,
    )
    const lowMentions = useSessionStore(
        readStatesStore,
        state => state.lowMentions?.[id] === true,
    )
    // The new notification system: unreads of a channel set to only mentions are the less important kind.
    const guildDefault = useSessionStore(
        guildsStore,
        state => state.guilds[guildId]?.defaultMessageNotifications,
    )
    const unreadSetting = useSessionStore(settingsStore, state =>
        channel
            ? resolveUnreadSetting(state, channel, guildDefault)
            : UnreadSetting.ALL_MESSAGES,
    )
    // BaseChannelListChannel.isMuted: only the channel's own mute. A muted server or category doesn't dim its channels.
    const muted = useSessionStore(
        settingsStore,
        state => channel !== undefined && isChannelMuted(state, channel),
    )
    if (!channel) return null
    // ChannelTitle: the name is only emphasised for unreads shown in full.
    const fullUnread = unread && unreadSetting === UnreadSetting.ALL_MESSAGES
    const highlighted = selected || (fullUnread && !muted) || mentions > 0

    // Reference: Cozy layout paddingThread/marginThread; the spine and unread badge sit beside the pressable, not inside it.
    return (
        <View style={styles.row}>
            {unread && !muted && (
                <View
                    style={[
                        styles.unreadPill,
                        // ChannelUnreadBadge: MUTED_OPACITY_CONTENT unless the setting is all messages.
                        !fullUnread && styles.lessImportant,
                    ]}
                />
            )}
            {thread && <ThreadSpine {...thread} />}
            <RipplePressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                    // The chat panel follows the selected channel, so only channels it can show are selected.
                    if (!TEXT_BASED.has(channel.type)) return
                    session.get(serversUiStore).setState(state => ({
                        selectedChannelIds: {
                            ...state.selectedChannelIds,
                            [guildId]: id,
                        },
                    }))
                    openChat()
                }}
                onLongPress={() => openChannelActionSheet(id, navigation)}
                style={[
                    styles.channel,
                    selected && styles.channelSelected,
                    muted && !selected && styles.muted,
                ]}
            >
                {!thread && (
                    <Icon
                        name={channelIcon(channel.type)}
                        size="sm"
                        color={
                            highlighted
                                ? 'INTERACTIVE_ICON_ACTIVE'
                                : 'CHANNEL_ICON'
                        }
                    />
                )}
                <Text
                    variant={fullUnread ? 'text-md/semibold' : 'text-md/medium'}
                    color={
                        highlighted
                            ? 'INTERACTIVE_TEXT_ACTIVE'
                            : 'CHANNELS_DEFAULT'
                    }
                    lineClamp={1}
                    style={styles.channelName}
                >
                    {channel.name}
                </Text>
                <Badge count={mentions} lowImportance={lowMentions} />
            </RipplePressable>
        </View>
    )
}

/** GuildRolesAndChannelsRow: opens Channels & Roles, or Browse Channels where the server has no questions. */
function BrowseChannelsRow({ guild }: { guild: Guild }) {
    const navigation = useNavigation<{
        navigate: (route: 'channelBrowser', params: { guildId: string }) => void
    }>()
    const label = guild.features?.includes(
        GuildFeature.GUILD_ONBOARDING_HAS_PROMPTS,
    )
        ? t('channelsAndRoles.title')
        : t('channelBrowser.title')
    return (
        <View style={styles.row}>
            <RipplePressable
                accessibilityRole="button"
                accessibilityLabel={label}
                onPress={() =>
                    navigation.navigate('channelBrowser', {
                        guildId: guild.id,
                    })
                }
                style={styles.channel}
            >
                <Icon
                    name="ChannelListMagnifyingGlassIcon"
                    size="sm"
                    color="CHANNEL_ICON"
                />
                <Text
                    variant="text-md/medium"
                    color="CHANNELS_DEFAULT"
                    lineClamp={1}
                    style={styles.channelName}
                >
                    {label}
                </Text>
            </RipplePressable>
        </View>
    )
}

/**
 * ThreadChannel's spine: each thread row draws its own part of the line (threadLineSegment), so nothing reaches
 * into the parent channel's row; the first starts 2 below the row's top with a rounded end, the last stops just
 * past the curve. SpineCurveSvg bends the line into the row's middle.
 */
function ThreadSpine({ first, last }: { first: boolean; last: boolean }) {
    const { theme } = useUnistyles()
    const { fontScale } = useWindowDimensions()
    return (
        <View style={styles.spineBox}>
            <View
                style={[
                    styles.spineLine,
                    first && styles.spineLineFirst,
                    last && styles.spineLineLast(fontScale),
                ]}
            />
            <Svg width={12} height={16} style={styles.spineCurve}>
                <Path
                    fill={theme.colors.SPINE_DEFAULT}
                    d="M11 16C11.5523 16 12 15.5523 12 15C12 14.4477 11.5523 14 11 14H8C2.47715 14 2 8.52285 2 3V0H0V3H0.00542736C0 9.5 1.49449 16 8 16H11Z"
                />
            </Svg>
        </View>
    )
}

const SKELETON_ROWS = 10

/** Placeholder channels while the first READY is awaited; the reference has none, so this uses the channel row's metrics. */
export function ChannelListSkeleton() {
    return (
        <SkeletonPulse style={styles.content}>
            {skeletonKeys(SKELETON_ROWS).map((key, index) => (
                // Nested like ChannelItem: `channel` has flex 1 to fill the row's width, which in the
                // column would collapse each row's height.
                <View key={key} style={styles.row}>
                    <View style={styles.channel}>
                        <Skeleton width={20} height={20} radius={10} />
                        <Skeleton
                            width={skeletonWidth(index + 1, 30, 80)}
                            height={16}
                        />
                    </View>
                </View>
            ))}
        </SkeletonPulse>
    )
}

/**
 * The selected server's channels, grouped by category. `header` is the top of the scroll content (banner and room
 * for the guild header drawn over it); the scroll offset goes to `scrollY`.
 */
export function ChannelList({
    guild,
    header,
    scrollY,
}: {
    guild: Guild
    header: ReactElement
    scrollY: SharedValue<number>
}) {
    const session = useSession()
    const ids = useSessionStore(channelsStore, state => state.byGuild[guild.id])
    const channels = useSessionStore(channelsStore, state => state.channels)
    const settings = useSessionStore(
        settingsStore,
        state => state.guildSettings[guild.id],
    )
    const selectedChannelId = useSessionStore(
        serversUiStore,
        state => state.selectedChannelIds[guild.id],
    )
    // Thread rows depend on unreads, mentions and newest messages.
    const readStates = useSessionStore(readStatesStore, state => state)
    const rows = buildChannelRows(
        guild,
        ids ?? [],
        channels,
        settings,
        session,
        selectedChannelId,
        readStates,
    )
    const joinedAck = snowflakeFromTimestamp(new Date(guild.joinedAt).getTime())

    const renderItem = ({ item }: { item: ChannelRow }) => {
        if (item.type === 'spacer') return <View style={styles.spacer} />
        if (item.type === 'browse') return <BrowseChannelsRow guild={guild} />
        if (item.type === 'divider') return <View style={styles.divider} />
        if (item.type === 'pinned') return <PinnedHeader />
        if (item.type === 'category')
            return (
                <CategoryRow
                    guildId={guild.id}
                    id={item.id}
                    collapsed={item.collapsed}
                />
            )
        return (
            <ChannelItem
                guildId={guild.id}
                id={item.id}
                joinedAck={joinedAck}
                thread={
                    item.type === 'thread'
                        ? { first: item.first, last: item.last }
                        : undefined
                }
            />
        )
    }

    const onScroll = useAnimatedScrollHandler(event => {
        scrollY.set(event.contentOffset.y)
    })

    return (
        <AnimatedFlashList
            data={rows}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            getItemType={item => item.type}
            contentContainerStyle={styles.content}
            ListHeaderComponent={header}
            onScroll={onScroll}
            scrollEventThrottle={16}
            ListEmptyComponent={
                <Text color="TEXT_MUTED" style={styles.empty}>
                    {t('servers.noChannels')}
                </Text>
            }
        />
    )
}

const SPINE_WIDTH = 2
// Under the parent channel's icon: the pressable's 8 padding plus half the 20 icon, minus half the line.
const SPINE_LEFT = 16

const styles = StyleSheet.create(theme => ({
    content: { paddingBottom: theme.space.PX_24 },
    empty: { padding: theme.space.PX_16, textAlign: 'center' },
    spacer: { height: theme.space.PX_8 },
    // channel_list_v2 Divider.
    divider: {
        height: 1,
        backgroundColor: theme.colors.BORDER_SUBTLE,
        marginVertical: theme.space.PX_8,
        marginHorizontal: theme.space.PX_16,
    },
    // CATEGORY_MARGIN_TOP, CATEGORY_VERTICAL_PADDING and CATEGORY_MARGIN_BOTTOM in the reference client.
    category: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.PX_4,
        marginTop: theme.space.PX_12,
        marginBottom: theme.space.PX_4,
        paddingVertical: theme.space.PX_4,
        // The name lines up with the channel icons below (8 margin + 8 padding).
        paddingLeft: theme.space.PX_16,
        paddingRight: theme.space.PX_16,
    },
    categoryText: { flexShrink: 1 },
    row: { flexDirection: 'row', marginHorizontal: theme.space.PX_8 },
    channel: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.PX_8,
        padding: theme.space.PX_8,
        borderRadius: theme.modules.mobile.CHANNEL_ITEM_RADIUS,
    },
    channelSelected: {
        backgroundColor: theme.colors.MOBILE_CHANNEL_ITEM_BACKGROUND_SELECTED,
    },
    // The reference dims the label of muted channels to half opacity.
    muted: { opacity: 0.5 },
    channelName: { flex: 1 },
    // RedesignChannelListConstants.MUTED_OPACITY_CONTENT.
    lessImportant: { opacity: 0.5 },
    unreadPill: {
        position: 'absolute',
        left: -theme.space.PX_8,
        // Centered on the row (height 8); the row can't use alignItems: center or the spine and pressable would not stretch.
        top: '50%',
        marginTop: -4,
        width: 4,
        height: 8,
        borderTopRightRadius: 4,
        borderBottomRightRadius: 4,
        backgroundColor: theme.colors.INTERACTIVE_TEXT_ACTIVE,
    },
    // Threads hang off a spine under their parent channel's icon (x = SPINE_LEFT). The curve is 12 wide and the
    // pressable starts 4 after it.
    spineBox: {
        width: SPINE_LEFT + 12 + theme.space.PX_4,
        alignSelf: 'stretch',
    },
    // ThreadChannel threadLineSegment.
    spineLine: {
        position: 'absolute',
        left: SPINE_LEFT,
        top: 0,
        height: '100%',
        width: SPINE_WIDTH,
        backgroundColor: theme.colors.SPINE_DEFAULT,
    },
    spineLineFirst: {
        top: 2,
        borderTopLeftRadius: theme.radii.round,
        borderTopRightRadius: theme.radii.round,
    },
    spineLineLast: (fontScale: number) => ({
        height: Math.ceil(Math.max(8, 1.2 * fontScale * 8)),
        borderBottomLeftRadius: theme.radii.round,
        borderBottomRightRadius: theme.radii.round,
    }),
    // SpineCurveSvg: top = row height / 2 - 16 + 2, so the curve ends on the row's middle.
    spineCurve: {
        position: 'absolute',
        left: SPINE_LEFT,
        top: '50%',
        marginTop: -14,
    },
}))
