import {
    useCallback,
    useContext,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from 'react'
import {
    StyleSheet as NativeStyleSheet,
    Pressable,
    ScrollView,
    useWindowDimensions,
    View,
} from 'react-native'
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler'
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller'
import Animated, {
    Extrapolation,
    interpolate,
    useAnimatedReaction,
    useAnimatedStyle,
    useDerivedValue,
    useReducedMotion,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets'
import { t } from '../../../i18n'
import NativeIsocordBack from '../../../native/NativeIsocordBack'
import { Icon } from '../../icons/Icon'
import { useSurfaceColor } from '../../surfaceTint'
import {
    ACTION_SHEET_REDUCED_MOTION_TIMING,
    ACTION_SHEET_SPRING,
} from '../../tokens/motion'
import { RipplePressable } from '../buttons/RipplePressable'
import { Backdrop } from '../overlays/Backdrop'
import { Text } from '../Text'
import { TableRow, TableRowIcon } from '../table/TableRow'
import { TableRowGroup } from '../table/TableRowGroup'
import { SheetDrag } from './SheetDrag'
import { SheetContext, useCloseSheet } from './sheetContext'
import { SheetDragContext } from './sheetDragContext'
import { useSheetBackPreview } from './useSheetBackPreview'
import type { ComponentRef, ReactNode, Ref } from 'react'
import type {
    NativeScrollEvent,
    NativeSyntheticEvent,
    ScrollViewProps,
    StyleProp,
    ViewStyle,
} from 'react-native'
import type { SharedValue } from 'react-native-reanimated'

/** ACTION_SHEET_START_HEIGHT_RATIO: the height a scrollable sheet opens at, as a share of the window. */
const START_HEIGHT_RATIO = 0.6
/** ACTION_SHEET_MAX_WIDTH: on wide screens the sheet stays this wide and centred. */
const MAX_WIDTH = 500
const BACKGROUND_BLEED = NativeStyleSheet.hairlineWidth
/** ACTION_SHEET_MINIMUM_BOTTOM_PADDING, before the safe-area inset. */
const MIN_BOTTOM_PADDING = 16
/** NAV_BAR_HEIGHT_MULTILINE: the sheet never reaches higher than this below the status bar. */
const TOP_GAP = 56
/** Release speed (px/s) above which a drag flings to the next snap point instead of the nearest. */
const FLING_VELOCITY = 600
const DRAG_SLOP = 10

function animateTo(
    value: SharedValue<number>,
    to: number,
    reducedMotion: boolean,
    onEnd?: () => void,
) {
    'worklet'
    const callback = (finished?: boolean) => {
        'worklet'
        if (finished && onEnd) scheduleOnRN(onEnd)
    }
    value.set(
        reducedMotion
            ? withTiming(to, ACTION_SHEET_REDUCED_MOTION_TIMING, callback)
            : withSpring(
                  to,
                  { ...ACTION_SHEET_SPRING, overshootClamping: to === 0 },
                  callback,
              ),
    )
}

/** Where a drag released at `current` (px of sheet showing) should settle, among closed, `low` and `high`. */
function pickSnap(
    current: number,
    velocity: number,
    low: number,
    high: number,
) {
    'worklet'
    if (velocity > FLING_VELOCITY) return current > low + 1 ? low : 0
    if (velocity < -FLING_VELOCITY) return current < low - 1 ? low : high
    const toClosed = current
    const toLow = Math.abs(current - low)
    const toHigh = Math.abs(current - high)
    const nearest = Math.min(toClosed, toLow, toHigh)
    if (nearest === toClosed) return 0
    return nearest === toLow ? low : high
}

export interface BottomSheetHandle {
    /** Snaps a scrollable sheet to its full height. */
    expandActionSheet: () => void
    /** Snaps a scrollable sheet back to its start height. */
    collapseActionSheet: () => void
    closeActionSheet: () => void
}

export interface BottomSheetProps {
    ref?: Ref<BottomSheetHandle>
    /**
     * Puts the content in a ScrollView and lets the sheet snap between `startHeight` and `maxHeight`.
     * Otherwise the sheet is exactly as tall as its content, up to `maxHeight`.
     */
    scrollable?: boolean
    /** Height a scrollable sheet opens at. Defaults to 60% of the window. */
    startHeight?: number
    /** Tallest the sheet may be. Defaults to the window minus the status bar and a navigation bar. */
    maxHeight?: number
    /** Open a scrollable sheet at `maxHeight`. */
    startExpanded?: boolean
    /** Peak opacity of the scrim behind the sheet. */
    backdropOpacity?: number
    /** Rendered on top of the scrim, behind the sheet. */
    backdropChildren?: ReactNode
    /** Pinned above the content, below the handle. See BottomSheetTitleHeader. */
    header?: ReactNode
    /** Replaces the drag handle. */
    handleComponent?: ReactNode
    handleDisabled?: boolean
    /** Accessibility label of the handle and the scrim, which both dismiss the sheet. */
    dismissAccessibilityLabel?: string
    /** Pinned below the content. */
    footer?: ReactNode
    /** Called when a scrollable sheet reaches its full height. */
    onExpand?: () => void
    /** Called once the sheet has finished closing, however it was closed. */
    onDismiss?: () => void
    keyboardShouldPersistTaps?: ScrollViewProps['keyboardShouldPersistTaps']
    children?: ReactNode
    /** Drawn behind the sheet content and clipped to the sheet. */
    background?: ReactNode
    /** Style of the content container, which holds the body. */
    contentStyles?: StyleProp<ViewStyle>
    bodyStyles?: StyleProp<ViewStyle>
}

/**
 * Sheet that slides up from the bottom edge: scrim, drag handle, draggable and snapping, lifted by
 * the keyboard. Render it through `openActionSheet`, which ModalStack draws.
 */
export function BottomSheet({
    ref,
    scrollable = false,
    startHeight,
    maxHeight,
    startExpanded = false,
    backdropOpacity = 1,
    backdropChildren,
    header,
    handleComponent,
    handleDisabled = false,
    dismissAccessibilityLabel = t('common.close'),
    footer,
    onExpand,
    onDismiss,
    keyboardShouldPersistTaps,
    children,
    background,
    contentStyles,
    bodyStyles,
}: BottomSheetProps) {
    const { closing, close, onClosed, buttonTheme, backPreviewKey } =
        useContext(SheetContext)
    const { height: windowHeight, width } = useWindowDimensions()
    const backScale = useSheetBackPreview(backPreviewKey, width)
    const insets = useSafeAreaInsets()
    const reducedMotion = useReducedMotion()
    const keyboard = useReanimatedKeyboardAnimation()
    const { theme } = useUnistyles()
    const surfaceBg = useSurfaceColor(
        theme.colors.MOBILE_ACTIONSHEET_BACKGROUND,
        undefined,
        buttonTheme,
    )

    const limit = maxHeight ?? windowHeight - insets.top - TOP_GAP
    // A sheet without a scroll view sizes itself to its content, which is only known after layout.
    const [measured, setMeasured] = useState<number | null>(null)
    const ready = scrollable || measured !== null
    const lowSnap = scrollable
        ? Math.min(startHeight ?? windowHeight * START_HEIGHT_RATIO, limit)
        : Math.min(measured ?? 0, limit)
    const highSnap = scrollable ? limit : lowSnap

    // Height of the sheet that is on screen: 0 is closed, `lowSnap` to `highSnap` is open.
    const visible = useSharedValue(0)
    const dismissHeight = useSharedValue<number | undefined>(undefined)
    // Height available above the keyboard without crossing the top safe area.
    const sheetHeight = useDerivedValue(() =>
        Math.max(
            0,
            Math.min(
                visible.get(),
                windowHeight - insets.top + keyboard.height.get(),
            ),
        ),
    )
    const layoutHeight = useDerivedValue(
        () => dismissHeight.get() ?? sheetHeight.get(),
    )
    const expanded = useRef(scrollable && startExpanded)
    const finished = useRef(false)

    // Kept in a ref so the exit animation, which outlives renders, always calls the latest callbacks.
    const callbacks = useRef({ onDismiss, onClosed })
    useEffect(() => {
        callbacks.current = { onDismiss, onClosed }
    })
    // Stable identity: the animation effect depends on it.
    const finish = useCallback(() => {
        if (finished.current) return
        finished.current = true
        callbacks.current.onDismiss?.()
        callbacks.current.onClosed()
    }, [])

    // Slides in once measured, slides out when asked to, and follows the content if it changes size.
    useEffect(() => {
        if (!ready) {
            if (closing) finish()
            return
        }
        const target = expanded.current ? highSnap : lowSnap
        scheduleOnUI(() => {
            'worklet'
            // withPanGestureSpring: the viewport moves as a unit during dismissal.
            dismissHeight.set(
                closing
                    ? (dismissHeight.get() ?? sheetHeight.get())
                    : undefined,
            )
            animateTo(
                visible,
                closing ? 0 : target,
                reducedMotion,
                closing ? finish : undefined,
            )
        })
    }, [
        closing,
        ready,
        lowSnap,
        highSnap,
        reducedMotion,
        visible,
        dismissHeight,
        sheetHeight,
        finish,
    ])

    const settle = (isExpanded: boolean) => {
        if (isExpanded && !expanded.current) onExpand?.()
        expanded.current = isExpanded
    }

    useImperativeHandle(ref, () => ({
        expandActionSheet() {
            settle(true)
            animateTo(visible, highSnap, reducedMotion)
        },
        collapseActionSheet() {
            settle(false)
            animateTo(visible, lowSnap, reducedMotion)
        },
        closeActionSheet: close,
    }))

    // Settles after a drag let go: what the handle's pan does, and what content that opts in with SheetDrag does.
    const release = (velocityY: number) => {
        'worklet'
        const target = pickSnap(visible.get(), velocityY, lowSnap, highSnap)
        if (target === 0) {
            scheduleOnRN(close)
            return
        }
        animateTo(visible, target, reducedMotion)
        scheduleOnRN(settle, highSnap > lowSnap && target === highSnap)
    }
    const drag = { height: visible, max: highSnap, release }

    const pan = usePanGesture({
        activeOffsetY: [-DRAG_SLOP, DRAG_SLOP],
        failOffsetX: [-DRAG_SLOP, DRAG_SLOP],
        onUpdate: event => {
            'worklet'
            visible.set(
                Math.min(highSnap, Math.max(0, visible.get() - event.changeY)),
            )
        },
        onDeactivate: event => {
            'worklet'
            release(event.velocityY)
        },
    })

    const backdropStyle = useAnimatedStyle(() => ({
        opacity:
            lowSnap > 0
                ? interpolate(
                      visible.get(),
                      [0, lowSnap],
                      [0, backdropOpacity],
                      Extrapolation.CLAMP,
                  )
                : 0,
    }))
    const sheetStyle = useAnimatedStyle(() => {
        const height = layoutHeight.get()
        return {
            height,
            transform: [
                { translateY: Math.max(0, height - sheetHeight.get()) },
                { scale: backScale.get() },
            ],
        }
    })
    const sheetSurfaceStyle = useAnimatedStyle(() => {
        const scale = backScale.get()
        const height = layoutHeight.get()
        return {
            // Background-only compensation for the top-anchored scale.
            bottom:
                scale < 1 ? height - (height + BACKGROUND_BLEED) / scale : 0,
        }
    })
    const sheetContentStyle = useAnimatedStyle(() => {
        const height = layoutHeight.get()
        return {
            height,
            // Content fitting in its viewport shares the extended surface clip.
            overflow:
                height < (scrollable ? lowSnap : (measured ?? 0))
                    ? 'hidden'
                    : 'visible',
        }
    })
    // The keyboard pushes the sheet up by its own height.
    const liftStyle = useAnimatedStyle(() => ({
        paddingBottom: -keyboard.height.get(),
    }))

    const bottomPadding = Math.max(insets.bottom, MIN_BOTTOM_PADDING) + 4
    const handle = handleDisabled
        ? null
        : (handleComponent ?? (
              <ActionSheetHeaderBar
                  accessibilityLabel={dismissAccessibilityLabel}
                  onPress={close}
              />
          ))
    const chrome = (
        <View>
            {handle}
            {header != null && <View style={styles.header}>{header}</View>}
        </View>
    )

    // A scrollable sheet's own ScrollView drags the sheet while it is at its top (see SheetDrag).
    const scrollAtTop = useSharedValue(true)
    const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null)
    const canExtendScroll = scrollable && footer == null
    const setScrollOverflow = (visible: boolean) => {
        const tag = scrollRef.current?.getScrollableNode()
        if (tag != null) NativeIsocordBack?.setSheetScrollOverflow(tag, visible)
    }
    useAnimatedReaction(
        () => canExtendScroll && backScale.get() < 1,
        (extended, previous) => {
            if (extended !== previous && (extended || previous))
                scheduleOnRN(setScrollOverflow, extended)
        },
    )
    const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        scrollAtTop.set(event.nativeEvent.contentOffset.y <= 1)
    }

    const content = scrollable ? (
        <>
            <GestureDetector gesture={pan}>{chrome}</GestureDetector>
            <SheetDrag scrollAtTop={scrollAtTop} style={styles.fill}>
                <ScrollView
                    ref={scrollRef}
                    style={styles.fill}
                    removeClippedSubviews={canExtendScroll ? false : undefined}
                    onScroll={onScroll}
                    scrollEventThrottle={16}
                    keyboardShouldPersistTaps={keyboardShouldPersistTaps}
                    contentContainerStyle={[
                        contentStyles,
                        bodyStyles,
                        { paddingBottom: footer ? 0 : bottomPadding },
                    ]}
                >
                    {children}
                </ScrollView>
            </SheetDrag>
            {/* Shrinks with the sheet when the keyboard leaves it short of room. */}
            {footer != null && (
                <View style={{ flexShrink: 1, paddingBottom: bottomPadding }}>
                    {footer}
                </View>
            )}
        </>
    ) : (
        <View
            style={styles.natural}
            onLayout={event =>
                setMeasured(Math.ceil(event.nativeEvent.layout.height))
            }
        >
            {chrome}
            <View
                style={[
                    contentStyles,
                    bodyStyles,
                    { paddingBottom: footer ? 0 : bottomPadding },
                ]}
            >
                {children}
            </View>
            {footer != null && (
                <View style={{ paddingBottom: bottomPadding }}>{footer}</View>
            )}
        </View>
    )
    const sheet = (
        <Animated.View style={[styles.sheet, sheetStyle]}>
            <Animated.View
                pointerEvents="box-none"
                style={[
                    NativeStyleSheet.absoluteFill,
                    styles.sheetClip,
                    { backgroundColor: surfaceBg },
                    sheetSurfaceStyle,
                ]}
            >
                {background != null && (
                    <View
                        pointerEvents="none"
                        style={NativeStyleSheet.absoluteFill}
                    >
                        {background}
                    </View>
                )}
                <Animated.View style={sheetContentStyle}>
                    {content}
                </Animated.View>
            </Animated.View>
        </Animated.View>
    )

    return (
        <SheetDragContext value={drag}>
            <View
                pointerEvents="box-none"
                style={NativeStyleSheet.absoluteFill}
            >
                <Animated.View
                    pointerEvents="box-none"
                    style={[NativeStyleSheet.absoluteFill, backdropStyle]}
                >
                    <Backdrop
                        onDismiss={close}
                        accessibilityLabel={dismissAccessibilityLabel}
                    />
                    {backdropChildren}
                </Animated.View>
                <Animated.View
                    pointerEvents="box-none"
                    style={[styles.lift, liftStyle]}
                >
                    {scrollable ? (
                        sheet
                    ) : (
                        <GestureDetector gesture={pan}>{sheet}</GestureDetector>
                    )}
                </Animated.View>
            </View>
        </SheetDragContext>
    )
}

