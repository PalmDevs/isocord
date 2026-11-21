import { Image } from 'expo-image'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
    AccessibilityInfo,
    StyleSheet as NativeStyleSheet,
    useWindowDimensions,
    View,
} from 'react-native'
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler'
import Animated, {
    interpolate,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StyleSheet } from 'react-native-unistyles'
import { scheduleOnRN } from 'react-native-worklets'
import { t } from '../../../i18n'
import { Icon } from '../../icons/Icon'
import {
    SWIPE_RELEASE_TIMING,
    TOAST_ENTER_TIMING,
    TOAST_EXIT_TIMING,
} from '../../tokens/motion'
import { Text } from '../Text'
import {
    DEFAULT_TOAST_DURATION,
    hideToast,
    MAX_VISIBLE_TOASTS,
    useToastStore,
} from './toastStore'
import type { SharedValue } from 'react-native-reanimated'
import type { IconName } from '../../icons/Icon'
import type { SemanticColor } from '../../tokens'
import type { ToastEntry, ToastVariant } from './toastStore'

/** modules.toast.MAX_WIDTH in the reference. */
const MAX_WIDTH = 280
/** modules.toast.TEXT_LINE_COUNT in the reference. */
const LINE_COUNT = 2
/** The reference's container is inset 8px from the screen edges. */
const MARGIN = 8
/** How far each card behind the front one sits below it. */
const CARD_OFFSETS = [0, 9, 16]
const CARD_SCALE_STEP = 0.06
const DRAG_SLOP = 10
/** A swipe dismisses once its release point, `FLING_SECONDS` ahead at the release velocity, is this far. */
const DISMISS_DISTANCE_X = 100
const DISMISS_DISTANCE_Y = 40
const FLING_SECONDS = 0.15
/** How far a drag goes before the front card has faded to its least and the next card's content is all in. */
const DRAG_FADE_DISTANCE = 200

// The reference slides the toast in from above (translateY of -height) while fading it in.
const ENTERING = (values: { targetHeight: number }) => {
    'worklet'
    return {
        initialValues: {
            opacity: 0,
            transform: [{ translateY: -values.targetHeight }],
        },
        animations: {
            opacity: withTiming(1, TOAST_ENTER_TIMING),
            transform: [{ translateY: withTiming(0, TOAST_ENTER_TIMING) }],
        },
    }
}
const EXITING = (values: { currentHeight: number }) => {
    'worklet'
    return {
        initialValues: { opacity: 1, transform: [{ translateY: 0 }] },
        animations: {
            opacity: withTiming(0, TOAST_EXIT_TIMING),
            transform: [
                {
                    translateY: withTiming(
                        -values.currentHeight,
                        TOAST_EXIT_TIMING,
                    ),
                },
            ],
        },
    }
}

/** Per-variant icon and colour in the Mana Toast. */
const VARIANT_ICONS: Partial<
    Record<ToastVariant, { name: IconName; color: SemanticColor }>
> = {
    success: { name: 'CircleCheckIcon', color: 'ICON_FEEDBACK_POSITIVE' },
    critical: { name: 'CircleErrorIcon', color: 'ICON_FEEDBACK_CRITICAL' },
}

/**
 * Renders the toasts shown with `showToast`: a pile of up to three cards under the status bar,
 * the oldest in front, the rest queued. Mount once, above the navigator (see toastsFeature).
 */
export function ToastHost() {
    const toasts = useToastStore(state => state.toasts)
    const topSize = useSharedValue({ width: 0, height: 0 })
    // How far the front card has been dragged away (0 to 1): the next card's content follows it in.
    const frontDrag = useSharedValue(0)
    const visible = toasts.slice(0, MAX_VISIBLE_TOASTS)
    const frontKey = visible[0]?.key
    const frontToast = visible[0]
    // A new front card starts undragged. Layout effects run children first, so the cards already know their
    // new places when this resets.
    useLayoutEffect(() => {
        if (frontKey !== undefined) frontDrag.set(0)
    }, [frontKey, frontDrag])

    return (
        <View
            pointerEvents="box-none"
            style={[
                NativeStyleSheet.absoluteFill,
                frontToast ? { zIndex: frontToast.order } : undefined,
            ]}
        >
            {visible.map((toast, index) => (
                <ToastCard
                    key={toast.key}
                    toast={toast}
                    index={index}
                    topSize={topSize}
                    frontDrag={frontDrag}
                />
            ))}
        </View>
    )
}

/**
 * Counts the toast down while it is in front and not held; showing the key again (a new
 * `revision`) starts the count over. Holding keeps what is left.
 */
