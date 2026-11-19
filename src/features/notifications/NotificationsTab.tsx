import { useIsFocused } from '@react-navigation/native'
import { useEffect } from 'react'
import { View } from 'react-native'
import { StyleSheet, UnistylesRuntime } from 'react-native-unistyles'
import { guildIconUrl } from '../../core/discord/cdn'
import { useSession, useSessionStore } from '../../core/react'
import { guildAcronym } from '../../design/components/avatars/guildAcronym'
import { Text } from '../../design/components/Text'
import { Icon } from '../../design/icons/Icon'
import { t } from '../../i18n'
import SearchResultsView from '../../native/SearchResultsViewNativeComponent'
import { channelsStore } from '../../stores/channels/channels'
import { guildsStore } from '../../stores/guilds'
import { membersStore, requestMembers } from '../../stores/members'
import { readStatesStore } from '../../stores/readStates'
import { usersStore } from '../../stores/users'
import { parseChatLink } from '../chat/links/chatLink'
import { useChatTheme } from '../chat/rows/rowEncoder'
import {
    RESULT_MAX_CONTENT_HEIGHT,
    SEARCH_ROW_TAP_STATE_PADDING,
} from '../search/messages/constants'
import { resultRow } from '../search/messages/resultRow'
import { useOpenSearchPreview } from '../search/useOpenSearchPreview'
import { initialPageSize, isMentionItem, isUnreadMention } from './api'
import { showNotificationItemActions } from './itemActions'
import { notificationsStore } from './store'
import type { Channel } from '../../stores/channels/channels'
import type { SearchRow } from '../search/messages/resultRow'
import type { NotificationItem } from './api'

/** Lines of a mention's text before it is cut. */
const LINE_CLAMP = 3
const NO_WORDS = new Set<string>()
const LOADING_ROW = JSON.stringify({
    type: 'loading',
    key: 'loading',
} satisfies SearchRow)
/**
 * The loading row alone, before any mention: its own key, so the list does not keep it in place (at the bottom of
 * the first page) when the results arrive above it.
 */
const FIRST_LOADING_ROW = JSON.stringify({
    type: 'loading',
    key: 'first-loading',
} satisfies SearchRow)

/** The server of a mention's message, from its channel when the client has it. */
function guildOf(
    item: NotificationItem,
    channels: Record<string, Channel>,
): string | undefined {
    const message = item.message
    return (
        (message && channels[message.channel_id]?.guild_id) ??
        item.guild_id ??
        message?.guild_id
    )
}

/**
 * The Notifications tab: for now its Recent Activity, the notification centre's mention items (NotificationCenterForYou
 * with mentions), drawn as search results that take taps only as a whole. A tap opens the message in the search
 * preview panel (hosted by MainTabs, over the tab bar), with "Jump to Message" to its chat.
 */
