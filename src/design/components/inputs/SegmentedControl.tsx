import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler'
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { scheduleOnRN } from 'react-native-worklets'
import { INDICATOR_SPRING, SEGMENTED_ITEM_SPRING } from '../../tokens/motion'
import { Pages } from '../layout/Pages'
import type { SharedValue } from 'react-native-reanimated'
import type { TextVariant } from '../../tokens'
import type { PagesProps } from '../layout/Pages'
import type {
    SegmentedControlItemData,
    SegmentedControlState,
} from './useSegmentedControlState'

export type SegmentedControlVariant =
    | 'default'
    | 'experimental_Small'
    | 'experimental_Large'

/** Swipeable pages for a `useSegmentedControlState` state: each segment's `page`, mounted lazily. */
export function SegmentedControlPages({
    state,
    ...rest
}: Omit<PagesProps, 'state' | 'pages'> & { state: SegmentedControlState }) {
    return (
        <Pages
            {...rest}
            state={state}
            pages={state.items.map(item => ({ id: item.id, page: item.page }))}
        />
    )
}

/** How much the indicator stretches towards the pressed neighbour. */
const PRESSED_STRETCH = 0.04

export interface SegmentedControlProps {
    state: SegmentedControlState
    variant?: SegmentedControlVariant
}

/** Pill of equal-width segments with a springing selection indicator. The large variant can also be dragged. */
export function SegmentedControl({
    state,
    variant = 'default',
}: SegmentedControlProps) {
    const {
        items,
        activeIndex,
        targetIndex,
        pressedIndex,
        selectedIndex,
        setActiveIndex,
        paged,
    } = state
    const { theme } = useUnistyles()
    const itemCount = items.length
    const large = variant === 'experimental_Large'
    const padding = large ? 8 : 4
    const radius = theme.modules.mobile.SEGMENTED_CONTROL_BORDER_RADIUS

    // Only the slot that was selected on mount draws the indicator; it is then translated to the active slot.
    const [initialIndex] = useState(() => activeIndex.get())
    const indicatorWidth = useSharedValue(0)
    const previousIndicatorWidth = useSharedValue(0)
    const panIndex = useSharedValue(-1)

    const indicatorStyle = useAnimatedStyle(() => {
        const clamped = Math.min(Math.max(activeIndex.get(), 0), itemCount - 1)
        const width = indicatorWidth.get()
        let translateX = (clamped - initialIndex) * width
        let scaleX = 1
        const pressed = pressedIndex.get()
        if (pressed >= 0 && pressed !== clamped) {
            scaleX = 1 + PRESSED_STRETCH
            translateX +=
                (pressed < clamped ? -1 : 1) * width * (PRESSED_STRETCH / 2)
        }
        // The end segments sit inside the container padding.
        translateX +=
            padding *
            (Math.min(Math.max(1 - clamped, 0), 1) -
                Math.min(Math.max(clamped - (itemCount - 2), 0), 1))
        // Don't animate the jump from the unmeasured first layout.
        const animate = width === previousIndicatorWidth.get()
        if (!animate) previousIndicatorWidth.set(width)
        return {
            transform: [
                {
                    translateX:
                        animate && targetIndex.get() < 0
                            ? withSpring(translateX, INDICATOR_SPRING)
                            : translateX,
                },
                { scaleX: withSpring(scaleX, INDICATOR_SPRING) },
            ],
        }
    })

    const pan = usePanGesture({
        enabled: large,
        onActivate: () => {
            if (paged.get()) return
            panIndex.set(activeIndex.get())
        },
        onUpdate: event => {
            if (paged.get()) return
            const next =
                panIndex.get() + event.translationX / indicatorWidth.get()
            activeIndex.set(Math.min(Math.max(next, 0), itemCount - 1))
        },
        onDeactivate: () => {
            if (paged.get()) return
            panIndex.set(-1)
            const settled = Math.round(activeIndex.get())
            activeIndex.set(settled)
            scheduleOnRN(setActiveIndex, settled)
        },
    })

    return (
        <GestureDetector gesture={pan}>
            <View
                accessibilityRole="tablist"
                style={styles.container(radius, padding)}
            >
                <View
                    accessible={false}
                    style={styles.indicatorContainer(padding)}
                >
                    {items.map((item, index) => (
                        <Animated.View
                            key={item.id}
                            onLayout={
                                index === initialIndex
                                    ? event =>
                                          indicatorWidth.set(
                                              event.nativeEvent.layout.width,
                                          )
                                    : undefined
                            }
                            style={[
                                styles.indicator(radius),
                                index === initialIndex
                                    ? indicatorStyle
                                    : styles.hidden,
                            ]}
                        />
                    ))}
                </View>
                {items.map((item, index) => (
                    <SegmentedControlItem
                        key={item.id}
                        item={item}
                        index={index}
                        itemCount={itemCount}
                        selected={selectedIndex === index}
                        activeIndex={activeIndex}
                        pressedIndex={pressedIndex}
                        small={variant === 'experimental_Small'}
                        edgeOffset={
                            index === 0 || index === itemCount - 1 ? padding : 0
                        }
                        onPress={() => setActiveIndex(index)}
                    />
                ))}
            </View>
        </GestureDetector>
    )
}

