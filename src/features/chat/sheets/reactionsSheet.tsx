import { FlashList } from '@shopify/flash-list'
import { Image } from 'expo-image'
import { useEffect, useRef, useState } from 'react'
import { ScrollView, useWindowDimensions, View } from 'react-native'
import { useSharedValue } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StyleSheet } from 'react-native-unistyles'
import { Endpoint } from '../../../core/api/paths'
import { emojiUrl } from '../../../core/discord/cdn'
import { ReactionType } from '../../../core/discord/messages'
import { useSession, useSessionStore } from '../../../core/react'
import { ActivityIndicator } from '../../../design/components/ActivityIndicator'
import { cdnSize } from '../../../design/components/avatars/avatarUrl'
import { RipplePressable } from '../../../design/components/buttons/RipplePressable'
import { BottomSheet } from '../../../design/components/sheets/Sheet'
import { SheetDrag } from '../../../design/components/sheets/SheetDrag'
import { openActionSheet } from '../../../design/components/sheets/sheetStore'
import { Text } from '../../../design/components/Text'
import { TableRow } from '../../../design/components/table/TableRow'
import { t } from '../../../i18n'
import { channelsStore } from '../../../stores/channels/channels'
import { membersStore } from '../../../stores/members'
import { findMessage, messagesStore } from '../../../stores/messages/messages'
import { reactionCounts } from '../../../stores/messages/reactionEdits'
import { displayName, usersStore } from '../../../stores/users'
import { getUnicodeEmojiBySurrogates } from '../../expressions'
import { authorAvatarUrl } from '../author'
import { openUserProfile } from '../headerActions'
import { keyOf } from '../reactions'
import type {
    LayoutChangeEvent,
    NativeScrollEvent,
    NativeSyntheticEvent,
    ScrollViewInstance,
} from 'react-native'
import type { Reaction } from '../../../stores/messages/messageTypes'
import type { User } from '../../../stores/users'
import type { ReactionEmoji } from '../reactions'

/** How many users one request lists (the API allows up to 100). */
const USERS_LIMIT = 100

/** The sheet's one height, as a share of the window (the list sits in its footer, see ReactionPickerSheet). */
const HEIGHT_RATIO = 0.65
/** The drag handle's area and the gap under the header, which BottomSheet lays out itself. */
const HANDLE_AREA = 28
const HEADER_GAP = 16
/** The tab row (8 above, 8 around the 24 emoji, 8 below) and the emoji name row under it. */
const TABS_HEIGHT = 56
const NAME_HEIGHT = 48
/** Bottom padding BottomSheet gives a footer: the larger of the inset and 16, plus 4. */
const MIN_BOTTOM_PADDING = 16 + 4
/** MessageReactionsContent: rows (listRow), the footer spinner and the avatar (AvatarSizes.SMALL). */
const ROW_HEIGHT = 48
const AVATAR_SIZE = 30

/** The `type` of the reactors request. */
type ReactionKind = (typeof ReactionType)[keyof typeof ReactionType]

interface ReactionTab {
    id: string
    emoji: ReactionEmoji
    type: ReactionKind
    count: number
}

const tabId = (type: ReactionKind, key: string) => `${type}:${key}`

interface Reactors {
    users: User[]
    /** A page came back short: there are no more. */
    done: boolean
    loading: boolean
    failed: boolean
}

const NO_REACTORS: Reactors = {
    users: [],
    done: false,
    loading: false,
    failed: false,
}

/**
 * MessageReactions: a reaction that has both kinds is split into a normal and a super reaction tab, and the tabs are
 * sorted by count, most first.
 */
function reactionTabs(reactions: Reaction[]): ReactionTab[] {
    const tabs: ReactionTab[] = []
    for (const reaction of reactions) {
        const key = keyOf(reaction.emoji)
        const { normal, burst } = reactionCounts(reaction)
        if (normal > 0)
            tabs.push({
                id: tabId(ReactionType.NORMAL, key),
                emoji: reaction.emoji,
                type: ReactionType.NORMAL,
                count: normal,
            })
        if (burst > 0)
            tabs.push({
                id: tabId(ReactionType.BURST, key),
                emoji: reaction.emoji,
                type: ReactionType.BURST,
                count: burst,
            })
    }
    return tabs.sort((a, b) => b.count - a.count)
}

