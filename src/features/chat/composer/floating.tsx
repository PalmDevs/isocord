import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { StyleSheet } from 'react-native-unistyles'
import { scheduleOnRN } from 'react-native-worklets'
import { SLIDE_TIMING, SPRING_STANDARD } from '../../../design/tokens/motion'
import type { ReactNode } from 'react'
import type { PressableProps, StyleProp, ViewStyle } from 'react-native'
import type { AnimatedStyle } from 'react-native-reanimated'

/**
 * The floating chat input of the reference (modules/chat_input/native, the "chatInputFloating" variation of
 * 2026-02-mobile-visual-refresh): its animation constants and the small pieces the composer builds it from.
 */

/**
 * A row above the card (suggestions, attachments, the media row), sprung open and shut like the typing indicator.
 * Its room grows from nothing to the row's height, so it rises from behind the card.
 * A height change while open springs to the new one.
 * While closing it keeps its last content, and unmounts when the spring ends.
 */
export function Reveal({
    open,
    children,
}: {
    open: boolean
    children: ReactNode
}) {
    const [mounted, setMounted] = useState(open)
    const [shown, setShown] = useState(children)
    if (open && !mounted) setMounted(true)
    if (open && shown !== children) setShown(children)
    // 0 until the first layout; kept afterwards so reopening springs at once.
    const height = useSharedValue(0)
    const progress = useSharedValue(0)

    useEffect(() => {
        if (!mounted) return
        if (open) {
            // Not laid out yet: onLayout opens it.
            if (height.get() === 0) return
            progress.set(withSpring(1, SPRING_STANDARD))
            return
        }
        progress.set(
            withSpring(0, SPRING_STANDARD, finished => {
                if (finished) scheduleOnRN(setMounted, false)
            }),
        )
    }, [open, mounted, height, progress])

    const reveal = useAnimatedStyle(() => ({
        height: height.get() * progress.get(),
        opacity: progress.get(),
    }))
    if (!mounted) return null

    return (
        <Animated.View style={[styles.reveal, reveal]}>
            {/* Absolute, so it is measured at its own height rather than the room it has been given. */}
            <View
                onLayout={event => {
                    const measured = event.nativeEvent.layout.height
                    if (measured === 0) return
                    if (height.get() !== 0) {
                        height.set(withSpring(measured, SPRING_STANDARD))
                        return
                    }
                    height.set(measured)
                    if (open) progress.set(withSpring(1, SPRING_STANDARD))
                }}
                style={styles.revealContent}
            >
                {open ? children : shown}
            </View>
        </Animated.View>
    )
}

/**
 * useChatInputFloatingWidth + the FloatingSlot of ChatInputSendButton: a slot that is `width` wide while visible
 * and takes no room at all (the row's gap included) otherwise. Its content is centred over it, so it can finish
 * fading out while the slot is already closing.
 */
export function FloatingSlot({
    visible,
    width,
    height,
    gap,
    children,
}: {
    visible: boolean
    width: number
    height: number
    /** The row's gap, taken back with a negative margin while the slot is closed. */
    gap: number
    children: ReactNode
}) {
    const progress = useSharedValue(visible ? 1 : 0)
    useEffect(() => {
        progress.set(withTiming(visible ? 1 : 0, SLIDE_TIMING))
    }, [visible, progress])
    const style = useAnimatedStyle(() => ({
        width: width * progress.get(),
        marginLeft: -gap * (1 - progress.get()),
    }))
    return (
        <Animated.View style={[styles.slot, { height }, style]}>
            {children}
        </Animated.View>
    )
}

/** Pressable with the PressableOpacity feedback the reference's chat input buttons use. */
export function PressableOpacity({
    style,
    ...props
}: Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle> }) {
    return (
        <Pressable
            {...props}
            style={({ pressed }) => [style, pressed && styles.pressed]}
        />
    )
}

/**
 * ChatInputScrimGradient: the chat's background colour fading in over `height` and solid below that, behind the
 * input. Positioned half its gradient above the container it is in (the container itself overlaps the chat by the
 * same half), so the messages are covered gradually and fully where the input is.
 */
export function ChatInputScrim({
    height,
    color,
    inline = false,
    style,
}: {
    height: number
    color: string
    /** Animated opacity, for the cross-fade with the typing indicator's scrim. */
    style?: StyleProp<AnimatedStyle<ViewStyle>>
    /** ChatInputScrimGradient `inline`: the whole gradient sits above, as behind the typing indicator. */
    inline?: boolean
}) {
    return (
        <Animated.View
            pointerEvents="none"
            style={[
                styles.scrim,
                { top: inline ? -height : -height / 2 },
                style,
            ]}
        >
            {/* Keyed by colour: react-native-svg keeps a gradient's first stops, so a theme change remounts it. */}
            <Svg key={color} width="100%" height={height}>
                <Defs>
                    <LinearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={color} stopOpacity={0} />
                        <Stop offset="1" stopColor={color} stopOpacity={1} />
                    </LinearGradient>
                </Defs>
                <Rect width="100%" height="100%" fill="url(#scrim)" />
            </Svg>
            <Animated.View style={{ flex: 1, backgroundColor: color }} />
        </Animated.View>
    )
}

const styles = StyleSheet.create((_theme, runtime) => ({
    slot: { alignItems: 'center', justifyContent: 'center' },
    pressed: { opacity: 0.5 },
    // Solid down to the screen's edge, behind the keyboard area and navigation bar below the input.
    scrim: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: -runtime.screen.height,
    },
    // Clips the row to the room it has been given so far.
    reveal: { overflow: 'hidden' },
    // Pinned to the top of that room, so the row rises with it from behind the card.
    revealContent: { position: 'absolute', top: 0, left: 0, right: 0 },
}))