export interface ActionSheetHeaderBarProps {
    accessibilityLabel?: string
    onPress?: () => void
}

/** The drag handle at the top of a sheet. Screen readers get it as a dismiss button. */
export function ActionSheetHeaderBar({
    accessibilityLabel = t('common.close'),
    onPress,
}: ActionSheetHeaderBarProps) {
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            hitSlop={{ top: 8, bottom: 8, left: 24, right: 24 }}
            onPress={onPress}
            style={styles.handleArea}
        >
            <View style={styles.indicator} />
        </Pressable>
    )
}

export interface ActionSheetProps extends BottomSheetProps {}

/**
 * BottomSheet for lists of actions: content inset 16px from the edges and 24px between sections.
 * Put TableRowGroups (or ActionSheetRowGroup) in it.
 */
export function ActionSheet({
    contentStyles,
    bodyStyles,
    ...props
}: ActionSheetProps) {
    return (
        <BottomSheet
            {...props}
            contentStyles={[styles.actionContent, contentStyles]}
            bodyStyles={[styles.actionBody, bodyStyles]}
        />
    )
}

/** Rows inside an ActionSheet are ordinary table rows. */
export const ActionSheetRow = TableRow
export const ActionSheetRowIcon = TableRowIcon
export const ActionSheetRowGroup = TableRowGroup