/** ReactionUtils.getReactionEmojiName: `:name:`, from the emoji data for a unicode emoji. */
function reactionEmojiName(emoji: ReactionEmoji): string {
    if (emoji.id) return `:${emoji.name}:`
    const unicode = getUnicodeEmojiBySurrogates(emoji.name ?? '')
    return unicode ? `:${unicode.uniqueName}:` : (emoji.name ?? '')
}

/** MessageReactions, opened by holding a reaction chip; `burst` for a super reaction chip (isSelectedBurst). */
export function showReactionsSheet(
    channelId: string,
    messageId: string,
    key: string,
    burst = false,
): void {
    openActionSheet(
        'message-reactions',
        <ReactionsSheet
            channelId={channelId}
            messageId={messageId}
            initialKey={key}
            initialBurst={burst}
        />,
    )
}

function EmojiGlyph({ emoji }: { emoji: ReactionEmoji }) {
    if (emoji.id) {
        return (
            <Image
                source={emojiUrl(emoji.id, emoji.animated, 48)}
                style={[styles.emoji, styles.emojiImage]}
            />
        )
    }
    return (
        <Text variant="text-md/medium" style={[styles.emoji, styles.emojiText]}>
            {emoji.name}
        </Text>
    )
}

/** ReactionTab: the emoji and its count, on the selected background when picked. */
function ReactionTabButton({
    tab,
    selected,
    onPress,
    onLayout,
}: {
    tab: ReactionTab
    selected: boolean
    onPress: () => void
    onLayout?: (event: LayoutChangeEvent) => void
}) {
    return (
        <RipplePressable
            accessibilityRole="tab"
            accessibilityLabel={tab.emoji.name ?? ''}
            accessibilityState={{ selected }}
            onPress={onPress}
            onLayout={onLayout}
            style={styles.tab(selected)}
        >
            <EmojiGlyph emoji={tab.emoji} />
            <Text
                variant="text-md/bold"
                color={
                    selected
                        ? 'INTERACTIVE_TEXT_ACTIVE'
                        : 'INTERACTIVE_TEXT_DEFAULT'
                }
            >
                {tab.count}
            </Text>
        </RipplePressable>
    )
}

/** MessageReactionsContent's useRenderItem: the avatar (the server one if set) and the nickname. */
function ReactorRow({
    user,
    guildId,
    start,
    end,
}: {
    user: User
    guildId: string | undefined
    start: boolean
    end: boolean
}) {
    const session = useSession()
    const member = useSessionStore(membersStore, state =>
        guildId ? state.members[guildId]?.[user.id] : undefined,
    )
    const name = member?.nick ?? displayName(user)
    return (
        <TableRow
            start={start}
            end={end}
            height={ROW_HEIGHT}
            onPress={() => openUserProfile(session, user.id, guildId)}
            accessibilityLabel={name}
            icon={
                <Image
                    source={authorAvatarUrl(
                        user,
                        member,
                        guildId,
                        cdnSize(AVATAR_SIZE),
                    )}
                    recyclingKey={user.id}
                    cachePolicy="memory-disk"
                    style={styles.avatar}
                />
            }
            label={name}
            labelLineClamp={1}
        />
    )
}

/** MessageReactionsEmpty: a message whose reactions are all gone. */
function ReactionsEmpty() {
    return (
        <BottomSheet>
            <View style={styles.empty}>
                <Text variant="heading-md/bold" style={styles.center}>
                    {t('chat.reactions.emptyTitle')}
                </Text>
                <Text
                    variant="text-sm/medium"
                    color="TEXT_MUTED"
                    style={styles.center}
                >
                    {t('chat.reactions.emptyBody')}
                </Text>
            </View>
        </BottomSheet>
    )
}

