import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { useSessionStore } from '../../core/react'
import { NavigatorHeader } from '../../design/components/layout/NavigatorHeader'
import { Icon } from '../../design/icons/Icon'
import { t } from '../../i18n'
import { channelsStore, isPrivate } from '../../stores/channels/channels'
import { DMHeader } from '../messages/DMHeader'
import { useChannelIcon } from '../servers/channelIcon'
import { ChatList } from './ChatList'
import { Composer, ComposerProvider } from './composer'
import { HeaderSearchButton } from './details/HeaderSearchButton'
import { useChatHistory, useChatRows } from './hooks/useChatData'
import { useChatScroll } from './hooks/useChatScroll'
import { useReadSession } from './hooks/useReadSession'
import { ThreadBars } from './threadBars/ThreadBars'
import type { SearchTab } from '../search/types'

interface Props {
    channelId: string
    onBack: () => void
    /** The native list drew the first rows of this channel. */
    onRowsDrawn?: (channelId: string) => void
    /** Whether the user can actually see this chat right now. Only visible chats are marked as read. */
    visible: boolean
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

/** How long the offscreen chat waits for idle before its input is built. */
const COMPOSER_IDLE_MS = 1500

/** A channel or conversation: header, the native message list and the composer. */
export function ChatPanel(props: Props) {
    return (
        <ComposerProvider channelId={props.channelId}>
            <ChatPanelContent {...props} />
        </ComposerProvider>
    )
}

/** The native input is built a little after the list (in a later idle slot), or at once when the chat is shown, so the
 * offscreen chat is not mounted in one long frame. */
function useDeferredComposer(visible: boolean) {
    const [mounted, setMounted] = useState(visible)
    useEffect(() => {
        if (mounted) return
        if (visible) return setMounted(true)
        const idle = requestIdleCallback(() => setMounted(true), {
            timeout: COMPOSER_IDLE_MS,
        })
        return () => cancelIdleCallback(idle)
    }, [mounted, visible])
    return mounted
}

function ChatPanelContent({
    channelId,
    onBack,
    onRowsDrawn,
    visible,
    jump,
    onOpenDetails,
    swipeOpensDetails,
}: Props) {
    const composerMounted = useDeferredComposer(visible)
    const history = useChatHistory(channelId)
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
        <View style={styles.container}>
            <ChatHeader
                channelId={channelId}
                onBack={onBack}
                onOpenDetails={onOpenDetails}
            />
            <ThreadBars channelId={channelId} />
            <ChatList
                channelId={channelId}
                rows={rows}
                messages={history.messages}
                scroll={scroll}
                read={read}
                composerMounted={composerMounted}
                onRowsDrawn={onRowsDrawn}
                onOpenPins={
                    onOpenDetails && (() => onOpenDetails(false, false, 'pins'))
                }
            />
            {composerMounted && <Composer />}
        </View>
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
}))