export interface BottomSheetTitleHeaderProps {
    title: ReactNode
    subtitle?: ReactNode
    /** Pinned to the left edge, e.g. a text button. */
    leading?: ReactNode
    /** Pinned to the right edge, e.g. an ActionSheetCloseButton. */
    trailing?: ReactNode
}

/** Centred title and subtitle with optional accessories at either edge, for the `header` of a sheet. */
export function BottomSheetTitleHeader({
    title,
    subtitle,
    leading,
    trailing,
}: BottomSheetTitleHeaderProps) {
    const hasAccessory = leading != null || trailing != null
    return (
        <View style={styles.titleHeader}>
            <View style={styles.titles(hasAccessory)}>
                {typeof title === 'string' ? (
                    <Text
                        accessibilityRole="header"
                        variant="redesign/heading-18/semibold"
                        color="MOBILE_TEXT_HEADING_PRIMARY"
                        lineClamp={2}
                        style={styles.centered}
                    >
                        {title}
                    </Text>
                ) : (
                    title
                )}
                {subtitle != null &&
                    (typeof subtitle === 'string' ? (
                        <Text
                            variant="text-sm/medium"
                            color="TEXT_MUTED"
                            style={styles.centered}
                        >
                            {subtitle}
                        </Text>
                    ) : (
                        subtitle
                    ))}
            </View>
            {leading != null && (
                <View style={[styles.accessory, styles.leading]}>
                    {leading}
                </View>
            )}
            {trailing != null && (
                <View style={[styles.accessory, styles.trailing]}>
                    {trailing}
                </View>
            )}
        </View>
    )
}

