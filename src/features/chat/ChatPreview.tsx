import { useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { useSession, useSessionStore } from '../../core/react'
import { RipplePressable } from '../../design/components/buttons/RipplePressable'
import { Text } from '../../design/components/Text'
import { t } from '../../i18n'
import ChatView from '../../native/ChatViewNativeComponent'
import { channelsStore } from '../../stores/channels/channels'
import { loadLinkedChannels } from '../../stores/channels/linkedChannels'
import { guildsStore } from '../../stores/guilds'
import { membersStore, requestMembers } from '../../stores/members'
import {
    clearPreview,
    loadPreview,
    loadPreviewPage,
} from '../../stores/messages/messagePreviews'
import { messagesStore } from '../../stores/messages/messages'
import { usersStore } from '../../stores/users'
import { ChatHeader } from './ChatPanel'
import { handleChatLink } from './links/links'
import { handleMessageLongPress } from './longPress'
import { canReact } from './longPress/actions'
import { buildRows } from './rows/buildRows'
import { encodeRows, useChatTheme } from './rows/rowEncoder'

/** Makes every scroll request of the preview's list distinct. */
let scrollNonce = 0

/**
 * Shows a search result in its channel (SearchNavigatorPreviewScreen, MessagePreview, ChatPreview).
 * Header, messages around the result, and "Jump to Message" where the composer would be.
 * The list scrolls to the result and flashes it. Its jump button leads back to the result.
 * No composer: long press leaves out edit, reply and mention, and rows do not swipe.
 * Taps that lead elsewhere leave search, like the jump does.
 */
export function ChatPreview({
    channelId,
    messageId,
    onBack,
    onJump,
}: {
    channelId: string
    messageId: string
    onBack: () => void
    /** Leaves search for a channel, at a message when given one (`onBeforeJumpToMessage` + transitionToMessage). */
    onJump: (channelId: string, messageId?: string) => void
}) {
    const session = useSession()
    const channel = useSessionStore(
        channelsStore,
        state => state.channels[channelId],
    )
    const channels = useSessionStore(channelsStore, state => state.channels)
    const guildId = channel?.guild_id
    const guild = useSessionStore(guildsStore, state =>
        guildId ? state.guilds[guildId] : undefined,
    )
    const members = useSessionStore(membersStore, state =>
        guildId ? state.members[guildId] : undefined,
    )
    const users = useSessionStore(usersStore, state => state.users)
    const preview = useSessionStore(messagesStore, state =>
        state.preview?.channelId === channelId &&
        state.preview.messageId === messageId
            ? state.preview
            : undefined,
    )

    // MessagePreviewActionCreators.fetchMessages on press, clearMessages on unmount.
    useEffect(() => {
        void loadPreview(session, channelId, messageId)
        return () => clearPreview(session)
    }, [session, channelId, messageId])

    const scrollKey = `preview:${channelId}:${messageId}`
    const [scrollTarget, setScrollTarget] = useState(() => ({
        scrollKey,
        messageId,
        nonce: ++scrollNonce,
        flash: true,
    }))
    const scrollTo = (id: string) => {
        if (!preview?.messages.some(message => message.id === id))
            return onJump(channelId, id)
        setScrollTarget({
            scrollKey,
            messageId: id,
            nonce: ++scrollNonce,
            flash: true,
        })
    }

    const loaded = preview && !preview.loading ? preview.messages : undefined
    // History from REST lacks member data, so fetch it.
    useEffect(() => {
        if (!guildId || !loaded?.length) return
        requestMembers(
            session,
            guildId,
            loaded.map(message => message.author.id),
        )
    }, [session, guildId, loaded])

    // useMemo: the compiler skips this component (the module-level scrollNonce), as it does ChatPanelContent.
    const { rowsJson, unknownChannels } = useMemo(() => {
        const unknownChannels = new Set<string>()
        const rowsJson = encodeRows(
            buildRows(
                // A window that pages both ways, like a jumped-to chat: loading rows at the ends that have more.
                preview && loaded
                    ? {
                          messages: loaded,
                          hasMore: preview.hasMore,
                          hasMoreAfter: preview.hasMoreAfter,
                          loading: false,
                          error: false,
                      }
                    : undefined,
                {
                    session,
                    guild,
                    members,
                    users,
                    channels,
                    channel,
                    canReact: message => canReact(session, message),
                    onUnknownChannel: id => unknownChannels.add(id),
                },
            ),
        )
        return { rowsJson, unknownChannels }
    }, [preview, loaded, session, guild, members, users, channels, channel])
    // A fetched channel lands in the channels store, which rebuilds the rows.
    useEffect(
        () => loadLinkedChannels(session, unknownChannels),
        [session, unknownChannels],
    )
    const themeJson = useChatTheme()

    const openLink = (url: string) =>
        handleChatLink(url, {
            session,
            channelId,
            openChannel: onJump,
            scrollToMessage: scrollTo,
            stack: false,
        })
    return (
        <View style={styles.container}>
            <ChatHeader channelId={channelId} onBack={onBack} />
            <View style={styles.chat}>
                <ChatView
                    style={styles.chat}
                    scrollKey={scrollKey}
                    scrollTarget={scrollTarget}
                    jumpTarget={messageId}
                    rows={rowsJson}
                    theme={themeJson}
                    onLoadOlder={() => loadPreviewPage(session, true)}
                    onLoadNewer={() => loadPreviewPage(session, false)}
                    onMessageLongPress={event =>
                        handleMessageLongPress(
                            session,
                            channelId,
                            event.nativeEvent.messageId,
                            {
                                openChannel: id => onJump(id),
                                openLink,
                                media: event.nativeEvent.media,
                            },
                        )
                    }
                    onLinkPress={event => openLink(event.nativeEvent.url)}
                />
                {preview?.error && (
                    <View style={styles.error}>
                        <Text color="TEXT_MUTED">
                            {t(
                                preview.error === 'missing'
                                    ? 'chat.jump.notFound'
                                    : 'chat.loadFailed',
                            )}
                        </Text>
                    </View>
                )}
            </View>
            {/* ChatPreview's jumpToChatButton, in a bottom safe area view. */}
            <View style={styles.footer}>
                <RipplePressable
                    accessibilityRole="button"
                    style={styles.jump}
                    onPress={() => onJump(channelId, messageId)}
                >
                    <Text
                        variant="text-md/medium"
                        color="INTERACTIVE_TEXT_DEFAULT"
                        style={styles.jumpText}
                    >
                        {t('chat.preview.jump')}
                    </Text>
                </RipplePressable>
            </View>
        </View>
    )
}

/** ChatPreview's jumpToChatButton height. */
const JUMP_HEIGHT = 44

const styles = StyleSheet.create((theme, runtime) => ({
    container: { flex: 1, backgroundColor: theme.colors.BACKGROUND_BASE_LOWER },
    chat: { flex: 1 },
    error: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: theme.colors.BACKGROUND_BASE_LOWER,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.space.PX_16,
    },
    footer: {
        flexShrink: 0,
        backgroundColor: theme.colors.BACKGROUND_SURFACE_HIGH,
        paddingBottom: runtime.insets.bottom,
    },
    jump: {
        height: JUMP_HEIGHT,
        justifyContent: 'center',
        borderTopWidth: 1,
        borderTopColor: theme.colors.BORDER_SUBTLE,
    },
    jumpText: { textAlign: 'center' },
}))
