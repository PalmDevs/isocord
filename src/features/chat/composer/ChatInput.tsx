import { useEffect, useRef } from 'react'
import { useWindowDimensions } from 'react-native'
import Animated, {
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { ChannelType } from '../../../core/discord/channelType'
import { useSessionStore } from '../../../core/react'
import { Text } from '../../../design/components/Text'
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

function useChannelPlaceholder(channelId: string): string {
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

function useInputPlaceholder(editable: boolean): string {
    const { channelId } = useComposer()
    const attached = useComposerState(state => state.attached)
    const channelPlaceholder = useChannelPlaceholder(channelId)
    // ShareChatInput's placeholder for a forward's or a share's text.
    if (attached) return t('share.optionalMessage')
    return editable ? channelPlaceholder : t('composer.noPermission')
}

function useSingleLineHeight(): number {
    const { fontScale } = useWindowDimensions()
    return chatInputLineHeight * Math.max(fontScale, 1) + 2 * VERTICAL_INSET
}

/** Reserves a one-line input while the native field is mounting. */
export function ChatInputPlaceholder() {
    const editable = useComposerState(state => state.canSend)
    const placeholder = useInputPlaceholder(editable)
    const draft = useComposerState(state => state.text)
    const height = useSingleLineHeight()
    return (
        <Text
            variant="text-md/medium"
            color={draft ? 'TEXT_DEFAULT' : 'TEXT_MUTED'}
            lineClamp={1}
            style={[styles.placeholder, { height }]}
        >
            {draft || placeholder}
        </Text>
    )
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
export function ChatInput({
    animateInitialHeight = false,
}: {
    animateInitialHeight?: boolean
}) {
    const { attachNative, onSelectionOrTextChange, onTextFlushed } =
        useComposerInternals()
    const composer = useComposer()
    const editable = useComposerState(state => state.canSend)
    const empty = useComposerState(state => state.text === '')
    const placeholder = useInputPlaceholder(editable)
    const maxHeight = useMaxHeight()
    const singleLineHeight = useSingleLineHeight()
    const minimumHeight = animateInitialHeight ? singleLineHeight : MIN_HEIGHT
    const { theme } = useUnistyles()
    const reducedMotion = useReducedMotion()
    const contentHeight = useRef(minimumHeight)
    // Animate draft growth when a one-line frame is already on screen.
    const settled = useRef(animateInitialHeight)
    const height = useSharedValue(minimumHeight)
    const limit = useRef(maxHeight)
    limit.current = maxHeight
    const apply = (animate: boolean) => {
        // Keep the empty field in the reserved frame through native font padding.
        const next =
            animateInitialHeight && empty
                ? minimumHeight
                : Math.min(
                      Math.max(contentHeight.current, minimumHeight),
                      limit.current,
                  )
        height.set(
            animate && !reducedMotion
                ? withTiming(next, INPUT_HEIGHT_TIMING)
                : next,
        )
    }
    // biome-ignore lint/correctness/useExhaustiveDependencies: current height, font scale, and draft state
    useEffect(() => apply(settled.current), [maxHeight, minimumHeight, empty])
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

const styles = StyleSheet.create({
    placeholder: { textAlignVertical: 'center' },
})
