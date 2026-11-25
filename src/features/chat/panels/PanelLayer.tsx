import { GestureDetector } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'
import { StyleSheet } from 'react-native-unistyles'
import { ThemedGradient } from '../../../design/components/ThemedGradient'
import type { ComponentProps, ReactNode } from 'react'
import type { usePanGesture } from 'react-native-gesture-handler'

type Gesture = ReturnType<typeof usePanGesture>
type AnimatedStyle = ComponentProps<typeof Animated.View>['style']

/** A full-size sliding panel over a dimming scrim. Covered layers are hidden from accessibility. */
export function PanelLayer({
    scrimStyle,
    style,
    accessible,
    gesture,
    children,
}: {
    scrimStyle: AnimatedStyle
    style: AnimatedStyle
    /** No layer covers this one. */
    accessible: boolean
    gesture?: Gesture
    children: ReactNode
}) {
    const panel = (
        <Animated.View
            collapsable={false}
            pointerEvents={accessible ? 'auto' : 'none'}
            style={[styles.panel, style]}
            importantForAccessibility={
                accessible ? 'auto' : 'no-hide-descendants'
            }
        >
            {/* Hides the chat below on a gradient theme. The panels draw their own see-through colour. */}
            <ThemedGradient />
            {children}
        </Animated.View>
    )
    return (
        <>
            <Animated.View
                pointerEvents="none"
                style={[styles.scrim, scrimStyle]}
            />
            {gesture ? (
                <GestureDetector gesture={gesture}>{panel}</GestureDetector>
            ) : (
                panel
            )}
        </>
    )
}

const styles = StyleSheet.create(theme => ({
    scrim: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundColor: 'black',
    },
    panel: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundColor: theme.colors.BACKGROUND_BASE_LOWER,
    },
}))
