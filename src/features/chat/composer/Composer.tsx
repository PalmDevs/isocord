import { useState } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { useAnimatedStyle, useSharedValue } from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { useTypingUserIds } from '../useTypingUserIds'
import './builtins'
import { ChatInput } from './ChatInput'
import { ChatInputScrim } from './floating'
import { KeyboardArea } from './KeyboardArea'
import { useComposerSlots } from './parsing/slots'
import { useSlowmodeRate } from './state/status'
import { useComposer, useComposerState } from './state/useComposer'
import { Suggestions } from './suggestions/Suggestions'
import { useSuggestion } from './suggestions/useSuggestion'
import { TypingIndicator } from './TypingIndicator'
import type { ComposerActionButton, ComposerPanel } from './parsing/slots'

/** CHAT_INPUT_PILL_CONTENT_SIZE: one line of text with its insets. */
const INPUT_MIN_HEIGHT = 36

/** The panels registered for `placement`, by order. */
function placed(
    panels: Record<string, ComposerPanel>,
    placement: 'above' | 'card',
) {
    return Object.entries(panels)
        .flatMap(([key, panel]) =>
            panel.placement === placement ? [{ key, ...panel }] : [],
        )
        .sort((a, b) => a.order - b.order)
}

/** The action buttons registered for `side`, by order. */
function sided(
    buttons: Record<string, ComposerActionButton>,
    side: ComposerActionButton['side'],
) {
    return Object.entries(buttons)
        .flatMap(([key, button]) =>
            button.side === side ? [{ key, ...button }] : [],
        )
        .sort((a, b) => a.order - b.order)
}

/**
 * The composer under a chat, like the reference's floating chat input.
 * One rounded card over a scrim that fades the chat, with the suggestions above and the keyboard area below.
 * This is only the frame. The composer slots (slots.ts) fill it:
 * `above` panels over the card, `card` panels at its top, then `start` buttons, the text input and `end` buttons.
 * Where the user cannot send, the card is dimmed and holds only the read-only input.
 * Must be inside a ComposerProvider.
 *
 * The container overlaps the chat by half the scrim's height. The chat list leaves the same room.
 */
