import { useNavigation } from '@react-navigation/native'
import { FlashList } from '@shopify/flash-list'
import { useEffect, useRef } from 'react'
import { Pressable, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { useShallow } from 'zustand/react/shallow'
import {
    compareSnowflakes,
    snowflakeTimestamp,
} from '../../core/discord/snowflake'
import { useSession, useSessionReady, useSessionStore } from '../../core/react'
import { MINUTE } from '../../core/time'
import { StatusAvatar } from '../../design/components/avatars/StatusAvatar'
import { Badge } from '../../design/components/Badge'
import { Ellipsis } from '../../design/components/Ellipsis'
import { Skeleton, SkeletonPulse } from '../../design/components/Skeleton'
import {
    skeletonKeys,
    skeletonWidth,
} from '../../design/components/skeletonUtils'
import { Text } from '../../design/components/Text'
import { Icon } from '../../design/icons/Icon'
import { t } from '../../i18n'
import { splashContentNativeId } from '../../native/NativeIsocordConstants'
import SpanTextView from '../../native/SpanTextViewNativeComponent'
import { channelsStore } from '../../stores/channels/channels'
import { dmPreviewsStore } from '../../stores/channels/dmPreviews'
import { isUnread, readStatesStore } from '../../stores/readStates'
import { settingsStore } from '../../stores/settings/settingsStore'
import { isMuted } from '../../stores/unreadPolicy'
import { openChannelActionSheet } from '../channelActions'
import { useChatTheme } from '../chat/rows/rowEncoder'
import { TypingText } from '../chat/typing'
import { useTypingUserIds } from '../chat/useTypingUserIds'
import { useTabSelected } from '../main/useTabSelected'
import { UnreadBar } from '../servers/UnreadBar'
import { useUnreadBars } from '../servers/useUnreadBars'
import { GroupAvatar } from './GroupAvatar'
import { previewIcon, previewPrefix, usePreviewSpans } from './preview'
import { useDm } from './useDm'
import { useMessagesPanels } from './useMessagesPanels'
import { useMinute } from './useMinute'
import type { FlashListRef } from '@shopify/flash-list'

const AVATAR_SIZE = 40

/** Compact age of the last message, as shown at the end of a conversation row. */
function relativeTime(timestamp: number, now: number): string {
    const minutes = Math.floor((now - timestamp) / MINUTE)
    if (minutes < 1) return t('time.now')
    if (minutes < 60) return t('time.minutes', { count: minutes })
    if (minutes < 1440)
        return t('time.hours', { count: Math.floor(minutes / 60) })
    const days = Math.floor(minutes / 1440)
    if (days < 30) return t('time.days', { count: days })
    if (days < 365) return t('time.months', { count: Math.floor(days / 30) })
    return t('time.years', { count: Math.floor(days / 365) })
}

function ConversationRow({ id }: { id: string }) {
    const { openChat } = useMessagesPanels()
    const { userId } = useSession()
    const navigation = useNavigation()
    const dm = useDm(id)
    const lastMessageId = useSessionStore(
        readStatesStore,
        state => state.lastMessageIds[id] ?? undefined,
    )
    const message = useSessionStore(
        dmPreviewsStore,
        state => state.messages[id],
    )
    const unread = useSessionStore(readStatesStore, state =>
        isUnread(state, id),
    )
    const mentions = useSessionStore(
        readStatesStore,
        state => state.mentions[id] ?? 0,
    )
    const muted = useSessionStore(settingsStore, state =>
        isMuted(state, { id }),
    )
    const typingUserIds = useTypingUserIds(id)
    const chatTheme = useChatTheme('transparent')
    // A cached preview older than the channel's newest message is stale: show none rather than a wrong one.
    const fresh =
        message &&
        (!lastMessageId || compareSnowflakes(message.id, lastMessageId) >= 0)
    const spans = usePreviewSpans(fresh ? message : undefined, userId)
    const now = useMinute()
    const { theme } = useUnistyles()
    if (!dm) return null

    const showUnread = unread && !muted
    const previewVariant = theme.text['text-sm/medium']
    const highlighted = showUnread || (mentions > 0 && !muted)

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={dm.name}
            onPress={() => openChat(id)}
            onLongPress={() => openChannelActionSheet(id, navigation)}
            style={styles.row}
            android_ripple={styles.ripple}
        >
            {dm.recipient ? (
                <StatusAvatar
                    user={dm.recipient}
                    size={AVATAR_SIZE}
                    status={dm.presence?.status ?? 'offline'}
                    mobile={dm.presence?.mobile}
                    streaming={dm.presence?.streaming}
                    // CutoutBackgroundProvider: the row has no background of its own (pressing it is a ripple),
                    // so the tab's background is behind the avatar.
                    cutoutBackground={theme.colors.BACKGROUND_BASE_LOWER}
                />
            ) : (
                <GroupAvatar
                    id={id}
                    name={dm.name}
                    icon={dm.icon}
                    size={AVATAR_SIZE}
                />
            )}
            <View style={styles.label}>
                {/* modules.mobile.MESSAGES_ITEM_CHANNEL_NAME_TEXT_STYLE in every state; only the colour changes. */}
                <Text
                    variant="text-md/medium"
                    color={
                        highlighted
                            ? 'TEXT_STRONG'
                            : muted
                              ? 'TEXT_MUTED'
                              : 'MESSAGES_ITEM_CHANNEL_TEXT_DEFAULT'
                    }
                    lineClamp={1}
                >
                    {dm.name}
                </Text>
                {/* Someone typing takes the preview's place until they stop or their message arrives. */}
                {typingUserIds.length > 0 ? (
                    <View style={styles.typing}>
                        <Ellipsis />
                        <TypingText
                            channelId={id}
                            userIds={typingUserIds}
                            variant="text-sm/medium"
                            boldVariant="text-sm/bold"
                            color={showUnread ? 'TEXT_DEFAULT' : 'TEXT_MUTED'}
                        />
                    </View>
                ) : spans && message ? (
                    // ChannelRowPreview's markup: emoji, mentions and inline formatting, drawn natively.
                    <SpanTextView
                        spans={spans}
                        theme={chatTheme}
                        color={
                            showUnread
                                ? theme.colors.TEXT_DEFAULT
                                : theme.colors.TEXT_MUTED
                        }
                        fontSize={previewVariant.fontSize}
                        lineHeight={previewVariant.lineHeight}
                        prefix={previewPrefix(message, userId, dm.isGroup)}
                        trailingIcon={previewIcon(message, userId)}
                        lineClamp={1}
                        style={{ height: previewVariant.lineHeight }}
                    />
                ) : null}
            </View>
            <View style={styles.trailing}>
                {lastMessageId ? (
                    <Text
                        variant="text-xs/medium"
                        color={showUnread ? 'TEXT_DEFAULT' : 'TEXT_MUTED'}
                    >
                        {relativeTime(snowflakeTimestamp(lastMessageId), now)}
                    </Text>
                ) : null}
                {muted ? (
                    <Icon name="BellSlashIcon" size="xs" color="TEXT_MUTED" />
                ) : null}
                {mentions > 0 ? (
                    <Badge count={mentions} />
                ) : showUnread ? (
                    <View style={styles.unreadDot} />
                ) : null}
            </View>
        </Pressable>
    )
}

