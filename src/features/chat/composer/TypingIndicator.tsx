import { useEffect, useState } from 'react'
import { View } from 'react-native'
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { scheduleOnRN } from 'react-native-worklets'
import { Ellipsis } from '../../../design/components/Ellipsis'
import { showToast } from '../../../design/components/overlays/toastStore'
import { Text } from '../../../design/components/Text'
import { Icon } from '../../../design/icons/Icon'
import { t } from '../../../i18n'
import { typingInsetSpring } from '../../../native/NativeIsocordConstants'
import { TypingText } from '../typing'
import { ChatInputScrim, PressableOpacity } from './floating'
import { useCanBypassSlowmode, useSlowmodeRate } from './state/status'
import { useComposerInternals, useComposerState } from './state/useComposer'
import type { SharedValue } from 'react-native-reanimated'
import type { MessageKey } from '../../../i18n'

/** SPRING_STANDARD, but with the physics the native list follows the indicator's room with. */
const TYPING_SPRING = { ...typingInsetSpring, overshootClamping: true } as const

/**
 * TypingIndicator (chat/native): who is typing, above the composer on a short inline scrim.
 * Laid out like CustomTypingIndicatorDisplay (dots and text 8 apart), without its emojis.
 * The channel's slowmode (SlowModeIndicator) sits on the right.
 * It is up while either has content (hasTypingIndicatorContent).
 * It springs up from its own height once laid out, and springs back down when nobody types.
 * The names stay until it is gone.
 *
 * `progress` (0 hidden, 1 shown) is shared with the composer, which fades its scrim out as this one fades in.
 * The height goes to the composer state while shown, so the chat list makes room.
 */
export function TypingIndicator({
    channelId,
    userIds,
    visible,
    progress,
}: {
    channelId: string
    userIds: readonly string[]
    visible: boolean
    progress: SharedValue<number>
}) {
    const { theme } = useUnistyles()
    const { store } = useComposerInternals()
    const [mounted, setMounted] = useState(visible)
    const [shownIds, setShownIds] = useState(userIds)
    if (visible && !mounted) setMounted(true)
    if (visible && shownIds !== userIds) setShownIds(userIds)
    // 0 until the first layout; hidden until then, as the reference is before it has measured itself.
    const height = useSharedValue(0)

    useEffect(() => {
        if (!mounted) return
        if (visible) {
            // Not laid out yet: onLayout shows it.
            if (height.get() === 0) return
            progress.set(withSpring(1, TYPING_SPRING))
            store.setState({ typingInset: height.get() })
            return
        }
        store.setState({ typingInset: 0 })
        progress.set(
            withSpring(0, TYPING_SPRING, finished => {
                if (finished) scheduleOnRN(setMounted, false)
            }),
        )
    }, [visible, mounted, height, progress, store])
    // Leaving the chat or switching channels takes the room back and the composer's scrim with it at once.
    useEffect(
        () => () => {
            store.setState({ typingInset: 0 })
            progress.set(0)
        },
        [store, progress],
    )

    const slide = useAnimatedStyle(() => ({
        opacity: height.get() === 0 ? 0 : 1,
        transform: [{ translateY: height.get() * (1 - progress.get()) }],
    }))
    const fade = useAnimatedStyle(() => ({ opacity: progress.get() }))
    if (!mounted) return null

    return (
        <>
            {/* In place of the composer's own scrim: solid behind the composer, the gradient above this. */}
            <Animated.View
                pointerEvents="none"
                // Coloured inline: a unistyles colour next to an animated style keeps the old theme.
                style={[
                    styles.solidScrim,
                    { backgroundColor: theme.colors.BACKGROUND_BASE_LOWER },
                    fade,
                ]}
            />
            {/* Only the slowmode indicator takes touches; the rest passes them to the chat. */}
            <View pointerEvents="box-none" style={styles.accessories}>
                <ChatInputScrim
                    inline
                    height={
                        theme.modules.mobile
                            .CHAT_INPUT_FLOATING_INLINE_FULL_GRADIENT_HEIGHT
                    }
                    color={theme.colors.BACKGROUND_BASE_LOWER}
                    style={fade}
                />
                <Animated.View
                    onLayout={event => {
                        if (height.get() !== 0) return
                        const measured = event.nativeEvent.layout.height
                        height.set(measured)
                        if (!visible) return
                        progress.set(withSpring(1, TYPING_SPRING))
                        store.setState({ typingInset: measured })
                    }}
                    pointerEvents="box-none"
                    style={[styles.wrapper, slide]}
                >
                    <View pointerEvents="none" style={styles.row}>
                        {shownIds.length > 0 && (
                            <>
                                <Ellipsis />
                                <TypingText
                                    channelId={channelId}
                                    userIds={shownIds}
                                    variant="text-xs/medium"
                                    boldVariant="text-xs/bold"
                                    color="INTERACTIVE_TEXT_DEFAULT"
                                />
                            </>
                        )}
                    </View>
                    <SlowmodeIndicator
                        channelId={channelId}
                        hasTypingText={shownIds.length > 0}
                    />
                </Animated.View>
            </View>
        </>
    )
}

