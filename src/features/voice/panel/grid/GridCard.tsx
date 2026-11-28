import { useEffect } from 'react'
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated'
import { StyleSheet } from 'react-native-unistyles'
import { scheduleOnRN } from 'react-native-worklets'
import {
    VOICE_CARD_OPACITY_TIMING,
    VOICE_CARD_SCALE_SPRING,
    VOICE_PANEL_LAYOUT_SPRING,
} from '../../../../design/tokens/motion'
import type { ReactNode } from 'react'
import type { CardFrame } from './gridLayout'

/** VoicePanelCard: a hidden card's scale. */
export const HIDDEN_SCALE = 0.8
/** VoicePanelCard: a leaving card sinks by this share of its height. */
export const LEAVE_DROP = 1 / 4

/**
 * VoicePanelCard's AnimatedWrapper: places a card at `frame` and springs it to a new one with LAYOUT_PHYSICS. A card
 * that `appears` fades and grows in. A `leaving` one fades, shrinks and sinks, then calls `onGone`.
 */
export function GridCard({
    frame,
    appears,
    leaving,
    onGone,
    children,
}: {
    frame: CardFrame
    appears: boolean
    leaving: boolean
    onGone: () => void
    children: ReactNode
}) {
    // useSharedTransitionState: a card mounted with the grid starts shown.
    const visible = useSharedValue(appears ? 0 : 1)
    useEffect(() => visible.set(1), [visible])
    const style = useAnimatedStyle(() => {
        const shown = visible.get() === 1 && !leaving
        const y = leaving ? frame.y + frame.height * LEAVE_DROP : frame.y
        return {
            width: withSpring(frame.width, VOICE_PANEL_LAYOUT_SPRING),
            height: withSpring(frame.height, VOICE_PANEL_LAYOUT_SPRING),
            opacity: withTiming(
                shown ? 1 : 0,
                VOICE_CARD_OPACITY_TIMING,
                finished => {
                    'worklet'
                    if (finished && leaving) scheduleOnRN(onGone)
                },
            ),
            transform: [
                { translateX: withSpring(frame.x, VOICE_PANEL_LAYOUT_SPRING) },
                { translateY: withSpring(y, VOICE_PANEL_LAYOUT_SPRING) },
                {
                    scale: withSpring(
                        shown ? 1 : HIDDEN_SCALE,
                        VOICE_CARD_SCALE_SPRING,
                    ),
                },
            ],
        }
    })
    return (
        <Animated.View
            pointerEvents={leaving ? 'none' : 'auto'}
            style={[styles.card, style]}
        >
            {children}
        </Animated.View>
    )
}

const styles = StyleSheet.create(theme => ({
    // Opaque under the card's translucent tile colour: cards crossing during a re-layout don't show through.
    card: {
        position: 'absolute',
        top: 0,
        left: 0,
        borderRadius: theme.radii.lg,
        backgroundColor: theme.colors.MOBILE_VOICE_PANEL_BACKGROUND,
    },
}))
