import { useEffect, useState } from 'react'
import { BackHandler, View } from 'react-native'
import Animated, {
    FadeIn,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { useSessionStore } from '../../../core/react'
import {
    CHANNEL_DETAILS_SEARCH_TIMING,
    SPRING_CHANNEL_HEADER,
    TIMING_FAST,
} from '../../../design/tokens/motion'
import { t } from '../../../i18n'
import {
    channelsStore,
    isPrivate,
    isThread,
} from '../../../stores/channels/channels'
import { guildsStore } from '../../../stores/guilds'
import { useDm } from '../../messages/useDm'
import { ChannelsPage } from '../../search/channels/ChannelsPage'
import { FilterBar } from '../../search/filters/FilterBar'
import { FilterSuggestions } from '../../search/filters/FilterSuggestions'
import { FilterPicker } from '../../search/filters/pickers/FilterPicker'
import { useSearchInput } from '../../search/filters/useSearchInput'
import { RecentPage } from '../../search/global/RecentPage'
import { MembersPage } from '../../search/members'
import { SearchPreviewHost } from '../../search/preview'
import { SearchBar } from '../../search/SearchBar'
import { SearchTabsLayout } from '../../search/SearchTabsLayout'
import { ThreadsPage } from '../../search/threads/ThreadsPage'
import { ChannelNameHeader } from './ChannelNameHeader'
import { ChannelTopic } from './ChannelTopic'
import { SEARCH_BAR_HEIGHT } from './constants'
import { NavigationBar } from './NavigationBar'
import type {
    SearchContext,
    SearchTab,
    SearchTabPages,
} from '../../search/types'

const PAGES: SearchTabPages = {
    recent: RecentPage,
    members: MembersPage,
    guild_channels: ChannelsPage,
}
/** A channel's details add the Threads tab; a thread's (SearchTypes.THREAD) have none. */
const CHANNEL_PAGES: SearchTabPages = { ...PAGES, threads: ThreadsPage }

interface ChannelDetailsProps {
    channelId: string
    /**
     * Opened with the search bar up and focused (the header's search button). Back, the chevron or the system's,
     * then closes the details at once; with search started inside the details, back only leaves search first.
     */
    initialSearch?: boolean
    /**
     * Opened from the server header's search: the tabs of a server search (SEARCH_TYPE_TO_SEARCH_INITIAL_TABS GUILD:
     * Recent, Members, Channels...), on the Recent tab.
     */
    guildSearch?: boolean
    /** The tab shown first (Pinned Messages from a pin's system message). */
    initialTab?: SearchTab
    /** Closes the details, back to the chat. */
    onBack: () => void
    /** The topic's height is known and the selected tab's page laid out: the panel can slide in. */
    onReady?: () => void
    /** The pages beside the selected tab are not built yet: the panel is still sliding in. */
    deferPages?: boolean
    active?: boolean
}

/**
 * ChannelDetails: the channel's icon, name and topic, buttons (search, mute, settings), and below them the search
 * tabs of the channel: Members, Media, Pins, Links and Files, and with a query Members, Messages, Media, Pins, Links
 * and Files (no Members in a DM). Searching folds the header away and puts the search bar where the buttons were.
 */
export function ChannelDetails({
    channelId,
    initialSearch = false,
    guildSearch = false,
    initialTab,
    onBack,
    onReady,
    deferPages = false,
    active,
}: ChannelDetailsProps) {
    const channel = useSessionStore(
        channelsStore,
        state => state.channels[channelId],
    )
    const dm = useDm(channelId)
    const guildName = useSessionStore(guildsStore, state =>
        channel && !isPrivate(channel)
            ? state.guilds[channel.guild_id ?? '']?.name
            : undefined,
    )
    const [searching, setSearching] = useState(initialSearch)
    // A channel's search is scoped to it by a removable `in:` tag; without it, the whole server.
    // The server header's search starts on the whole server, as the reference's does.
    const guildId =
        channel && !isPrivate(channel) ? channel.guild_id : undefined
    const context = (
        guildId
            ? { type: 'GUILD_CHANNEL', channelId, guildId }
            : { type: 'CHANNEL', channelId }
    ) satisfies SearchContext

    const search = useSearchInput(
        context,
        channel && !isPrivate(channel) && !guildSearch
            ? { kind: 'in', value: channelId, label: channel.name ?? '' }
            : undefined,
    )
    const { reset } = search

    const stopSearching = () => {
        setSearching(false)
        reset()
    }
    // Back closes the search before the details, unless the details were opened for the search: ChatPanels' own
    // handler then closes them.
    useEffect(() => {
        if (!searching || initialSearch) return
        const subscription = BackHandler.addEventListener(
            'hardwareBackPress',
            () => {
                setSearching(false)
                reset()
                return true
            },
        )
        return () => subscription.remove()
    }, [searching, initialSearch, reset])

    // The header folds away (height and opacity) while searching. Its natural height is measured on the contents,
    // which sit absolutely inside the folding box once measured: in flow they were laid out by the box as it
    // folded, and the heights they reported then became the spring's target, so unfolding first sprang to a sliver
    // and then on to the full height. The spring drives a progress, not the height, so a new measurement never
    // restarts it.
    // The contents' height is summed on the UI thread from the head's measured height and the topic's springing one:
    // onLayout reached the box through JS, which lagged behind the topic's spring and froze the pages below.
    const { theme } = useUnistyles()
    const topicGap = theme.space.PX_12
    const headHeight = useSharedValue<number | undefined>(undefined)
    const topicHeight = useSharedValue<number | undefined>(undefined)
    const [measured, setMeasured] = useState(false)
    const hasTopic = !!channel && !isPrivate(channel) && !!channel.topic
    // Ready once the selected page is laid out, and with a topic once the native text reports its height.
    const [topicReady, setTopicReady] = useState(false)
    const [pageReady, setPageReady] = useState(false)
    const ready = pageReady && (topicReady || !hasTopic)
    useEffect(() => {
        if (ready) onReady?.()
    }, [ready, onReady])
    const progress = useSharedValue(initialSearch ? 0 : 1)
    const opacity = useSharedValue(initialSearch ? 0 : 1)
    useEffect(() => {
        progress.set(withSpring(searching ? 0 : 1, SPRING_CHANNEL_HEADER))
        opacity.set(withTiming(searching ? 0 : 1, TIMING_FAST))
    }, [searching, progress, opacity])
    const infoStyle = useAnimatedStyle(() => {
        const head = headHeight.get()
        if (head === undefined) return { opacity: opacity.get() }
        const height = hasTopic
            ? head + topicGap + (topicHeight.get() ?? 0)
            : head
        return { opacity: opacity.get(), height: progress.get() * height }
    })

    if (!channel) return null

    // SearchBar's placeholder: "Search in" the server of a channel, or the DM.
    const searchName = guildName ?? dm?.name
    const searchPlaceholder = searchName
        ? t('search.bar.placeholderIn', { name: searchName })
        : t('search.bar.placeholder')

    const header = (
        <View style={styles.header}>
            <View style={styles.bar}>
                <NavigationBar
                    channelId={channelId}
                    searching={searching}
                    onBack={onBack}
                    onSearch={() => setSearching(true)}
                />
                {searching && (
                    <Animated.View
                        entering={FadeIn.duration(
                            CHANNEL_DETAILS_SEARCH_TIMING.duration,
                        ).easing(CHANNEL_DETAILS_SEARCH_TIMING.easing)}
                        style={styles.searchLayer}
                    >
                        <SearchBar
                            search={search}
                            placeholder={searchPlaceholder}
                            autoFocus
                            onBack={initialSearch ? onBack : stopSearching}
                        />
                    </Animated.View>
                )}
            </View>
            <Animated.View
                pointerEvents={searching ? 'none' : 'auto'}
                style={[styles.info, infoStyle]}
            >
                <View style={[styles.information, measured && styles.measured]}>
                    <View
                        style={styles.head}
                        onLayout={event => {
                            headHeight.set(event.nativeEvent.layout.height)
                            setMeasured(true)
                        }}
                    >
                        <ChannelNameHeader channelId={channelId} />
                    </View>
                    {!isPrivate(channel) && channel.topic ? (
                        <ChannelTopic
                            channelId={channelId}
                            topic={channel.topic}
                            height={topicHeight}
                            onReady={() => setTopicReady(true)}
                            onBack={onBack}
                        />
                    ) : null}
                </View>
            </Animated.View>
        </View>
    )

    return (
        <SearchPreviewHost onDismiss={onBack} active={active}>
            <View style={styles.container}>
                <SearchTabsLayout
                    context={context}
                    query={search.queryText.trim()}
                    filters={search.filters}
                    overlay={
                        <>
                            <FilterPicker
                                context={context}
                                search={search}
                                background="MOBILE_ACTIONSHEET_BACKGROUND"
                            />
                            <FilterSuggestions
                                context={context}
                                search={search}
                            />
                        </>
                    }
                    pages={isThread(channel) ? PAGES : CHANNEL_PAGES}
                    onDismiss={onBack}
                    header={header}
                    guildSearch={guildSearch}
                    initialTab={guildSearch ? 'recent' : initialTab}
                    deferPages={deferPages}
                    onPageReady={() => {
                        setPageReady(true)
                    }}
                />
                {searching && <FilterBar context={context} search={search} />}
            </View>
        </SearchPreviewHost>
    )
}

const styles = StyleSheet.create((theme, runtime) => ({
    // detailsContainer: the action sheet background, below the status bar.
    container: {
        flex: 1,
        backgroundColor: theme.colors.MOBILE_ACTIONSHEET_BACKGROUND,
        paddingTop: runtime.insets.top,
    },
    header: { paddingBottom: theme.space.PX_12, zIndex: 10 },
    bar: {
        position: 'relative',
        zIndex: 1,
        height: SEARCH_BAR_HEIGHT,
        marginTop: theme.space.PX_8,
    },
    // The search bar has its own insets: the back chevron's on the left, 16 dp on the right.
    searchLayer: StyleSheet.absoluteFillObject,
    info: { overflow: 'hidden' },
    information: {
        marginHorizontal: theme.space.PX_16,
        gap: theme.space.PX_12,
    },
    // The padding is inside the measured head, so the box's height is the head's, the gap and the topic's.
    head: { paddingTop: theme.space.PX_8 },
    measured: { position: 'absolute', top: 0, left: 0, right: 0 },
}))
