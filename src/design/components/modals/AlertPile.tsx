import { useEffect, useLayoutEffect } from 'react'
import {
    StyleSheet as NativeStyleSheet,
    useWindowDimensions,
    View,
} from 'react-native'
import Animated, {
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StyleSheet } from 'react-native-unistyles'
import { MODAL_SPRING } from '../../tokens/motion'
import { dismissKeyboard } from '../keyboard'
import { Backdrop } from '../overlays/Backdrop'
import { AlertKeyContext } from './alertKeyContext'
import { dismissAlert } from './alertStore'
import { Dialog } from './Dialog'
import type { SharedValue } from 'react-native-reanimated'
import type { AlertEntry } from './alertStore'

/** At most this many alerts are drawn, as a pile; the rest wait behind. */
const MAX_VISIBLE = 3
const MARGIN = 16
const MAX_WIDTH = 400
/** How far each card behind the front one sits above it. */
const CARD_OFFSETS = [0, -20, -34]

const HIDDEN = { opacity: 0, transform: [{ scale: 0.7 }, { translateY: 50 }] }
const SHOWN = { opacity: 1, transform: [{ scale: 1 }, { translateY: 0 }] }

// The reference springs opacity, scale and translateY between SHOWN and HIDDEN with MODAL_SPRING.
const ENTERING = () => {
    'worklet'
    return {
        initialValues: HIDDEN,
        animations: {
            opacity: withSpring(SHOWN.opacity, MODAL_SPRING),
            transform: [
                { scale: withSpring(1, MODAL_SPRING) },
                { translateY: withSpring(0, MODAL_SPRING) },
            ],
        },
    }
}
const EXITING = () => {
    'worklet'
    return {
        initialValues: SHOWN,
        animations: {
            opacity: withSpring(HIDDEN.opacity, MODAL_SPRING),
            transform: [
                { scale: withSpring(0.7, MODAL_SPRING) },
                { translateY: withSpring(50, MODAL_SPRING) },
            ],
        },
    }
}

/**
 * Draws a run of alerts with nothing between them (front-most first): a fading backdrop and a pile
 * of up to three cards. Rendered by ModalStack. Only the front pile takes touches.
 */
export function AlertPile({
    alerts,
    front,
}: {
    alerts: [AlertEntry, ...AlertEntry[]]
    front: boolean
}) {
    const topHeight = useSharedValue(0)
    const visible = alerts.slice(0, MAX_VISIBLE)
    const top = alerts[0]
    const dismissTop = () => {
        if (top.dismissable !== false) dismissAlert(top.key)
    }

    useEffect(dismissKeyboard, [])

    return (
        <View
            pointerEvents={front ? 'box-none' : 'none'}
            importantForAccessibility={front ? 'auto' : 'no-hide-descendants'}
            // Open order, so the pile stays above older sheets while it animates out.
            style={[NativeStyleSheet.absoluteFill, { zIndex: top.order }]}
        >
            <Backdrop
                animated
                onDismiss={top.dismissable === false ? undefined : dismissTop}
            />
            <Dialog onDismiss={dismissTop}>
                {visible.map((alert, index) => (
                    <AlertCard
                        key={alert.key}
                        alert={alert}
                        index={index}
                        topHeight={topHeight}
                    />
                ))}
            </Dialog>
        </View>
    )
}

function AlertCard({
    alert,
    index,
    topHeight,
}: {
    alert: AlertEntry
    index: number
    topHeight: SharedValue<number>
}) {
    const reducedMotion = useReducedMotion()
    const { width, height } = useWindowDimensions()
    const insets = useSafeAreaInsets()
    const sharedIndex = useSharedValue(index)
    useLayoutEffect(() => sharedIndex.set(index), [index, sharedIndex])

    const maxHeight =
        height - MARGIN * 2 - Math.max(insets.top, insets.bottom) * 2
    const stackStyle = useAnimatedStyle(() => {
        const i = sharedIndex.get()
        return {
            height: i > 0 ? topHeight.get() : 'auto',
            transform: reducedMotion
                ? []
                : [
                      { scale: withSpring(1 - i * 0.1, MODAL_SPRING) },
                      {
                          translateY: withSpring(
                              CARD_OFFSETS[i] ?? 0,
                              MODAL_SPRING,
                          ),
                      },
                  ],
        }
    })

    return (
        <Animated.View
            entering={reducedMotion ? undefined : ENTERING}
            exiting={reducedMotion ? undefined : EXITING}
            pointerEvents={index === 0 ? 'box-none' : 'none'}
            importantForAccessibility={
                index === 0 ? 'auto' : 'no-hide-descendants'
            }
            style={[styles.layer, { zIndex: MAX_VISIBLE - index }]}
        >
            <Animated.View
                onLayout={event => {
                    if (index === 0)
                        topHeight.set(event.nativeEvent.layout.height)
                }}
                style={[
                    styles.card,
                    {
                        width: Math.min(MAX_WIDTH, width - MARGIN * 2),
                        maxHeight,
                    },
                    stackStyle,
                ]}
            >
                <AlertKeyContext.Provider value={alert.key}>
                    {alert.node}
                </AlertKeyContext.Provider>
            </Animated.View>
        </Animated.View>
    )
}

const styles = StyleSheet.create(theme => ({
    layer: {
        ...NativeStyleSheet.absoluteFill,
        justifyContent: 'center',
        alignItems: 'center',
    },
    card: {
        overflow: 'hidden',
        backgroundColor: theme.colors.MOBILE_ALERT_BACKGROUND_DEFAULT,
        borderRadius: theme.radii.xl,
        borderWidth: 1,
        borderColor: theme.colors.BORDER_SUBTLE,
        boxShadow: theme.shadows.SHADOW_TOP_HIGH,
    },
}))
