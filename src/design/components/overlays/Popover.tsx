import { useEffect, useRef, useState } from 'react'
import {
    Modal,
    StyleSheet as NativeStyleSheet,
    Pressable,
    useWindowDimensions,
} from 'react-native'
import Animated, {
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated'
import { StyleSheet } from 'react-native-unistyles'
import { scheduleOnRN } from 'react-native-worklets'
import { t } from '../../../i18n'
import { CONTEXT_MENU_SPRING } from '../../tokens/motion'
import { PopoverContext } from './popoverHooks'
import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import type { AnchorRect } from './popoverHooks'

export type PopoverAlign = 'auto' | 'above' | 'below'

/** CONTEXT_MENU_EDGE_OFFSET: the popover keeps this far from the screen edges. */
const EDGE_OFFSET = 12
/** CONTEXT_MENU_OFFSET: gap between the anchor and the popover. */
const ANCHOR_OFFSET = 10
/** CONTEXT_MENU_MIN_SCALE: the popover grows from this scale. */
const MIN_SCALE = 0.5

/** autoPositionVertical / autoPositionHorizontal in the reference ContextMenu. */
function place(
    anchor: AnchorRect,
    size: { width: number; height: number },
    align: PopoverAlign,
    screen: { width: number; height: number },
    minWidth: number,
) {
    const belowTop = anchor.y + anchor.height + ANCHOR_OFFSET
    const aboveBottom = screen.height - anchor.y + ANCHOR_OFFSET
    const spaceBelow = screen.height - belowTop - EDGE_OFFSET
    const spaceAbove = anchor.y - EDGE_OFFSET
    const overflowBelow = spaceBelow < size.height
    const overflowAbove = spaceAbove < size.height

    let vertical: 'above' | 'below'
    if (align !== 'auto') vertical = align
    else if (overflowBelow === overflowAbove)
        vertical = spaceBelow > spaceAbove ? 'below' : 'above'
    else vertical = overflowBelow ? 'above' : 'below'
    // A popover taller than either side overlaps the anchor rather than leaving the screen.
    const furthest = screen.height - EDGE_OFFSET - size.height
    const edge =
        vertical === 'below'
            ? { top: Math.min(belowTop, furthest) }
            : { bottom: Math.min(aboveBottom, furthest) }

    const maxOffset = Math.max(
        EDGE_OFFSET,
        screen.width - EDGE_OFFSET - minWidth,
    )
    const fromRight = Math.max(
        screen.width - anchor.x - anchor.width,
        EDGE_OFFSET,
    )
    const fitsLeft = anchor.x <= maxOffset
    const fitsRight = fromRight <= maxOffset
    const roomLeft = anchor.x - EDGE_OFFSET
    const roomRight = screen.width - EDGE_OFFSET - (anchor.x + minWidth)
    const alignRight = fitsLeft !== fitsRight ? fitsRight : roomLeft > roomRight
    const side = alignRight
        ? { right: Math.min(fromRight, maxOffset) }
        : { left: Math.max(EDGE_OFFSET, Math.min(anchor.x, maxOffset)) }

    const origin = `${vertical === 'below' ? 'top' : 'bottom'} ${alignRight ? 'right' : 'left'}`
    return { style: { ...edge, ...side }, origin }
}

export interface AnchoredPopoverProps {
    anchor: AnchorRect
    align?: PopoverAlign
    /** Narrowest the content can be; decides which side of the anchor it aligns to. */
    minWidth?: number
    /** Dim the screen behind the popover (the context menu backdrop). */
    dim?: boolean
    /** Called once the exit animation has finished. Clear the anchor here. */
    onClose: () => void
    children?: ReactNode
    style?: StyleProp<ViewStyle>
}

/**
 * Floats `children` next to `anchor`, below or above it, in a transparent modal. Tapping outside or
 * pressing back closes it. Content can use `usePopoverClose` to close it.
 */
export function AnchoredPopover({
    anchor,
    align = 'auto',
    minWidth = 220,
    dim = false,
    onClose,
    children,
    style,
}: AnchoredPopoverProps) {
    const screen = useWindowDimensions()
    const reducedMotion = useReducedMotion()
    const progress = useSharedValue(0)
    const closing = useRef(false)
    // The popover is laid out invisibly first so its size is known before it is placed.
    const [size, setSize] = useState<{ width: number; height: number } | null>(
        null,
    )
    const placement = size ? place(anchor, size, align, screen, minWidth) : null
    const placed = placement !== null

    useEffect(() => {
        if (placed) progress.set(withSpring(1, CONTEXT_MENU_SPRING))
    }, [placed, progress])

    const close = (then?: () => void) => {
        if (closing.current) return
        closing.current = true
        const done = () => {
            onClose()
            then?.()
        }
        progress.set(
            withSpring(0, CONTEXT_MENU_SPRING, finished => {
                'worklet'
                if (finished) scheduleOnRN(done)
            }),
        )
    }

    const popoverStyle = useAnimatedStyle(() => {
        const p = progress.get()
        return {
            opacity: p,
            transform: [
                { scale: reducedMotion ? 1 : MIN_SCALE + (1 - MIN_SCALE) * p },
            ],
        }
    })
    const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.get() }))

    return (
        <Modal
            visible
            transparent
            animationType="none"
            statusBarTranslucent
            navigationBarTranslucent
            onRequestClose={() => close()}
        >
            <PopoverContext value={{ close }}>
                {dim && (
                    <Animated.View
                        pointerEvents="none"
                        style={[styles.dim, backdropStyle]}
                    />
                )}
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('common.close')}
                    onPress={() => close()}
                    style={NativeStyleSheet.absoluteFill}
                />
                <Animated.View
                    accessibilityViewIsModal
                    onLayout={event => {
                        const { width, height } = event.nativeEvent.layout
                        setSize(previous =>
                            previous?.width === width &&
                            previous.height === height
                                ? previous
                                : { width, height },
                        )
                    }}
                    style={[
                        styles.popover,
                        placement?.style,
                        { transformOrigin: placement?.origin ?? 'top left' },
                        popoverStyle,
                        style,
                    ]}
                >
                    {children}
                </Animated.View>
            </PopoverContext>
        </Modal>
    )
}

const styles = StyleSheet.create(theme => ({
    dim: {
        ...NativeStyleSheet.absoluteFill,
        backgroundColor: theme.colors.CONTEXT_MENU_BACKDROP_BACKGROUND,
    },
    popover: { position: 'absolute' },
}))
