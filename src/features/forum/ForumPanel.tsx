import { useNavigation } from '@react-navigation/native'
import { FlashList } from '@shopify/flash-list'
import { useEffect, useState } from 'react'
import { RefreshControl, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { useSession, useSessionStore } from '../../core/react'
import { ActivityIndicator } from '../../design/components/ActivityIndicator'
import { Button } from '../../design/components/buttons/Button'
import { Text } from '../../design/components/Text'
import { t } from '../../i18n'
import { channelsStore, holdThread } from '../../stores/channels/channels'
import { forumPostsStore } from '../../stores/forumPosts'
import { openChannelActionSheet } from '../channelActions'
import { ChatHeader } from '../chat/ChatPanel'
import { openStackedChat } from '../chat/links/openChannel'
import { ForumEmpty } from './ForumEmpty'
import { ForumPostCard } from './ForumPostCard'
import { ForumSearchBar } from './ForumSearchBar'
import { ForumSkeleton } from './ForumSkeleton'
import { useForumColumns } from './layout'
import { useForumFeed } from './useForumFeed'
import { useForumQuery } from './useForumQuery'
import type { ReactElement } from 'react'
import type { SearchTab } from '../search/types'

/** The list asks for the next page when this far (in screens) from its end. */
const END_REACHED_THRESHOLD = 1
const PINNED_TYPE = 'pinned'
const POST_TYPE = 'post'

/**
 * The masonry of post cards; it gets ids only, each card reads its own post. The search bar is its header, so it
 * scrolls with the posts and a tap in the gap around it dismisses the keyboard.
 */
function ForumPostList({
    feed,
    header,
    empty,
    refreshing,
    onRefresh,
    onPress,
    onLongPress,
}: {
    feed: ReturnType<typeof useForumFeed>
    header: ReactElement
    /** The skeleton, the error or the empty state, in place of the posts. */
    empty: ReactElement
    refreshing: boolean
    onRefresh: () => void
    onPress: (id: string) => void
    onLongPress: (id: string) => void
}) {
    const { columns, cardWidth } = useForumColumns()
    return (
        <FlashList
            // The column count changes the layout, so the list is rebuilt.
            key={columns}
            data={feed.ids}
            renderItem={({ item }) => (
                <ForumPostCard
                    id={item}
                    width={cardWidth}
                    onPress={onPress}
                    onLongPress={onLongPress}
                />
            )}
            keyExtractor={id => id}
            getItemType={(_id, index) =>
                index < feed.pinnedCount ? PINNED_TYPE : POST_TYPE
            }
            numColumns={columns}
            masonry
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            onEndReached={feed.loadMore}
            onEndReachedThreshold={END_REACHED_THRESHOLD}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            ListHeaderComponent={header}
            ListEmptyComponent={empty}
            ListEmptyComponentStyle={styles.empty}
            ListFooterComponent={
                feed.loadingMore ? (
                    <ActivityIndicator style={styles.footer} />
                ) : null
            }
        />
    )
}

/**
 * ForumChannel: a forum or media channel's posts in a masonry (the list layout only), pinned posts
 * first, under the channel's header. Tapping a post opens it over the forum.
 */
export function ForumPanel({
    channelId,
    onBack,
    onRowsDrawn,
    onOpenDetails,
}: {
    channelId: string
    onBack: () => void
    /** The first page of posts is on screen, or failed to load or has none. */
    onRowsDrawn?: (channelId: string) => void
    onOpenDetails?: (
        search?: boolean,
        guildSearch?: boolean,
        tab?: SearchTab,
    ) => void
}) {
    const channelName = useSessionStore(
        channelsStore,
        state => state.channels[channelId]?.name ?? '',
    )
    const session = useSession()
    const navigation = useNavigation()
    const { query, update, reset } = useForumQuery(channelId)
    const feed = useForumFeed(channelId, query)
    const [refreshing, setRefreshing] = useState(false)
    const onRefresh = async () => {
        setRefreshing(true)
        await feed.refresh()
        setRefreshing(false)
    }
    // An unjoined post is not otherwise a channel, so it is held before the chat or its actions read it.
    const holdPost = (id: string) => {
        const post = session.get(forumPostsStore).getState().posts[id]
        if (post) holdThread(session, post)
    }
    // ForumPostHandlers' transitionToThread: the post's chat stacked over the forum.
    const onPress = (id: string) => {
        holdPost(id)
        openStackedChat(id)
    }
    // LongPressForumPostActionSheet.
    const onLongPress = (id: string) => {
        holdPost(id)
        openChannelActionSheet(id, navigation)
    }
    const settled = !feed.loading
    useEffect(() => {
        if (settled) onRowsDrawn?.(channelId)
    }, [settled, onRowsDrawn, channelId])
    return (
        <View style={styles.container}>
            <ChatHeader
                channelId={channelId}
                onBack={onBack}
                onOpenDetails={onOpenDetails}
            />
            <ForumPostList
                feed={feed}
                header={<ForumSearchBar channelId={channelId} />}
                empty={
                    feed.loading ? (
                        <ForumSkeleton />
                    ) : feed.failed ? (
                        <View style={styles.message}>
                            <Text variant="text-md/medium" color="TEXT_DEFAULT">
                                {t('error.generic')}
                            </Text>
                            <Button
                                text={t('chat.retry')}
                                onPress={feed.refresh}
                                style={styles.retry}
                            />
                        </View>
                    ) : (
                        <ForumEmpty
                            channelName={channelName}
                            tagCount={query.tagIds.length}
                            searching={!!query.name}
                            onClear={() => {
                                reset()
                                update({ name: undefined })
                            }}
                        />
                    )
                }
                refreshing={refreshing}
                onRefresh={onRefresh}
                onPress={onPress}
                onLongPress={onLongPress}
            />
        </View>
    )
}

const styles = StyleSheet.create((theme, runtime) => ({
    container: { flex: 1, backgroundColor: theme.colors.BACKGROUND_BASE_LOWER },
    // The cards bring half the gap of their own, so their edges line up with the search bar's 12.
    content: {
        flexGrow: 1,
        paddingHorizontal: theme.space.PX_8,
        paddingTop: theme.space.PX_8,
        paddingBottom: theme.space.PX_4 + runtime.insets.bottom,
    },
    empty: { flex: 1 },
    footer: { padding: theme.space.PX_16 },
    message: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    retry: { marginTop: theme.space.PX_16 },
}))