export function NotificationsTab() {
    const session = useSession()
    const themeJson = useChatTheme('transparent')
    const focused = useIsFocused()
    const openPreview = useOpenSearchPreview()

    const items = useSessionStore(notificationsStore, store => store.items)
    const hasMore = useSessionStore(notificationsStore, store => store.hasMore)
    const loading = useSessionStore(notificationsStore, store => store.loading)
    const refreshing = useSessionStore(
        notificationsStore,
        store => store.refreshing,
    )
    const error = useSessionStore(notificationsStore, store => store.error)
    const channels = useSessionStore(channelsStore, store => store.channels)
    const guilds = useSessionStore(guildsStore, store => store.guilds)
    const members = useSessionStore(membersStore, store => store.members)
    const users = useSessionStore(usersStore, store => store.users)
    const acks = useSessionStore(readStatesStore, store => store.acks)

    // The first page is fetched again every time the tab is shown; the cached items stay up meanwhile.
    useEffect(() => {
        if (!focused) return
        session
            .get(notificationsStore)
            .getState()
            .refresh(initialPageSize(UnistylesRuntime.screen.height))
    }, [session, focused])

    const mentions = items.filter(isMentionItem)

    // Roles colour a name only for members the client has; the others are asked for.
    useEffect(() => {
        const authors = new Map<string, string[]>()
        for (const item of mentions) {
            const guildId = guildOf(item, channels)
            if (!guildId || !item.message) continue
            const ids = authors.get(guildId) ?? []
            ids.push(item.message.author.id)
            authors.set(guildId, ids)
        }
        for (const [guildId, ids] of authors)
            requestMembers(session, guildId, ids)
    }, [session, mentions, channels])

    const parts: string[] = []
    for (const item of mentions) {
        if (!item.message) continue
        const guildId = guildOf(item, channels)
        const row = resultRow(session, item.message, {
            guild: guildId ? guilds[guildId] : undefined,
            members: guildId ? members[guildId] : undefined,
            users,
            channels,
            words: NO_WORDS,
            lineClamp: LINE_CLAMP,
        })
        if (!row.message) continue
        const unread = isUnreadMention(item, acks)
        // Server channels only: the server's icon before the channel, its name after.
        const guild = row.channelName && guildId ? guilds[guildId] : undefined
        parts.push(
            JSON.stringify({
                ...row,
                key: item.id,
                guildName: guild?.name,
                guildIconUrl: guild?.icon
                    ? guildIconUrl(guild.id, guild.icon, 64)
                    : undefined,
                guildAcronym: guild && guildAcronym(guild.name).slice(0, 1),
                read: !unread,
                // Unread ones carry the chat's mention highlight.
                message: { ...row.message, mentioned: unread },
            }),
        )
    }
    // Also while no mention has come yet: a page can hold only other items, and the next is asked for.
    if (hasMore && !(error && parts.length === 0))
        parts.push(parts.length > 0 ? LOADING_ROW : FIRST_LOADING_ROW)
    const rows = `[${parts.join(',')}]`

    const onLinkPress = (event: { nativeEvent: { url: string } }) => {
        // Only whole results are pressed.
        const link = parseChatLink(event.nativeEvent.url)
        if (link?.kind === 'result') openPreview(link.channelId, link.messageId)
    }
    const onResultLongPress = (event: { nativeEvent: { key: string } }) => {
        const item = mentions.find(known => known.id === event.nativeEvent.key)
        if (item)
            showNotificationItemActions(
                session,
                item,
                isUnreadMention(item, acks),
            )
    }
    const onEndReached = () =>
        session.get(notificationsStore).getState().loadMore()
    // NotificationCenterForYou's RefreshControl.
    const onRefresh = () =>
        session
            .get(notificationsStore)
            .getState()
            .refresh(initialPageSize(UnistylesRuntime.screen.height), true)

    const empty = !loading && parts.length === 0

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text
                    variant="heading-xl/bold"
                    color="MOBILE_TEXT_HEADING_PRIMARY"
                >
                    {t('notifications.title')}
                </Text>
            </View>
            {empty ? (
                <View style={styles.empty}>
                    <Icon name="BellIcon" size="lg" color="ICON_MUTED" />
                    <Text variant="heading-md/semibold" color="TEXT_DEFAULT">
                        {error ? t('error.generic') : t('notifications.empty')}
                    </Text>
                    {!error && (
                        <Text
                            variant="text-sm/medium"
                            color="TEXT_MUTED"
                            style={styles.body}
                        >
                            {t('notifications.emptyBody')}
                        </Text>
                    )}
                </View>
            ) : (
                <>
                    <Text
                        variant="text-sm/semibold"
                        color="TEXT_MUTED"
                        accessibilityRole="header"
                        style={styles.section}
                    >
                        {t('notifications.recentActivity')}
                    </Text>
                    <SearchResultsView
                        style={styles.list}
                        rows={rows}
                        theme={themeJson}
                        lineClamp={LINE_CLAMP}
                        inertContent
                        maxContentHeight={RESULT_MAX_CONTENT_HEIGHT}
                        topPadding={8 - SEARCH_ROW_TAP_STATE_PADDING}
                        bottomPadding={16}
                        onLinkPress={onLinkPress}
                        resultLongPress
                        onResultLongPress={onResultLongPress}
                        onEndReached={onEndReached}
                        refreshable
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                    />
                </>
            )}
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
        paddingHorizontal: theme.space.PX_16,
        paddingTop: theme.space.PX_16,
        paddingBottom: theme.space.PX_12,
    },
    section: {
        paddingHorizontal: theme.space.PX_16,
        paddingVertical: theme.space.PX_8,
    },
    list: { flex: 1 },
    empty: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.space.PX_8,
        padding: theme.space.PX_32,
    },
    body: { textAlign: 'center' },
}))