export function Composer() {
    const composer = useComposer()
    const { channelId } = composer
    const { theme } = useUnistyles()
    const canSend = useComposerState(state => state.canSend)
    const panels = useComposerSlots(state => state.panels)
    const actionButtons = useComposerSlots(state => state.actionButtons)
    const { height: windowHeight } = useWindowDimensions()
    const [pressed, setPressed] = useState(false)
    const suggestion = useSuggestion()
    // useTypingUserIdsForDisplay(channel.id, 4): four names already read as "Several people".
    const typingUserIds = useTypingUserIds(channelId, 4)
    const slowmodeRate = useSlowmodeRate(channelId)
    // hasTypingIndicatorContent: someone types or the channel has slowmode, and the autocomplete is not up.
    // Nobody types in a thread that does not exist yet; those typing, and the slowmode, are the channel's.
    // A forward's or a share's text is not the channel's either.
    const apart = useComposerState(
        state => state.creatingThread || state.attached,
    )
    const typing =
        (typingUserIds.length > 0 || slowmodeRate > 0) && !suggestion && !apart
    const typingProgress = useSharedValue(0)
    const mobile = theme.modules.mobile
    const scrimGradient = mobile.CHAT_INPUT_FLOATING_SCRIM_GRADIENT_HEIGHT
    // The rows above the card (the media row, attachments) as they spring open. Deliberately differs from the
    // reference, whose scrim stays put: the gradient rises with them until it ends at their top, so they sit on the
    // solid part instead of half over the messages.
    const aboveHeight = useSharedValue(0)
    const scrimStyle = useAnimatedStyle(() => ({
        opacity: 1 - typingProgress.get(),
        top:
            -scrimGradient / 2 - Math.min(aboveHeight.get(), scrimGradient / 2),
    }))

    // The floating suggestions are anchored to the top of the accessories (the autocomplete) and of the card (the
    // emoji bar). Measured in the container, which starts half the scrim's gradient into the wrapper's padding.
    const [accessoriesTop, setAccessoriesTop] = useState(0)
    const [cardTop, setCardTop] = useState(0)
    const containerTop =
        windowHeight - mobile.CHAT_INPUT_FLOATING_SCRIM_GRADIENT_HEIGHT / 2

    const draw = (
        items: { key: string; Component: ComposerPanel['Component'] }[],
    ) =>
        canSend
            ? items.map(({ key, Component }) => (
                  <Component key={key} channelId={channelId} />
              ))
            : null

    return (
        // Reaches up to the top of the window without taking any room (the margin cancels the padding), so the
        // panel sheet expanded over the chat is inside its parents' bounds and Android routes touches (a list's
        // scroll) to it. Touches outside the composer and the sheet pass through to the chat.
        <View
            pointerEvents="box-none"
            style={{ marginTop: -windowHeight, paddingTop: windowHeight }}
        >
            {/* The chat list watches this view's height (composerNativeId): while the user reads older messages,
                the card growing (a reply bar, more lines, the attachments) covers the list instead of moving it. */}
            <View
                nativeID={composer.nativeId}
                collapsable={false}
                style={styles.container}
            >
                {/* Gives way to the typing indicator's scrim while it is up. */}
                <ChatInputScrim
                    height={mobile.CHAT_INPUT_FLOATING_SCRIM_GRADIENT_HEIGHT}
                    color={theme.colors.BACKGROUND_BASE_LOWER}
                    style={scrimStyle}
                />
                <TypingIndicator
                    key={channelId}
                    channelId={channelId}
                    userIds={typingUserIds}
                    visible={typing}
                    progress={typingProgress}
                />
                <View
                    collapsable={false}
                    onLayout={event =>
                        setAccessoriesTop(event.nativeEvent.layout.y)
                    }
                />
                <View
                    onLayout={event =>
                        aboveHeight.set(event.nativeEvent.layout.height)
                    }
                >
                    {draw(placed(panels, 'above'))}
                </View>
                <View
                    style={styles.cardWrap}
                    onLayout={event => setCardTop(event.nativeEvent.layout.y)}
                >
                    <View
                        style={[
                            styles.card(pressed),
                            !canSend && styles.disabled,
                        ]}
                        onStartShouldSetResponder={() => true}
                        onResponderGrant={() => setPressed(true)}
                        onResponderRelease={() => {
                            setPressed(false)
                            if (canSend) composer.openSystemKeyboard()
                        }}
                        onResponderTerminate={() => setPressed(false)}
                    >
                        {draw(placed(panels, 'card'))}
                        <View style={styles.main}>
                            {draw(sided(actionButtons, 'start'))}
                            <View style={styles.input}>
                                <ChatInput />
                            </View>
                            {draw(sided(actionButtons, 'end'))}
                        </View>
                    </View>
                </View>
            </View>
            {/* Over the chat rather than in the container, so they don't push it up; under the panel sheets. */}
            {canSend && (
                <Suggestions
                    suggestion={suggestion}
                    listAnchor={containerTop + accessoriesTop}
                    barAnchor={containerTop + cardTop}
                />
            )}
            <KeyboardArea channelId={channelId} />
        </View>
    )
}

const styles = StyleSheet.create(theme => {
    const mobile = theme.modules.mobile
    return {
        // Overlaps the chat by half the scrim's gradient; ChatPanel gives the list the same room at its bottom.
        container: {
            marginTop: -mobile.CHAT_INPUT_FLOATING_SCRIM_GRADIENT_HEIGHT / 2,
            overflow: 'visible',
        },
        cardWrap: {
            paddingHorizontal: mobile.CHAT_INPUT_CONTAINER_HORIZONTAL_PADDING,
        },
        card: (pressed: boolean) => ({
            flexDirection: 'column',
            overflow: 'hidden',
            borderWidth: mobile.CHAT_INPUT_FLOATING_ACCESSORY_BORDER_WIDTH,
            borderRadius: mobile.CHAT_INPUT_FLOATING_BORDER_RADIUS,
            backgroundColor: pressed
                ? theme.colors.MOBILE_CHATINPUT_BACKGROUND_ACTIVE
                : theme.colors.MOBILE_CHATINPUT_BACKGROUND_DEFAULT,
            borderColor: pressed
                ? theme.colors.MOBILE_CHATINPUT_BORDER_ACTIVE
                : theme.colors.MOBILE_CHATINPUT_BORDER_DEFAULT,
        }),
        disabled: { opacity: 0.6 },
        main: {
            flexDirection: 'row',
            alignItems: 'flex-end',
            paddingHorizontal:
                mobile.CHAT_INPUT_FLOATING_CONTENT_PADDING_HORIZONTAL,
            paddingVertical:
                mobile.CHAT_INPUT_FLOATING_CONTENT_PADDING_VERTICAL,
            gap: mobile.CHAT_INPUT_FLOATING_CONTENT_GAP,
        },
        input: { flex: 1, minWidth: 0, minHeight: INPUT_MIN_HEIGHT },
    }
})
