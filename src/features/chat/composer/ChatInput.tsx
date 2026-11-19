import { useEffect, useRef } from 'react'
import { useWindowDimensions } from 'react-native'
import Animated, {
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated'
import { useUnistyles } from 'react-native-unistyles'
import { ChannelType } from '../../../core/discord/channelType'
import { useSessionStore } from '../../../core/react'
import { INPUT_HEIGHT_TIMING } from '../../../design/tokens/motion'
import { t } from '../../../i18n'
import ChatInputNative from '../../../native/ChatInputNativeComponent'
import { chatInputLineHeight } from '../../../native/NativeIsocordConstants'
import { computeChannelName } from '../../../stores/channels/channelName'
import { channelsStore } from '../../../stores/channels/channels'
import { usersStore } from '../../../stores/users'
import { lastKeyboardHeight } from './input/keyboard'
import {
    useComposer,
    useComposerInternals,
    useComposerState,
} from './state/useComposer'

/**
 * The reference's CHAT_INPUT_PILL_CONTENT_SIZE: one line of text plus the native vertical inset on each side.
 * The inset is 8 rather than the reference's 5 so the first line is centred on the 32 dp buttons beside
 * the input, which our native view does with padding where the reference's does with its own text metrics.
 */
const VERTICAL_INSET = 8
const MIN_HEIGHT = chatInputLineHeight + 2 * VERTICAL_INSET
/** MAX_HEIGHT of the reference's useChatInputMaxHeight, and the room kept for the chat above the input. */
const MAX_INPUT_HEIGHT = 200
const MIN_INPUT_HEIGHT = 72

function usePlaceholder(channelId: string): string {
    const channel = useSessionStore(
        channelsStore,
        state => state.channels[channelId],
    )
    const users = useSessionStore(usersStore, state => state.users)
    if (!channel) return ''
    if (channel.type === ChannelType.DM)
        return t('composer.placeholder.dm', {
            name: computeChannelName(channel, users),
        })
    if (channel.type === ChannelType.GROUP_DM)
        return t('composer.placeholder.group', {
            name: computeChannelName(channel, users),
        })
    return t('composer.placeholder.channel', { name: channel.name ?? '' })
}

/** useChatInputMaxHeight: dp the input may grow to, leaving room for the chat above whatever keyboard or panel is up. */
function useMaxHeight(): number {
    const { height: windowHeight } = useWindowDimensions()
    const keyboardUp = useComposerState(
        state => state.panel !== null || state.keyboardOpen,
    )
    const keyboardHeight = keyboardUp ? lastKeyboardHeight() : 0
    return Math.min(
        MAX_INPUT_HEIGHT,
        Math.max(
            MIN_INPUT_HEIGHT,
            windowHeight - keyboardHeight - MAX_INPUT_HEIGHT,
        ),
    )
}

/**
 * The native text field, wired to the composer: events in, commands out through `useComposer()`. Read-only, with
 * a placeholder saying so, where the user cannot send.
 */
export function ChatInput() {
    const { attachNative, onSelectionOrTextChange, onTextFlushed } =
        useComposerInternals()
    const composer = useComposer()
    const editable = useComposerState(state => state.canSend)
    const attached = useComposerState(state => state.attached)
    const channelPlaceholder = usePlaceholder(composer.channelId)
    // ShareChatInput's placeholder for a forward's or a share's text.
    const placeholder = attached
        ? t('share.optionalMessage')
        : editable
          ? channelPlaceholder
          : t('composer.noPermission')
    const maxHeight = useMaxHeight()
    const { theme } = useUnistyles()
    const reducedMotion = useReducedMotion()
    const contentHeight = useRef(MIN_HEIGHT)
    // The first size (the chat opening, a draft restored) is taken as is; later ones are animated.
    const settled = useRef(false)
    const height = useSharedValue(MIN_HEIGHT)
    const limit = useRef(maxHeight)
    limit.current = maxHeight
    const apply = (animate: boolean) => {
        const next = Math.min(
            Math.max(contentHeight.current, MIN_HEIGHT),
            limit.current,
        )
        height.set(
            animate && !reducedMotion
                ? withTiming(next, INPUT_HEIGHT_TIMING)
                : next,
        )
    }
    // biome-ignore lint/correctness/useExhaustiveDependencies: only the limit changing matters
    useEffect(() => apply(settled.current), [maxHeight])
    const heightStyle = useAnimatedStyle(() => ({ height: height.get() }))

    return (
        <Animated.View style={heightStyle}>
            <ChatInputNative
                ref={attachNative}
                style={{ height: '100%' }}
                textColor={theme.colors.TEXT_DEFAULT}
                placeholder={placeholder}
                placeholderColor={theme.colors.TEXT_MUTED}
                selectionColor={theme.isDark ? '#ffffff99' : '#5865f299'}
                keyboardAppearance={theme.isDark ? 'dark' : 'light'}
                keyboardType="default"
                editable={editable}
                shouldShowCursor
                setNoExtractUI
                showFormatMenu
                markAsSpoilerTitle={t('composer.spoiler')}
                maxHeight={maxHeight}
                verticalInset={VERTICAL_INSET}
                onChangeContentSize={event => {
                    contentHeight.current = event.nativeEvent.height
                    apply(settled.current)
                    settled.current = true
                }}
                onSelectionOrTextChange={onSelectionOrTextChange}
                onTextFlushed={onTextFlushed}
                onPasteImage={event => {
                    const { url, width, height, type } = event.nativeEvent
                    composer.addAttachments([
                        { uri: url, width, height, mimeType: type },
                    ])
                }}
                onRequestSend={() => composer.send()}
            />
        </Animated.View>
    )
}