/** SlowmodeUtils.getSlowmodeDescription: "every 1 hour 30 seconds", leaving out the units at 0. */
function slowmodeDescription(rate: number): string {
    const units: [number, 'hours' | 'minutes' | 'seconds'][] = [
        [Math.floor(rate / 3600), 'hours'],
        [Math.floor((rate % 3600) / 60), 'minutes'],
        [rate % 60, 'seconds'],
    ]
    const duration = units
        .filter(([count]) => count > 0)
        .map(([count, unit]) =>
            t(
                `composer.slowmode.${unit}.${count === 1 ? 'one' : 'other'}` as MessageKey,
                { count },
            ),
        )
        .join(' ')
    return t('composer.slowmode.info', { duration })
}

/** SlowmodeUtils.getSlowmodeIndicatorText: m:ss (h:mm:ss from an hour) of the cooldown left. */
function cooldownText(seconds: number): string {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const ss = String(seconds % 60).padStart(2, '0')
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/**
 * SlowModeIndicator: the cooldown left, "Slowmode is enabled." or "Slowmode Immune", then the timer icon.
 * A press toasts how often members can send (CHANNEL_SLOWMODE_INFO).
 * While someone types, the idle text gives way to the names, leaving the icon.
 * Unlike the reference, the cooldown stays: it says when the user can send again.
 */
function SlowmodeIndicator({
    channelId,
    hasTypingText,
}: {
    channelId: string
    hasTypingText: boolean
}) {
    const rate = useSlowmodeRate(channelId)
    const immune = useCanBypassSlowmode(channelId)
    const cooldown = useComposerState(state => state.slowmode)
    if (rate === 0) return null
    const text = immune
        ? t('composer.slowmode.immune')
        : cooldown > 0
          ? cooldownText(cooldown)
          : hasTypingText
            ? null
            : t('composer.slowmode.enabled')
    return (
        <PressableOpacity
            hitSlop={8}
            onPress={() =>
                showToast({
                    key: 'CHANNEL_SLOWMODE_INFO',
                    icon: 'TimerIcon',
                    content: slowmodeDescription(rate),
                })
            }
            style={styles.slowmode}
        >
            {text !== null && (
                <Text
                    variant="text-xs/medium"
                    color="INTERACTIVE_TEXT_DEFAULT"
                    lineClamp={1}
                    tabularNumbers
                >
                    {text}
                </Text>
            )}
            <Icon name="TimerIcon" size="xxs" style={styles.timer} />
        </PressableOpacity>
    )
}

const styles = StyleSheet.create(theme => {
    const mobile = theme.modules.mobile
    return {
        solidScrim: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
        },
        // ChatInput `accessories`: stacked on top of the composer without taking room in it.
        accessories: {
            position: 'absolute',
            bottom: '100%',
            left: 0,
            right: 0,
        },
        // TypingIndicator `typingWrapper` and `wrapperHoriz`: the typing text on the left, slowmode on the right.
        wrapper: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: mobile.CHAT_INPUT_FLOATING_ACCESSORY_PADDING_TOP,
            paddingBottom: theme.space.PX_4,
            paddingLeft: 2 * mobile.CHAT_INPUT_CONTAINER_HORIZONTAL_PADDING,
            paddingRight: mobile.CHAT_INPUT_CONTAINER_HORIZONTAL_PADDING,
        },
        // TypingIndicator `horiz` holding CustomTypingIndicatorDisplay's Stack (horizontal, spacing 8, centred).
        row: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space.PX_8,
            marginRight: theme.space.PX_8,
        },
        // SlowModeIndicator `container` and `icon`.
        slowmode: { flexDirection: 'row', alignItems: 'center' },
        timer: { marginLeft: theme.space.PX_4 },
    }
})
