import {
    useEffect,
    useEffectEvent,
    useLayoutEffect,
    useRef,
    useState,
} from 'react'
import { View } from 'react-native'
import { useAnimatedReaction } from 'react-native-reanimated'
import { StyleSheet } from 'react-native-unistyles'
import { scheduleOnRN } from 'react-native-worklets'
import { useSessionStore } from '../../core/react'
import { NavigatorHeader } from '../../design/components/layout/NavigatorHeader'
import { Icon } from '../../design/icons/Icon'
import { t } from '../../i18n'
import { channelsStore, isPrivate } from '../../stores/channels/channels'
import { DMHeader } from '../messages/DMHeader'
import { useChannelIcon } from '../servers/channelIcon'
import { ChatList } from './ChatList'
import { ChatListPlaceholder } from './ChatListPlaceholder'
import { Composer, ComposerProvider } from './composer'
import { HeaderSearchButton } from './details/HeaderSearchButton'
import { useChatHistory, useChatRows } from './hooks/useChatData'
import { useChatScroll } from './hooks/useChatScroll'
import { useReadSession } from './hooks/useReadSession'
import { ThreadBars } from './threadBars/ThreadBars'
import type { HostInstance } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import type { SearchTab } from '../search/types'

interface Props {
    channelId: string
    onBack: () => void
    /** The native list drew the first rows of this channel. */
    onRowsDrawn?: (channelId: string) => void
    /** Whether the user can actually see this chat right now. Only visible chats are marked as read. */
    visible: boolean
    panelX: SharedValue<number>
    /** Mounts the primary chat's composer before the slide. */
    prepareComposer?: boolean
    mountList?: boolean
    listChannelId?: string
    showRows?: boolean
    showSkeleton?: boolean
    /**
     * A message to scroll to once the chat is open (a message link from another chat, a search result). A new object
     * for every request, so the same message can be jumped to again.
     */
    jump?: { messageId: string }
    /** Opens the channel details (the header's title and search button), searching or on a tab when asked to. */
    onOpenDetails?: (
        search?: boolean,
        guildSearch?: boolean,
        tab?: SearchTab,
    ) => void
    /** Swiping a message leftward opens the details instead of replying (the user's swipe setting). */
    swipeOpensDetails?: boolean
}

/** A channel or conversation: header, the native message list and the composer. */
export function ChatPanel(props: Props) {
    return (
        <ComposerProvider channelId={props.channelId}>
            <ChatPanelContent {...props} />
        </ComposerProvider>
    )
}

/** Keeps the native input out of the opening gesture. */
function useComposerInputReady(visible: boolean, panelX: SharedValue<number>) {
    const [ready, setReady] = useState(false)
    useAnimatedReaction(
        () => !ready && visible && panelX.get() === 0,
        settled => {
            if (settled) scheduleOnRN(setReady, true)
        },
    )
    return ready
}

function ChatPanelContent({
    channelId,
    onBack,
    onRowsDrawn,
    visible,
    panelX,
    prepareComposer,
    mountList = true,
    listChannelId = channelId,
    showRows = true,
    showSkeleton = false,
    jump,
    onOpenDetails,
    swipeOpensDetails,
}: Props) {
    const inputReady = useComposerInputReady(visible, panelX)
    // Measured before the frame is drawn, so the placeholder's gradient lines up from its first frame.
    const container = useRef<HostInstance>(null)
    const list = useRef<HostInstance>(null)
    const [listTop, setListTop] = useState(0)
    useLayoutEffect(() => {
        if (showRows || !container.current) return
        list.current?.measureLayout(container.current, (_x, y) => setListTop(y))
    })
    return (
        <View ref={container} style={styles.container}>
            <ChatHeader
                channelId={channelId}
                onBack={onBack}
                onOpenDetails={onOpenDetails}
            />
            <ThreadBars channelId={channelId} />
            <View ref={list} style={styles.list}>
                {mountList && (
                    <View
                        collapsable={false}
                        style={styles.list}
                        pointerEvents={showRows ? 'auto' : 'none'}
                        importantForAccessibility={
                            showRows ? 'auto' : 'no-hide-descendants'
                        }
                    >
                        <ChatPanelMessages
                            channelId={listChannelId}
                            visible={visible && listChannelId === channelId}
                            jump={
                                listChannelId === channelId ? jump : undefined
                            }
                            onRowsDrawn={onRowsDrawn}
                            onOpenDetails={onOpenDetails}
                            swipeOpensDetails={swipeOpensDetails}
                            waitForDraw={prepareComposer}
                        />
                    </View>
                )}
                {!showRows && (
                    <ChatListPlaceholder
                        showSkeleton={showSkeleton}
                        top={listTop}
                    />
                )}
            </View>
            <Composer inputReady={prepareComposer ? undefined : inputReady} />
        </View>
    )
}

