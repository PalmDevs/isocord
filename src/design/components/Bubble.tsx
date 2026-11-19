import { useEffect, useRef, useState } from 'react'
import {
    Modal,
    StyleSheet as NativeStyleSheet,
    Pressable,
    useWindowDimensions,
    View,
} from 'react-native'
import Animated, {
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated'
import { StyleSheet } from 'react-native-unistyles'
import { scheduleOnRN } from 'react-native-worklets'
import { t } from '../../i18n'
import { TOOLTIP_SPRING } from '../tokens/motion'
import type { ReactNode } from 'react'
import type { SemanticColor } from '../tokens'
import type { AnchorRect } from './overlays/popoverHooks'

export type BubblePosition = 'top' | 'bottom' | 'left' | 'right'

const ARROW = 6
const EDGE = 12
const GAP = 2
/** The bubble slides in from this far towards the anchor. */
const SLIDE = 8

export interface BubbleProps {
    anchor: AnchorRect
    /** Which side of the anchor the bubble sits on; the arrow points back at the anchor. */
    position?: BubblePosition
    /** Colour of the arrow, which should match the body's background. */
    arrowColor: SemanticColor
    /** Called after the bubble has faded out, when the user taps outside it or presses back. */
    onDismiss: () => void
    /** Set false to play the exit animation from outside; `onExited` runs once it has faded out. */
    visible?: boolean
    onExited?: () => void
    children?: ReactNode
}

/**
 * Callout with an arrow, next to an anchor, in a transparent modal. Shared by Tooltip and Coachmark,
 * which supply the body. The bubble is laid out invisibly first so it can be centred on the anchor
 * and kept on screen.
 */
export function Bubble({
    anchor,
    position = 'top',
    arrowColor,
    onDismiss,
    visible = true,
    onExited,
    children,
}: BubbleProps) {
    const screen = useWindowDimensions()
    const reducedMotion = useReducedMotion()
    const progress = useSharedValue(0)
    const closing = useRef(false)
    const [size, setSize] = useState<{ width: number; height: number } | null>(
        null,
    )
    const vertical = position === 'top' || position === 'bottom'

    const centerX = anchor.x + anchor.width / 2
    const centerY = anchor.y + anchor.height / 2
    let left = 0
    let top = 0
    let arrowOffset = 0
    if (size) {
        if (vertical) {
            left = Math.max(
                EDGE,
                Math.min(
                    centerX - size.width / 2,
                    screen.width - EDGE - size.width,
                ),
            )
            top =
                position === 'top'
                    ? anchor.y - size.height - GAP
                    : anchor.y + anchor.height + GAP
            arrowOffset = Math.max(
                EDGE,
                Math.min(centerX - left - ARROW, size.width - EDGE - ARROW * 2),
            )
        } else {
            top = Math.max(
                EDGE,
                Math.min(
                    centerY - size.height / 2,
                    screen.height - EDGE - size.height,
                ),
            )
            left =
                position === 'left'
                    ? anchor.x - size.width - GAP
                    : anchor.x + anchor.width + GAP
            arrowOffset = Math.max(
                EDGE,
                Math.min(centerY - top - ARROW, size.height - EDGE - ARROW * 2),
            )
        }
    }

    const placed = size !== null
    useEffect(() => {
        if (placed) progress.set(withSpring(1, TOOLTIP_SPRING))
    }, [placed, progress])

    const exit = (then?: () => void) => {
        progress.set(
            withSpring(0, TOOLTIP_SPRING, finished => {
                'worklet'
                if (finished && then) scheduleOnRN(then)
            }),
        )
    }
    const dismiss = () => {
        if (closing.current) return
        closing.current = true
        exit(onDismiss)
    }

    // Every close path that flips `visible` runs the same exit before the owner unmounts us.
    // biome-ignore lint/correctness/useExhaustiveDependencies: run once per visibility change
    useEffect(() => {
        if (visible) {
            if (closing.current) {
                closing.current = false
                progress.set(withSpring(1, TOOLTIP_SPRING))
            }
            return
        }
        closing.current = true
        exit(onExited)
    }, [visible])

    const slide = position === 'top' || position === 'left' ? SLIDE : -SLIDE
    const animatedStyle = useAnimatedStyle(() => {
        const p = progress.get()
        const offset = reducedMotion ? 0 : (1 - p) * slide
        return {
            opacity: p,
            transform: vertical
                ? [{ translateY: offset }]
                : [{ translateX: offset }],
        }
    })

    const arrow = (
        <View style={styles.arrow(position, arrowColor, arrowOffset)} />
    )
    const arrowFirst = position === 'bottom' || position === 'right'

    return (
        <Modal
            visible
            transparent
            animationType="none"
            statusBarTranslucent
            navigationBarTranslucent
            onRequestClose={dismiss}
        >
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
                onPress={dismiss}
                style={NativeStyleSheet.absoluteFill}
            />
            <Animated.View
                pointerEvents="box-none"
                onLayout={event => {
                    const { width, height } = event.nativeEvent.layout
                    setSize(previous =>
                        previous?.width === width && previous.height === height
                            ? previous
                            : { width, height },
                    )
                }}
                style={[
                    styles.container(vertical),
                    { left, top },
                    animatedStyle,
                ]}
            >
                {arrowFirst && arrow}
                {children}
                {!arrowFirst && arrow}
            </Animated.View>
        </Modal>
    )
}

const styles = StyleSheet.create(theme => ({
    container: (vertical: boolean) => ({
        position: 'absolute',
        flexDirection: vertical ? 'column' : 'row',
    }),
    // A zero-size box whose borders form the triangle.
    arrow: (position: BubblePosition, color: SemanticColor, offset: number) => {
        const fill = theme.colors[color]
        const base = {
            width: 0,
            height: 0,
            borderStyle: 'solid',
            borderColor: 'transparent',
        } as const
        switch (position) {
            case 'top':
                return {
                    ...base,
                    marginLeft: offset,
                    borderLeftWidth: ARROW,
                    borderRightWidth: ARROW,
                    borderTopWidth: ARROW,
                    borderTopColor: fill,
                }
            case 'bottom':
                return {
                    ...base,
                    marginLeft: offset,
                    borderLeftWidth: ARROW,
                    borderRightWidth: ARROW,
                    borderBottomWidth: ARROW,
                    borderBottomColor: fill,
                }
            case 'left':
                return {
                    ...base,
                    marginTop: offset,
                    borderTopWidth: ARROW,
                    borderBottomWidth: ARROW,
                    borderLeftWidth: ARROW,
                    borderLeftColor: fill,
                }
            case 'right':
                return {
                    ...base,
                    marginTop: offset,
                    borderTopWidth: ARROW,
                    borderBottomWidth: ARROW,
                    borderRightWidth: ARROW,
                    borderRightColor: fill,
                }
        }
    },
}))