const renderItem = ({ item }: { item: string }) => <ConversationRow id={item} />

const SKELETON_ROWS = 12

/** UserPlaceholderRow rows (32 high avatar, 20 high name at 40-80% width, pulsing) in the conversation row's box. */
function ConversationSkeleton() {
    return (
        <SkeletonPulse>
            {skeletonKeys(SKELETON_ROWS).map((key, index) => (
                <View key={key} style={styles.row}>
                    <Skeleton
                        width={AVATAR_SIZE}
                        height={AVATAR_SIZE}
                        radius={16}
                    />
                    <View style={styles.label}>
                        <Skeleton
                            width={skeletonWidth(index + 1, 40, 80)}
                            height={20}
                        />
                    </View>
                </View>
            ))}
        </SkeletonPulse>
    )
}

export function MessagesTab() {
    const focused = useTabSelected()
    const navigation = useNavigation()
    const { setTabFocused } = useMessagesPanels()
    // The chat panel only takes swipes and counts as visible while this tab is the selected one.
    useEffect(() => {
        setTabFocused(focused)
        return () => setTabFocused(false)
    }, [focused, setTabFocused])
    const privateIds = useSessionStore(channelsStore, state => state.privateIds)
    const session = useSession()
    const ready = useSessionReady()
    // Most recent conversation first; one that never had a message sorts by its creation. Guild messages change
    // lastMessageIds too, but the sorted id list stays shallow-equal, so this only re-renders on a real reorder.
    const ids = useSessionStore(
        readStatesStore,
        useShallow(state => {
            const channels = session.get(channelsStore).getState().channels
            const newest = (id: string) =>
                state.lastMessageIds[id] ?? channels[id]?.last_message_id ?? id
            return [...privateIds].sort((a, b) =>
                compareSnowflakes(newest(b), newest(a)),
            )
        }),
    )

    // ChannelsUnreadBars: conversations with mentions or unreads the bars can point at.
    // Every private channel notifies, so an unread one shows unless it is muted.
    const readStates = useSessionStore(readStatesStore, state => state)
    const barRows = ids.flatMap((id, index) => {
        const count = readStates.mentions[id] ?? 0
        const mention = count > 0
        const unread = !mention && isUnread(readStates, id)
        if (!mention && !unread) return []
        return [{ index, mention }]
    })
    const unreadBars = useUnreadBars(barRows)
    const listRef = useRef<FlashListRef<string>>(null)

    return (
        <View nativeID={splashContentNativeId} style={styles.container}>
            <View style={styles.header}>
                <Text
                    variant="heading-xl/bold"
                    color="MOBILE_TEXT_HEADING_PRIMARY"
                >
                    {t('messages.title')}
                </Text>
                <View style={styles.actions}>
                    {/* Not wired up yet. */}
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('messages.addFriend')}
                        android_ripple={styles.ripple}
                        style={styles.action}
                    >
                        <Icon name="UserPlusIcon" size="sm" />
                    </Pressable>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('messages.newMessage')}
                        android_ripple={styles.ripple}
                        style={styles.action}
                    >
                        <Icon name="ChatPlusIcon" size="sm" />
                    </Pressable>
                </View>
            </View>
            {/* MainNavigator "search": opens the DMS search over the tabs. */}
            <Pressable
                accessibilityRole="search"
                accessibilityLabel={t('messages.search')}
                onPress={() => navigation.navigate('globalSearch')}
                android_ripple={styles.ripple}
                style={styles.search}
            >
                <Icon name="MagnifyingGlassIcon" size="sm" color="TEXT_MUTED" />
                <Text variant="text-md/medium" color="TEXT_MUTED">
                    {t('messages.search')}
                </Text>
            </Pressable>
            <View style={styles.listContainer}>
                <FlashList
                    ref={listRef}
                    data={ids}
                    renderItem={renderItem}
                    keyExtractor={id => id}
                    contentContainerStyle={styles.content}
                    onViewableItemsChanged={unreadBars.onViewableItemsChanged}
                    viewabilityConfig={unreadBars.viewabilityConfig}
                    ListEmptyComponent={
                        ready ? (
                            <Text color="TEXT_MUTED" style={styles.empty}>
                                {t('messages.empty')}
                            </Text>
                        ) : (
                            <ConversationSkeleton />
                        )
                    }
                />
                <UnreadBar
                    position="top"
                    mention={unreadBars.target?.row.mention === true}
                    shown={unreadBars.target?.edge === 'top'}
                    onPress={() =>
                        unreadBars.jump(index =>
                            listRef.current?.scrollToIndex({
                                index,
                                viewPosition: 0.5,
                                animated: true,
                            }),
                        )
                    }
                    style={styles.barTop}
                />
                <UnreadBar
                    position="bottom"
                    mention={unreadBars.target?.row.mention === true}
                    shown={unreadBars.target?.edge === 'bottom'}
                    onPress={() =>
                        unreadBars.jump(index =>
                            listRef.current?.scrollToIndex({
                                index,
                                viewPosition: 0.5,
                                animated: true,
                            }),
                        )
                    }
                    style={styles.barBottom}
                />
            </View>
        </View>
    )
}