interface SegmentedControlItemProps {
    item: SegmentedControlItemData
    index: number
    itemCount: number
    selected: boolean
    activeIndex: SharedValue<number>
    pressedIndex: SharedValue<number>
    small: boolean
    /** Pushes the end segments' content in so it lines up with the inset indicator. */
    edgeOffset: number
    onPress: () => void
}

function SegmentedControlItem({
    item,
    index,
    itemCount,
    selected,
    activeIndex,
    pressedIndex,
    small,
    edgeOffset,
    onPress,
}: SegmentedControlItemProps) {
    const { theme } = useUnistyles()
    const inactive = theme.colors.TEXT_MUTED
    const active = theme.colors.INTERACTIVE_TEXT_ACTIVE

    const labelStyle = useAnimatedStyle(() => {
        const pressed = pressedIndex.get()
        let color = inactive
        if (pressed === index) color = active
        else if (pressed < 0 && Math.round(activeIndex.get()) === index)
            color = active
        return { color: withSpring(color, SEGMENTED_ITEM_SPRING) }
    })

    return (
        <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityHint={`${index + 1} of ${itemCount}`}
            onPress={onPress}
            onPressIn={() => pressedIndex.set(index)}
            onPressOut={() => pressedIndex.set(-1)}
            style={styles.item(
                small,
                itemCount,
                edgeOffset,
                index === 0,
                index === itemCount - 1,
            )}
        >
            <View style={styles.label}>
                {item.icon}
                <Animated.Text
                    numberOfLines={1}
                    style={[styles.labelText('text-sm/semibold'), labelStyle]}
                >
                    {item.label}
                </Animated.Text>
            </View>
        </Pressable>
    )
}

const styles = StyleSheet.create(theme => ({
    container: (radius: number, padding: number) => ({
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.MOBILE_SEGMENTED_CONTROL_BACKGROUND,
        borderRadius: radius + padding,
        paddingVertical: padding,
    }),
    indicatorContainer: (padding: number) => ({
        position: 'absolute',
        top: padding,
        bottom: padding,
        left: 0,
        right: 0,
        flexDirection: 'row',
    }),
    indicator: (radius: number) => ({
        flex: 1,
        backgroundColor:
            theme.colors.MOBILE_SEGMENTED_CONTROL_INDICATOR_BACKGROUND,
        borderRadius: radius,
    }),
    hidden: { opacity: 0 },
    item: (
        small: boolean,
        itemCount: number,
        edgeOffset: number,
        first: boolean,
        last: boolean,
    ) => ({
        minWidth: `${100 / itemCount}%`,
        flexDirection: 'row',
        justifyContent: 'center',
        borderRadius: theme.radii.lg,
        paddingVertical: small ? 4 : 8,
        marginStart: first ? edgeOffset : last ? -edgeOffset : 0,
        marginEnd: first ? -edgeOffset : last ? edgeOffset : 0,
    }),
    label: {
        flexDirection: 'column',
        alignItems: 'center',
        gap: theme.space.PX_8,
    },
    labelText: (variant: TextVariant) => ({
        ...theme.text[variant],
        includeFontPadding: false,
    }),
}))