/**
 * ActionSheetIconHeader: an icon, then a start-aligned title and subtitle, for the `header` of a sheet about one
 * thing (a channel, a server). Spaced further from the rows than the reference, by design.
 */
export function ActionSheetIconHeader({
    icon,
    title,
    subtitle,
}: {
    icon: ReactNode
    title: string
    subtitle?: string
}) {
    return (
        <View style={styles.iconHeader}>
            {icon}
            <View style={styles.iconHeaderTitles}>
                <Text
                    accessibilityRole="header"
                    variant="redesign/heading-18/bold"
                    color="MOBILE_TEXT_HEADING_PRIMARY"
                    lineClamp={2}
                >
                    {title}
                </Text>
                {subtitle != null && (
                    <Text variant="text-xs/medium" color="TEXT_DEFAULT">
                        {subtitle}
                    </Text>
                )}
            </View>
        </View>
    )
}

/** Small X for the `trailing` slot of a BottomSheetTitleHeader. */
export function ActionSheetCloseButton({
    onPress,
    variant = 'default',
}: {
    onPress?: () => void
    variant?: 'default' | 'overlay'
}) {
    const close = useCloseSheet()
    return (
        <RipplePressable
            borderless
            radius={20}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            hitSlop={8}
            onPress={onPress ?? close}
            style={styles.closeButton}
        >
            <Icon
                name="XSmallIcon"
                color={
                    variant === 'overlay' ? 'TEXT_OVERLAY_LIGHT' : 'ICON_STRONG'
                }
            />
        </RipplePressable>
    )
}