/**
 * MessageReactionsContent: the reaction tabs and the selected emoji's name stay on top, the users who reacted with
 * it are listed below, 100 at a time (ReactionActionCreators.getReactors, as the list nears its end).
 */
function ReactionsSheet({
    channelId,
    messageId,
    initialKey,
    initialBurst,
}: {
    channelId: string
    messageId: string
    initialKey: string
    initialBurst: boolean
}) {
    const session = useSession()
    const insets = useSafeAreaInsets()
    const { height: windowHeight } = useWindowDimensions()
    const guildId = useSessionStore(
        channelsStore,
        state => state.channels[channelId]?.guild_id,
    )
    const reactions = useSessionStore(
        messagesStore,
        state => findMessage(state, channelId, messageId)?.reactions,
    )
    const tabs = reactionTabs(reactions ?? [])
    // useReactionSelected: the held emoji's tab of the held kind, else its other tab.
    const [selectedId, setSelectedId] = useState(() => {
        const ids = tabs.map(tab => tab.id)
        const held = initialBurst ? ReactionType.BURST : ReactionType.NORMAL
        const other = initialBurst ? ReactionType.NORMAL : ReactionType.BURST
        return (
            [tabId(held, initialKey), tabId(other, initialKey)].find(id =>
                ids.includes(id),
            ) ?? ids[0]
        )
    })
    const selected = tabs.find(tab => tab.id === selectedId) ?? tabs[0]
    const [reactors, setReactors] = useState<Record<string, Reactors>>({})
    const inFlight = useRef(new Set<string>())
    const tabsScroll = useRef<ScrollViewInstance>(null)
    const scrolledToSelected = useRef(false)

    const atTop = useSharedValue(true)
    const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        atTop.set(event.nativeEvent.contentOffset.y <= 1)
    }

    // useReactorsOnScrollNative: the next page after the last user listed, while the count says there are more.
    const load = (tab: ReactionTab) => {
        const current = reactors[tab.id] ?? NO_REACTORS
        if (
            inFlight.current.has(tab.id) ||
            current.done ||
            (reactors[tab.id] && current.users.length >= tab.count)
        )
            return
        inFlight.current.add(tab.id)
        const update = (change: Partial<Reactors>) =>
            setReactors(prev => ({
                ...prev,
                [tab.id]: { ...(prev[tab.id] ?? NO_REACTORS), ...change },
            }))
        update({ loading: true, failed: false })
        // GET /channels/{c}/messages/{m}/reactions/{emoji}: the emoji is `name` or `name:id`, URL-encoded.
        session.rest
            .get<User[]>(
                Endpoint.messageReaction(
                    channelId,
                    messageId,
                    encodeURIComponent(keyOf(tab.emoji)),
                ),
                {
                    query: {
                        limit: USERS_LIMIT,
                        after: current.users.at(-1)?.id,
                        type: tab.type,
                    },
                },
            )
            .then(page => {
                session.get(usersStore).getState().upsert(page)
                setReactors(prev => ({
                    ...prev,
                    [tab.id]: {
                        users: [...(prev[tab.id]?.users ?? []), ...page],
                        done: page.length < USERS_LIMIT,
                        loading: false,
                        failed: false,
                    },
                }))
            })
            .catch(() => update({ loading: false, failed: true }))
            .finally(() => inFlight.current.delete(tab.id))
    }

    const selectedTabId = selected?.id
    // biome-ignore lint/correctness/useExhaustiveDependencies: loads the first page when a tab is first shown.
    useEffect(() => {
        if (selected && !reactors[selected.id]) load(selected)
    }, [selectedTabId])

    if (!selected) return <ReactionsEmpty />

    const list = reactors[selected.id] ?? NO_REACTORS
    const hasMore = !list.done && list.users.length < selected.count
    const height = Math.round(windowHeight * HEIGHT_RATIO)
    const listHeight =
        height -
        HANDLE_AREA -
        HEADER_GAP -
        TABS_HEIGHT -
        NAME_HEIGHT -
        Math.max(insets.bottom, MIN_BOTTOM_PADDING)

    return (
        <BottomSheet
            scrollable
            startHeight={height}
            maxHeight={height}
            header={
                <View>
                    <ScrollView
                        ref={tabsScroll}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.tabs}
                        contentContainerStyle={styles.tabsContent}
                    >
                        {tabs.map(tab => (
                            <ReactionTabButton
                                key={tab.id}
                                tab={tab}
                                selected={tab.id === selected.id}
                                onPress={() => setSelectedId(tab.id)}
                                onLayout={
                                    tab.id === selected.id &&
                                    !scrolledToSelected.current
                                        ? event => {
                                              // The Tabs scroll to the tab picked when the sheet opens.
                                              scrolledToSelected.current = true
                                              tabsScroll.current?.scrollTo({
                                                  x: Math.max(
                                                      0,
                                                      event.nativeEvent.layout
                                                          .x - 16,
                                                  ),
                                                  animated: false,
                                              })
                                          }
                                        : undefined
                                }
                            />
                        ))}
                    </ScrollView>
                    <View style={styles.name}>
                        <Text variant="eyebrow" color="TEXT_DEFAULT">
                            {reactionEmojiName(selected.emoji)}
                        </Text>
                    </View>
                </View>
            }
            footer={
                <View style={{ height: listHeight }}>
                    <SheetDrag scrollAtTop={atTop} style={styles.fill}>
                        <FlashList
                            // A list per tab, as the reference keys it by the emoji.
                            key={selected.id}
                            data={list.users}
                            keyExtractor={user => user.id}
                            onScroll={onScroll}
                            scrollEventThrottle={16}
                            onEndReached={() => load(selected)}
                            onEndReachedThreshold={0.25}
                            contentContainerStyle={styles.listContent}
                            renderItem={({ item, index }) => (
                                <ReactorRow
                                    user={item}
                                    guildId={guildId}
                                    start={index === 0}
                                    end={index === list.users.length - 1}
                                />
                            )}
                            ListFooterComponent={
                                list.failed ? (
                                    <Text
                                        variant="text-md/medium"
                                        color="TEXT_MUTED"
                                        style={styles.failed}
                                    >
                                        {t('chat.actions.failed')}
                                    </Text>
                                ) : hasMore ? (
                                    <ActivityIndicator style={styles.spinner} />
                                ) : null
                            }
                        />
                    </SheetDrag>
                </View>
            }
        />
    )
}