function useToastTimer(toast: ToastEntry, active: boolean, held: boolean) {
    const { key, revision } = toast
    const duration = toast.duration ?? DEFAULT_TOAST_DURATION
    const remaining = useRef(duration)
    const lastRevision = useRef(revision)

    useEffect(() => {
        if (lastRevision.current !== revision) {
            lastRevision.current = revision
            remaining.current = duration
        }
        if (!active || held || duration <= 0) return
        const started = Date.now()
        const timeout = setTimeout(() => hideToast(key), remaining.current)
        return () => {
            clearTimeout(timeout)
            remaining.current -= Date.now() - started
        }
    }, [key, revision, duration, active, held])
}

function ToastCard({
    toast,
    index,
    topSize,
    frontDrag,
}: {
    toast: ToastEntry
    index: number
    topSize: SharedValue<{ width: number; height: number }>
    frontDrag: SharedValue<number>
}) {
    const reducedMotion = useReducedMotion()
    const { width: windowWidth } = useWindowDimensions()
    const insets = useSafeAreaInsets()
    const front = index === 0
    const sharedIndex = useSharedValue(index)
    useLayoutEffect(() => sharedIndex.set(index), [index, sharedIndex])
    const [held, setHeld] = useState(false)
    useToastTimer(toast, front, held)

    // Announced when it reaches the front and whenever the key is shown again (revision), even with the same text.
    // biome-ignore lint/correctness/useExhaustiveDependencies: revision re-runs the announcement
    useEffect(() => {
        if (front) AccessibilityInfo.announceForAccessibility(toast.content)
    }, [front, toast.content, toast.revision])

    const dragX = useSharedValue(0)
    const dragY = useSharedValue(0)
    const { key } = toast

    // Swipe sideways or up to dismiss (down only stretches); touching it at all holds the timer.
    const pan = usePanGesture({
        enabled: front,
        activeOffsetX: [-DRAG_SLOP, DRAG_SLOP],
        activeOffsetY: [-DRAG_SLOP, DRAG_SLOP],
        onBegin: () => {
            'worklet'
            scheduleOnRN(setHeld, true)
        },
        onUpdate: event => {
            'worklet'
            dragX.set(event.translationX)
            dragY.set(
                event.translationY < 0
                    ? event.translationY
                    : event.translationY * 0.15,
            )
            frontDrag.set(
                Math.min(
                    1,
                    Math.max(Math.abs(dragX.get()), -dragY.get()) /
                        DRAG_FADE_DISTANCE,
                ),
            )
        },
        onDeactivate: event => {
            'worklet'
            const projectedX =
                event.translationX + event.velocityX * FLING_SECONDS
            const projectedY =
                event.translationY + event.velocityY * FLING_SECONDS
            const leaves =
                Math.abs(projectedX) > DISMISS_DISTANCE_X ||
                projectedY < -DISMISS_DISTANCE_Y
            if (!leaves) {
                dragX.set(withTiming(0, SWIPE_RELEASE_TIMING))
                dragY.set(withTiming(0, SWIPE_RELEASE_TIMING))
                frontDrag.set(withTiming(0, SWIPE_RELEASE_TIMING))
                return
            }
            // Fling off in the dominant direction, then drop the toast.
            const sideways = Math.abs(projectedX) > DISMISS_DISTANCE_X
            frontDrag.set(withTiming(1, SWIPE_RELEASE_TIMING))
            if (reducedMotion) {
                scheduleOnRN(hideToast, key)
                return
            }
            if (sideways) {
                dragX.set(
                    withTiming(
                        Math.sign(projectedX) * windowWidth,
                        SWIPE_RELEASE_TIMING,
                        finished => {
                            if (finished) scheduleOnRN(hideToast, key)
                        },
                    ),
                )
            } else {
                dragY.set(
                    withTiming(
                        -(insets.top + 200),
                        SWIPE_RELEASE_TIMING,
                        finished => {
                            if (finished) scheduleOnRN(hideToast, key)
                        },
                    ),
                )
            }
        },
        onFinalize: () => {
            'worklet'
            scheduleOnRN(setHeld, false)
        },
    })

    const stackStyle = useAnimatedStyle(() => {
        const i = sharedIndex.get()
        const size = topSize.get()
        return {
            width: i > 0 ? size.width : 'auto',
            height: i > 0 ? size.height : 'auto',
            transform: reducedMotion
                ? []
                : [
                      {
                          scale: withTiming(
                              1 - i * CARD_SCALE_STEP,
                              TOAST_ENTER_TIMING,
                          ),
                      },
                      {
                          translateY: withTiming(
                              CARD_OFFSETS[i] ?? 0,
                              TOAST_ENTER_TIMING,
                          ),
                      },
                  ],
        }
    })
    const dragStyle = useAnimatedStyle(() => ({
        opacity: interpolate(
            Math.max(Math.abs(dragX.get()), -dragY.get()),
            [0, DRAG_FADE_DISTANCE],
            [1, 0.3],
            'clamp',
        ),
        transform: [{ translateX: dragX.get() }, { translateY: dragY.get() }],
    }))

    // Only the front card shows its content: a card behind is the front one's size and peeks out under it, so its
    // own text would show past the front's edge (and through the gap a drag opens). The next card's content
    // comes in as the front is dragged away, and once it is in front.
    const contentStyle = useAnimatedStyle(() => {
        const i = sharedIndex.get()
        if (i === 0) return { opacity: withTiming(1, TOAST_ENTER_TIMING) }
        return { opacity: i === 1 ? frontDrag.get() : 0 }
    })

    const variant = toast.variant ?? 'default'
    const variantIcon = VARIANT_ICONS[variant]
    const iconName = toast.icon ?? variantIcon?.name
    const iconColor = toast.iconColor ?? variantIcon?.color ?? 'ICON_DEFAULT'
    const leading = toast.iconUrl ? (
        <Image
            source={toast.iconUrl}
            cachePolicy="memory-disk"
            contentFit="contain"
            style={styles.image}
        />
    ) : iconName ? (
        <Icon
            name={iconName}
            size="sm"
            color={iconColor}
            secondaryColor={toast.secondaryIconColor}
            style={styles.icon}
        />
    ) : null

    return (
        <Animated.View
            entering={reducedMotion ? undefined : ENTERING}
            exiting={reducedMotion ? undefined : EXITING}
            pointerEvents={front ? 'box-none' : 'none'}
            importantForAccessibility={front ? 'auto' : 'no-hide-descendants'}
            style={[
                styles.layer,
                {
                    top: insets.top + MARGIN,
                    paddingHorizontal: MARGIN,
                    zIndex: MAX_VISIBLE_TOASTS - index,
                },
            ]}
        >
            <GestureDetector gesture={pan}>
                <Animated.View
                    accessible
                    accessibilityLabel={toast.content}
                    accessibilityActions={[
                        { name: 'dismiss', label: t('common.close') },
                    ]}
                    onAccessibilityAction={() => hideToast(key)}
                    style={dragStyle}
                >
                    <Animated.View
                        onLayout={event => {
                            if (front)
                                topSize.set({
                                    width: event.nativeEvent.layout.width,
                                    height: event.nativeEvent.layout.height,
                                })
                        }}
                        style={[
                            styles.wrapper(variant),
                            {
                                maxWidth: Math.min(
                                    MAX_WIDTH,
                                    windowWidth - MARGIN * 2,
                                ),
                            },
                            stackStyle,
                        ]}
                    >
                        <View
                            pointerEvents="none"
                            style={[styles.baselayer, styles[variant]]}
                        />
                        <Animated.View style={[styles.content, contentStyle]}>
                            {leading}
                            <Text
                                variant="text-md/normal"
                                color="TEXT_STRONG"
                                lineClamp={LINE_COUNT}
                                style={styles.text}
                            >
                                {toast.content}
                            </Text>
                        </Animated.View>
                    </Animated.View>
                </Animated.View>
            </GestureDetector>
        </Animated.View>
    )
}