const styles = StyleSheet.create(theme => ({
    fill: { flex: 1 },
    lift: {
        ...NativeStyleSheet.absoluteFill,
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    sheet: {
        width: '100%',
        maxWidth: MAX_WIDTH,
        transformOrigin: 'top center',
        overflow: 'visible',
    },
    sheetClip: {
        overflow: 'hidden',
        borderTopLeftRadius: theme.radii.xl,
        borderTopRightRadius: theme.radii.xl,
    },
    // Hangs from the top of the sheet at its natural height, so the sheet's growing edge reveals it
    // the way a slide would.
    natural: { position: 'absolute', top: 0, left: 0, right: 0 },
    header: { marginBottom: theme.space.PX_16 },
    handleArea: {
        marginBottom: theme.modules.mobile.SHEET_HANDLE_MARGIN_BOTTOM,
    },
    indicator: {
        alignSelf: 'center',
        top: theme.modules.mobile.SHEET_HANDLE_MARGIN_TOP,
        width: theme.modules.mobile.SHEET_HANDLE_WIDTH,
        height: theme.modules.mobile.SHEET_HANDLE_HEIGHT,
        borderRadius: theme.radii.sm,
        backgroundColor: theme.colors.BACKGROUND_MOD_STRONG,
    },
    actionContent: { paddingHorizontal: theme.space.PX_16 },
    actionBody: { gap: theme.space.PX_24 },
    titleHeader: {
        flexDirection: 'row',
        position: 'relative',
        minHeight: 32,
        alignItems: 'center',
    },
    titles: (hasAccessory: boolean) => ({
        flex: 1,
        gap: 2,
        paddingHorizontal: hasAccessory ? 56 : theme.space.PX_16,
    }),
    centered: { textAlign: 'center' },
    iconHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.PX_12,
        paddingHorizontal: theme.space.PX_16,
        paddingBottom: theme.space.PX_8,
    },
    iconHeaderTitles: { flex: 1, justifyContent: 'center' },
    accessory: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        justifyContent: 'center',
    },
    leading: { left: theme.space.PX_16 },
    trailing: { right: theme.space.PX_16 },
    closeButton: { padding: theme.space.PX_4 },
}))