const styles = StyleSheet.create((theme, runtime) => ({
    container: {
        flex: 1,
        paddingTop: runtime.insets.top,
        backgroundColor: theme.colors.BACKGROUND_BASE_LOWER,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: theme.space.PX_16,
        paddingTop: theme.space.PX_16,
        paddingBottom: theme.modules.mobile.MESSAGES_HEADER_PADDING_BOTTOM,
    },
    actions: { flexDirection: 'row', gap: theme.space.PX_8 },
    action: {
        width: 36,
        height: 36,
        borderRadius: 18,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.BACKGROUND_MOD_SUBTLE,
    },
    search: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.PX_8,
        height: 40,
        marginHorizontal: theme.space.PX_16,
        marginBottom: theme.space.PX_8,
        paddingHorizontal: theme.space.PX_12,
        borderRadius: theme.radii.round,
        overflow: 'hidden',
        backgroundColor: theme.colors.BACKGROUND_MOD_SUBTLE,
    },
    content: { paddingBottom: theme.space.PX_24 },
    // The bars float over the list (ChannelsUnreadBars' wrapper).
    listContainer: { flex: 1 },
    barTop: { top: 0 },
    barBottom: { bottom: 0 },
    empty: { padding: theme.space.PX_16, textAlign: 'center' },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.space.PX_16,
        paddingVertical: theme.space.PX_8,
        minHeight: 56,
    },
    ripple: { color: theme.colors.MOBILE_ANDROID_BUTTON_BACKGROUND_RIPPLE },
    label: {
        flex: 1,
        marginLeft:
            theme.modules.mobile.MESSAGES_ITEM_CHANNEL_AVATAR_MARGIN_END,
        marginRight: theme.space.PX_8,
    },
    // Like the composer's typing indicator (CustomTypingIndicatorDisplay's Stack), but closer for the smaller text.
    typing: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.PX_4,
    },
    trailing: { alignItems: 'flex-end', gap: theme.space.PX_4 },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: theme.colors.BADGE_NOTIFICATION_BACKGROUND,
    },
}))
