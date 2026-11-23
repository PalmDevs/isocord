import { View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { useSession, useSessionStore } from '../../core/react'
import { Button } from '../../design/components/buttons/Button'
import { Text } from '../../design/components/Text'
import { t } from '../../i18n'
import ChatView from '../../native/ChatViewNativeComponent'
import { setAtBottom } from '../../stores/messages/messages'
import {
    jumpToPresent,
    loadMessages,
    loadNewerMessages,
} from '../../stores/messages/messageWindows'
import { useComposer, useComposerState } from './composer'
import { composerStore } from './composer/state/composerStore'
import { handleChatLink } from './links/links'
import { openChannel } from './links/openChannel'
import { handleMessageLongPress, handleMessageSwipe } from './longPress'
import { NewMessagesBar } from './NewMessagesBar'
import { OptInChannelBanner } from './OptInChannelBanner'
import { useChatTheme } from './rows/rowEncoder'
import { useNewMessages } from './useNewMessages'
import { useShowChannelOptInNotice } from './useShowChannelOptInNotice'
import type { useChatHistory } from './hooks/useChatData'
import type { useChatScroll } from './hooks/useChatScroll'
import type { useReadSession } from './hooks/useReadSession'

/** Extra room between the last message and the floating input. */
const MESSAGE_LIST_GAP = 14

/** The native message list of a chat, its new-messages bar and the load error over it. */
export function ChatList({
    channelId,
    rows,
    messages,
    scroll,
    read,
    interactive,
    onRowsDrawn,
    onOpenPins,
}: {
    channelId: string
    rows: string
    messages: ReturnType<typeof useChatHistory>['messages']
    scroll: ReturnType<typeof useChatScroll>
    read: ReturnType<typeof useReadSession>
    interactive: boolean
    onRowsDrawn?: (channelId: string) => void
    /** Opens this chat's details on Pinned Messages. */
    onOpenPins?: () => void
}) {
    const session = useSession()
    const composer = useComposer()
    const acceptsActions = interactive && composer.channelId === channelId
    const { theme } = useUnistyles()
    const themeJson = useChatTheme()
    // The typing indicator's height while it is up; the list is pushed up by it, animated natively.
    const typingInset = useComposerState(state => state.typingInset)
    // Messages.tsx's replyingMessageId and editing message: the one being replied to or edited stays highlighted
    // (createChannelStream's isEditing).
    const composerTargetId = useSessionStore(
        composerStore,
        state =>
            state.replies[channelId]?.messageId ?? state.editing[channelId]?.id,
    )
    const newMessages = useNewMessages(channelId)
    const optInGuildId = useShowChannelOptInNotice(channelId)
    const openLink = (url: string) => {
        if (!acceptsActions) return
        handleChatLink(url, {
            session,
            channelId,
            composer,
            openChannel,
            scrollToMessage: scroll.scrollToMessage,
            openPins: onOpenPins,
        })
    }
    return (
        // One native view serves every channel this panel shows, so it is never unmounted for the error state.
        <View style={styles.chat}>
            <ChatView
                style={styles.chat}
                scrollKey={channelId}
                composerNativeId={composer.nativeId}
                // The composer overlaps the bottom of the list by half its scrim gradient, plus a visible gap.
                bottomInset={
                    theme.modules.mobile
                        .CHAT_INPUT_FLOATING_SCRIM_GRADIENT_HEIGHT /
                        2 +
                    MESSAGE_LIST_GAP
                }
                typingInset={typingInset}
                composerTargetId={composerTargetId}
                scrollTarget={scroll.scrollTarget}
                rows={rows}
                theme={themeJson}
                onLoadOlder={() => loadMessages(session, channelId, true)}
                onLoadNewer={() => loadNewerMessages(session, channelId)}
                onJumpToPresent={() =>
                    // The newest page replaces the window; then the list scrolls down to it.
                    void jumpToPresent(session, channelId).then(() =>
                        scroll.scrollTo(null),
                    )
                }
                onRowsDrawn={event =>
                    onRowsDrawn?.(event.nativeEvent.scrollKey)
                }
                onAtBottomChange={({
                    nativeEvent: { scrollKey, atBottom },
                }) => {
                    // MESSAGE_CREATE trims a chat only while it rests at the bottom.
                    setAtBottom(session, scrollKey, atBottom)
                    read.onAtBottomChange(scrollKey, atBottom)
                }}
                onMessageLongPress={event => {
                    if (!acceptsActions) return
                    handleMessageLongPress(
                        session,
                        channelId,
                        event.nativeEvent.messageId,
                        {
                            composer,
                            openChannel: id => openChannel(id),
                            openLink,
                            media: event.nativeEvent.media,
                        },
                    )
                }}
                onMessageSwipe={event => {
                    if (!acceptsActions) return
                    handleMessageSwipe(
                        session,
                        channelId,
                        event.nativeEvent.messageId,
                        event.nativeEvent.action,
                        composer,
                    )
                }}
                onLinkPress={event => openLink(event.nativeEvent.url)}
            />
            {/* The reference's StickyHeader over the list (ChatBanner): new messages win over the opt-in notice. The
                bar is held until the list has settled where it opens, so a chat opened at the bottom (and read at
                once) does not flash it. */}
            {newMessages
                ? read.opened && (
                      <NewMessagesBar
                          channelId={channelId}
                          newMessages={newMessages}
                          onPress={() => void scroll.scrollToNewMessages()}
                      />
                  )
                : optInGuildId && (
                      <OptInChannelBanner
                          guildId={optInGuildId}
                          channelId={channelId}
                      />
                  )}
            {messages?.error && messages.messages.length === 0 && (
                <View style={styles.error}>
                    <Text color="TEXT_MUTED">{t('chat.loadFailed')}</Text>
                    <Button
                        text={t('chat.retry')}
                        variant="secondary"
                        onPress={() => loadMessages(session, channelId)}
                    />
                </View>
            )}
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    chat: { flex: 1 },
    error: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: theme.colors.BACKGROUND_BASE_LOWER,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.space.PX_12,
    },
}))
