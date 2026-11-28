import Animated, {
    interpolate,
    useAnimatedStyle,
} from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { MODAL_HIDDEN } from '../../../../design/tokens/motion'
import { cardFrame } from './dockFrame'
import { presenceStyle } from './useCardPresence'
import type { StyleProp, ViewStyle } from 'react-native'
import type { DerivedValue } from 'react-native-reanimated'
import type { CardPresence } from './useCardPresence'
import type { DockMotion } from './useDockMotion'

/**
 * The card: its frame is the dock's motion, blended into the pre-join's and the PIP's. It enters and leaves like an
 * alert, and follows a finger pulling the pre-join down.
 */
export function DockCard({
    motion,
    presence,
    closing,
    children,
}: {
    motion: DockMotion
    presence: CardPresence
    closing: boolean
    children: React.ReactNode
}) {
    const { theme } = useUnistyles()
    const radius = theme.radii.lg
    const cardStyle = useAnimatedStyle(() => {
        const frame = cardFrame(motion, radius)
        const alert = presenceStyle(presence)
        return {
            width: frame.width,
            height: frame.height,
            borderTopLeftRadius: frame.topRadius,
            borderTopRightRadius: frame.topRadius,
            borderBottomLeftRadius: frame.bottomRadius,
            borderBottomRightRadius: frame.bottomRadius,
            opacity: alert.opacity,
            transform: [
                { translateX: frame.x },
                { translateY: frame.y + presence.drag.get() },
                { scale: alert.scale },
                { translateY: alert.translateY },
            ],
        }
    })
    return (
        <Animated.View
            pointerEvents={closing ? 'none' : 'box-none'}
            style={[styles.card, cardStyle]}
        >
            {children}
        </Animated.View>
    )
}

/**
 * One state's contents in the card: the pre-join's, the dock's or the PIP's. They fade and shrink away like an
 * alert as `hidden` goes to 1, while the next state's enter the same way. Their children keep fixed sizes, so the
 * card's frame never relayouts them.
 */
export function MorphLayer({
    hidden,
    shown,
    pointerEvents = 'auto',
    style,
    children,
}: {
    hidden: DerivedValue<number>
    /** Whether this state is the card's own: only then it takes touches and is read out. */
    shown: boolean
    pointerEvents?: 'auto' | 'box-none'
    style: StyleProp<ViewStyle>
    children: React.ReactNode
}) {
    const fade = useAnimatedStyle(() => {
        const progress = hidden.get()
        return {
            opacity: interpolate(progress, [0, 1], [1, MODAL_HIDDEN.opacity]),
            transform: [
                {
                    scale: interpolate(
                        progress,
                        [0, 1],
                        [1, MODAL_HIDDEN.scale],
                    ),
                },
            ],
        }
    })
    return (
        <Animated.View
            pointerEvents={shown ? pointerEvents : 'none'}
            importantForAccessibility={shown ? 'auto' : 'no-hide-descendants'}
            style={[style, fade]}
        >
            {children}
        </Animated.View>
    )
}

const styles = StyleSheet.create(theme => ({
    // Absolute children without insets are centred by these, so they follow the card's frame.
    card: {
        position: 'absolute',
        left: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        backgroundColor: theme.colors.MOBILE_VOICE_PANEL_BACKGROUND,
    },
}))