function ChatPanelMessages({
    channelId,
    onRowsDrawn,
    visible,
    jump,
    onOpenDetails,
    swipeOpensDetails,
    waitForDraw,
}: Pick<
    Props,
    | 'channelId'
    | 'onRowsDrawn'
    | 'visible'
    | 'jump'
    | 'onOpenDetails'
    | 'swipeOpensDetails'
> & {
    waitForDraw?: boolean
}) {
    const history = useChatHistory(channelId)
    const reportDrawn = useEffectEvent((id: string) => onRowsDrawn?.(id))
    const messages = history.messages
    const settledEmpty =
        messages?.messages.length === 0 &&
        (messages.error ||
            (!messages.loading && !messages.hasMore && !messages.stale))
    useEffect(() => {
        if (!waitForDraw || !settledEmpty) return
        let frame = requestAnimationFrame(() => {
            frame = requestAnimationFrame(() => reportDrawn(channelId))
        })
        return () => cancelAnimationFrame(frame)
    }, [channelId, waitForDraw, settledEmpty])
    const scroll = useChatScroll(channelId, jump)
    const read = useReadSession({
        channelId,
        visible,
        jumping: jump !== undefined,
        scrollTo: messageId => scroll.scrollTo(messageId),
    })
    const rows = useChatRows({
        ...history,
        ackedId: read.ackedId,
        swipeOpensDetails,
    })
    return (
        <ChatList
            channelId={channelId}
            rows={rows}
            messages={messages}
            scroll={scroll}
            read={read}
            interactive={visible}
            onRowsDrawn={onRowsDrawn}
            onOpenPins={
                onOpenDetails && (() => onOpenDetails(false, false, 'pins'))
            }
        />
    )
}

/**
 * The header of a chat: the DM's, or the channel's icon and name. Without `onOpenDetails` (a message preview) the
 * title cannot be pressed and there is no search button, like the reference's SearchNavigatorPreviewHeader.
 */
export function ChatHeader({
    channelId,
    onBack,
    onOpenDetails,
}: {
    channelId: string
    onBack: () => void
    onOpenDetails?: (search?: boolean) => void
}) {
    const channel = useSessionStore(
        channelsStore,
        state => state.channels[channelId],
    )
    const icon = useChannelIcon(channel)
    if (channel && isPrivate(channel))
        return (
            <DMHeader
                channelId={channelId}
                onBack={onBack}
                onOpenDetails={onOpenDetails}
            />
        )
    return (
        <NavigatorHeader
            title={channel?.name ?? ''}
            titleIcon={<Icon name={icon} size="sm" color="ICON_DEFAULT" />}
            onBack={onBack}
            backLabel={t('common.back')}
            onTitlePress={onOpenDetails && (() => onOpenDetails())}
            titleLabel={t('details.open')}
            trailing={
                onOpenDetails && (
                    <HeaderSearchButton onPress={() => onOpenDetails(true)} />
                )
            }
        />
    )
}

const styles = StyleSheet.create(theme => ({
    container: { flex: 1, backgroundColor: theme.colors.BACKGROUND_BASE_LOWER },
    list: { flex: 1 },
}))