const styles = StyleSheet.create(theme => ({
    fill: { flex: 1 },
    tabs: { height: TABS_HEIGHT, flexGrow: 0 },
    tabsContent: { paddingHorizontal: theme.space.PX_8 },
    // MessageReactionsContent's tab and tabContainer.
    tab: (selected: boolean) => ({
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        alignSelf: 'flex-start' as const,
        padding: theme.space.PX_8,
        marginTop: theme.space.PX_8,
        marginHorizontal: theme.space.PX_8,
        borderRadius: theme.radii.sm,
        backgroundColor: selected
            ? theme.colors.INTERACTIVE_BACKGROUND_SELECTED
            : undefined,
    }),
    emoji: { marginRight: theme.space.PX_8 },
    emojiImage: { width: 24, height: 24 },
    emojiText: { fontSize: 20, lineHeight: 24, textAlign: 'center' },
    // emojiTextIdentifier.
    name: {
        height: NAME_HEIGHT,
        justifyContent: 'center',
        paddingHorizontal: theme.space.PX_16,
    },
    listContent: { paddingHorizontal: theme.space.PX_16 },
    avatar: {
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        borderRadius: AVATAR_SIZE / 2,
        backgroundColor: theme.colors.BACKGROUND_BASE_LOWER,
    },
    spinner: { height: ROW_HEIGHT, padding: theme.space.PX_6 },
    failed: { padding: theme.space.PX_16, textAlign: 'center' },
    // containerEmpty, with RefreshEmptyState's title and body centred.
    empty: { padding: theme.space.PX_32, gap: theme.space.PX_8 },
    center: { textAlign: 'center' },
}))
