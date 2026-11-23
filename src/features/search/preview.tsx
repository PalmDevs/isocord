import { useIsFocused } from '@react-navigation/native'
import { useEffect, useState } from 'react'
import { BackHandler, Keyboard, useWindowDimensions, View } from 'react-native'
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler'
import Animated, {
    Extrapolation,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated'
import { StyleSheet } from 'react-native-unistyles'
import { scheduleOnRN } from 'react-native-worklets'
import {
    useModalOpen,
    useNativeDismissGuard,
} from '../../design/components/overlays/ModalStack'
import {
    panelBackStyle,
    usePanelBackPreview,
} from '../../design/components/overlays/usePanelBackPreview'
import {
    DECELERATED_EASING,
    PANEL_CLOSE_MS,
    PANEL_MIN_FLING_VELOCITY,
    PANEL_OPEN_MS,
    PANEL_TOUCH_SLOP,
    STANDARD_EASING,
} from '../../design/tokens/motion'
import { ChatPreview } from '../chat/ChatPreview'
import { openChannel } from '../chat/links/openChannel'
import { SearchPreviewContext } from './useOpenSearchPreview'
import type { ReactNode } from 'react'

const SCRIM_OPACITY = 0.5

/**
 * A search surface (the channel details, the DMs search, the Notifications tab) with the preview of a result:
 * SearchNavigator's SEARCH_CHAT_PREVIEW screen, here a panel that slides in over the search. Back, its arrow or a
 * rightward swipe (as the chat panels close) slides it away; "Jump to Message" leaves search (`onDismiss`) for the
 * message in its channel.
 */
export function SearchPreviewHost({
    onDismiss,
    closeOnJump = false,
    stackPicker,
    active = true,
    children,
}: {
    onDismiss: () => void
    /** The host stays on screen after a jump (the Notifications tab): the preview is put away at once. */
    closeOnJump?: boolean
    stackPicker?: { open: boolean; close: () => void }
    active?: boolean
    children: ReactNode
}) {
    const { width } = useWindowDimensions()
    // 0 is fully open, `width` fully closed.
    const x = useSharedValue(width)
    const [shown, setShown] = useState<{
        channelId: string
        messageId: string
    }>()
    const [open, setOpen] = useState(false)

    const show = (channelId: string, messageId: string) => {
        Keyboard.dismiss()
        setShown({ channelId, messageId })
        setOpen(true)
        x.set(
            withTiming(0, {
                duration: PANEL_OPEN_MS,
                easing: STANDARD_EASING,
            }),
        )
    }
    const slideAway = (swipe: boolean) => {
        'worklet'
        x.set(
            withTiming(
                width,
                {
                    duration: PANEL_CLOSE_MS,
                    easing: swipe ? DECELERATED_EASING : STANDARD_EASING,
                },
                finished => {
                    'worklet'
                    if (finished) scheduleOnRN(setShown, undefined)
                },
            ),
        )
    }
    const close = () => {
        setOpen(false)
        slideAway(false)
    }

    const modalOpen = useModalOpen()
    const focused = useIsFocused()
    const { offset } = usePanelBackPreview(
        open && active && focused && !modalOpen ? 'searchPreview' : undefined,
        width,
        true,
    )
    useNativeDismissGuard(
        stackPicker !== undefined && (open || stackPicker.open) && !modalOpen,
        () => {
            if (open) close()
            else stackPicker?.close()
        },
    )

    // Only a rightward drag activates; a leftward one is left to the list inside.
    const pan = usePanGesture({
        enabled: open,
        activeOffsetX: [-width, PANEL_TOUCH_SLOP],
        failOffsetY: [-PANEL_TOUCH_SLOP, PANEL_TOUCH_SLOP],
        onUpdate: event => {
            x.set(Math.max(0, Math.min(width, x.get() + event.changeX)))
        },
        onDeactivate: event => {
            const fling = Math.abs(event.velocityX) > PANEL_MIN_FLING_VELOCITY
            // The system took the touch (its back gesture): the preview stays.
            const stays =
                event.canceled ||
                (fling ? event.velocityX < 0 : x.get() < width / 2)
            if (stays) {
                x.set(
                    withTiming(0, {
                        duration: PANEL_OPEN_MS,
                        easing: DECELERATED_EASING,
                    }),
                )
                return
            }
            scheduleOnRN(setOpen, false)
            slideAway(true)
        },
    })
    const jump = (channelId: string, messageId?: string) => {
        if (closeOnJump) {
            setOpen(false)
            x.set(width)
            setShown(undefined)
        }
        onDismiss()
        openChannel(channelId, messageId)
    }

    // Back closes the preview before anything under it (the last listener added runs first).
    // biome-ignore lint/correctness/useExhaustiveDependencies: close only uses setters and the shared value
    useEffect(() => {
        if (!open || !active || !focused) return
        const subscription = BackHandler.addEventListener(
            'hardwareBackPress',
            () => {
                close()
                return true
            },
        )
        return () => subscription.remove()
    }, [open, active, focused])

    const panelStyle = useAnimatedStyle(() =>
        panelBackStyle(x.get(), offset.get()),
    )
    const scrimStyle = useAnimatedStyle(() => ({
        opacity: interpolate(
            x.get(),
            [width, 0],
            [0, SCRIM_OPACITY],
            Extrapolation.CLAMP,
        ),
    }))

    return (
        <SearchPreviewContext value={show}>
            <View style={styles.root}>
                <View
                    collapsable={false}
                    style={styles.root}
                    importantForAccessibility={
                        open ? 'no-hide-descendants' : 'auto'
                    }
                >
                    {children}
                </View>
                {shown && (
                    <>
                        <Animated.View
                            pointerEvents="none"
                            style={[styles.scrim, scrimStyle]}
                        />
                        <GestureDetector gesture={pan}>
                            <Animated.View
                                collapsable={false}
                                style={[styles.panel, panelStyle]}
                            >
                                <ChatPreview
                                    key={`${shown.channelId}:${shown.messageId}`}
                                    channelId={shown.channelId}
                                    messageId={shown.messageId}
                                    onBack={close}
                                    onJump={jump}
                                />
                            </Animated.View>
                        </GestureDetector>
                    </>
                )}
            </View>
        </SearchPreviewContext>
    )
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'black' },
    panel: StyleSheet.absoluteFillObject,
})