const styles = StyleSheet.create(theme => ({
    layer: {
        position: 'absolute',
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    wrapper: (variant: ToastVariant) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.space.PX_12,
        borderRadius: theme.radii.md,
        overflow: 'hidden',
        backgroundColor:
            variant === 'default'
                ? theme.colors.BACKGROUND_SURFACE_HIGHEST
                : theme.colors.BACKGROUND_BASE_LOW,
        boxShadow: theme.shadows.SHADOW_HIGH,
    }),
    // The tint and border sit in a layer over the solid wrapper background.
    baselayer: {
        ...NativeStyleSheet.absoluteFill,
        borderRadius: theme.radii.md,
        borderWidth: 1,
    },
    default: { borderColor: theme.colors.BORDER_NORMAL },
    success: {
        borderColor: theme.colors.TOAST_SUCCESS_BORDER,
        backgroundColor: theme.colors.TOAST_SUCCESS_BACKGROUND,
    },
    critical: {
        borderColor: theme.colors.TOAST_CRITICAL_BORDER,
        backgroundColor: theme.colors.TOAST_CRITICAL_BACKGROUND,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.PX_8,
        flexShrink: 1,
    },
    icon: { flexShrink: 0 },
    image: { width: 24, height: 24, flexShrink: 0 },
    text: { flexShrink: 1 },
}))
