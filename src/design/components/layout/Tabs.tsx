import { useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import Animated, {
    Extrapolation,
    interpolate,
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { INDICATOR_SPRING } from '../../tokens/motion'
import { Text } from '../Text'
import { Pages } from './Pages'
import type { ComponentRef } from 'react'
import type { LayoutRectangle } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import type { TextProps } from '../Text'
import type { PagesProps } from './Pages'
import type { TabItem, TabsState } from './useTabsState'

interface TabsCommonProps {
    /** `overlay` is for tabs over imagery: white indicator and text. */
    variant?: 'default' | 'overlay'
    /** Spread the tabs across the full width instead of hugging their labels. */
    grow?: boolean
    formatCount?: (count: number) => string
}

export type TabsProps = TabsCommonProps &
    (
        | { state: TabsState }
        | {
              items: TabItem[]
              activeIndex: number
              onChange: (index: number) => void
          }
    )

/**
 * The space between two tabs: SegmentedControlState's default itemSpacing (PX_24). It is padding on each item, half
 * on either side, rather than a gap, so that it is part of the touch target; the indicator stays under the label.
 */
const ITEM_SPACING = 24
const ITEM_PADDING = ITEM_SPACING / 2
const SCROLL_BUFFER = 16

/**
 * Underlined, horizontally scrollable tab strip (Tabs). Not navigation on its own: pass `state` from `useTabsState`
 * to pair it with `TabsPages`, or control it with `activeIndex` and `onChange`.
 */
export function Tabs(props: TabsProps) {
    if ('state' in props) {
        const { state, ...rest } = props
        return (
            <TabStrip
                {...rest}
                items={state.items}
                position={state.activeIndex}
                selectedIndex={state.selectedIndex}
                onChange={state.setActiveIndex}
            />
        )
    }
    return <ControlledTabs {...props} />
}

function ControlledTabs({
    items,
    activeIndex,
    onChange,
    ...rest
}: TabsCommonProps & {
    items: TabItem[]
    activeIndex: number
    onChange: (index: number) => void
}) {
    const position = useSharedValue(activeIndex)
    useEffect(() => {
        position.set(withSpring(activeIndex, INDICATOR_SPRING))
    }, [activeIndex, position])
    return (
        <TabStrip
            {...rest}
            items={items}
            position={position}
            selectedIndex={activeIndex}
            onChange={onChange}
        />
    )
}

interface TabStripProps extends TabsCommonProps {
    items: TabItem[]
    /** Fractional index the indicator follows. */
    position: SharedValue<number>
    selectedIndex: number
    onChange: (index: number) => void
}

function TabStrip({
    items,
    position,
    selectedIndex,
    onChange,
    variant = 'default',
    grow = false,
    formatCount,
}: TabStripProps) {
    const scroll = useRef<ComponentRef<typeof ScrollView>>(null)
    const [layouts, setLayouts] = useState<Record<number, LayoutRectangle>>({})
    const [pageWidth, setPageWidth] = useState(0)
    const selected = layouts[selectedIndex]
    const measured =
        items.length > 1 && items.every((_, index) => layouts[index])
    const indices = items.map((_, index) => index)
    const xs = items.map((_, index) => (layouts[index]?.x ?? 0) + ITEM_PADDING)
    const widths = items.map((_, index) =>
        Math.max((layouts[index]?.width ?? 0) - 2 * ITEM_PADDING, 0),
    )

    useEffect(() => {
        if (!selected) return
        scroll.current?.scrollTo({
            x: Math.max(0, selected.x - SCROLL_BUFFER),
            animated: true,
        })
    }, [selected])

    const indicator = useAnimatedStyle(() => {
        if (!measured)
            return {
                width: Math.max((selected?.width ?? 0) - 2 * ITEM_PADDING, 0),
                transform: [{ translateX: (selected?.x ?? 0) + ITEM_PADDING }],
            }
        return {
            width: interpolate(
                position.get(),
                indices,
                widths,
                Extrapolation.CLAMP,
            ),
            transform: [
                {
                    translateX: interpolate(
                        position.get(),
                        indices,
                        xs,
                        Extrapolation.CLAMP,
                    ),
                },
            ],
        }
    })

    return (
        <View
            style={styles.container}
            onLayout={event => setPageWidth(event.nativeEvent.layout.width)}
        >
            <ScrollView
                ref={scroll}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent(
                    grow ? pageWidth : 0,
                )}
            >
                <View style={styles.controls(grow)} accessibilityRole="tablist">
                    {items.map((item, index) => {
                        const isSelected = index === selectedIndex
                        const activeColor =
                            variant === 'overlay' ? 'TEXT_STRONG' : 'TEXT_BRAND'
                        return (
                            <Pressable
                                key={item.key}
                                accessibilityRole="tab"
                                accessibilityState={{ selected: isSelected }}
                                onPress={() => onChange(index)}
                                onLayout={event => {
                                    const layout = event.nativeEvent.layout
                                    setLayouts(previous => {
                                        const existing = previous[index]
                                        if (
                                            existing &&
                                            existing.x === layout.x &&
                                            existing.width === layout.width
                                        )
                                            return previous
                                        return { ...previous, [index]: layout }
                                    })
                                }}
                                style={styles.item(grow)}
                            >
                                <TabText
                                    index={index}
                                    position={position}
                                    activeColor={activeColor}
                                    variant="text-sm/semibold"
                                    lineClamp={1}
                                >
                                    {item.label}
                                </TabText>
                                {item.count != null && (
                                    <TabText
                                        index={index}
                                        position={position}
                                        activeColor={activeColor}
                                        variant="text-sm/medium"
                                        lineClamp={1}
                                        style={styles.count}
                                    >
                                        {formatCount
                                            ? formatCount(item.count)
                                            : item.count.toLocaleString()}
                                    </TabText>
                                )}
                            </Pressable>
                        )
                    })}
                    <Animated.View
                        pointerEvents="none"
                        style={[styles.indicator(variant), indicator]}
                    />
                </View>
            </ScrollView>
        </View>
    )
}

/** SegmentedControlItem: Animates the label color with selection. */
function TabText({
    index,
    position,
    activeColor,
    ...props
}: Omit<TextProps, 'color' | 'animated'> & {
    index: number
    position: SharedValue<number>
    activeColor: 'TEXT_STRONG' | 'TEXT_BRAND'
}) {
    const { theme } = useUnistyles()
    const inactive = theme.colors.TEXT_MUTED
    const active = theme.colors[activeColor]
    const colorStyle = useAnimatedStyle(() => ({
        color: interpolateColor(
            position.get(),
            [index - 1, index, index + 1],
            [inactive, active, inactive],
        ),
    }))
    return (
        <Text
            {...props}
            animated
            color={null}
            style={[props.style, colorStyle] as never}
        />
    )
}

/** Swipeable pages for a `useTabsState` state: each tab's `page`, mounted lazily. */
export function TabsPages({
    state,
    ...rest
}: Omit<PagesProps, 'state' | 'pages'> & { state: TabsState }) {
    return (
        <Pages
            {...rest}
            state={state}
            pages={state.items.map(item => ({ id: item.key, page: item.page }))}
        />
    )
}

const styles = StyleSheet.create(theme => ({
    container: {
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.BORDER_SUBTLE,
    },
    scrollContent: (minWidth: number) => ({ minWidth }),
    controls: (grow: boolean) => ({
        flexDirection: 'row',
        flexGrow: 1,
        // The first label starts 16 from the edge, as in the reference; the rest of that is the item's padding.
        marginHorizontal: theme.space.PX_16 - ITEM_PADDING,
        justifyContent: grow ? 'space-around' : 'flex-start',
    }),
    item: (grow: boolean) => ({
        flexDirection: 'row',
        justifyContent: 'center',
        // 16 - indicator height
        paddingBottom: 14,
        paddingTop: theme.space.PX_12,
        paddingHorizontal: ITEM_PADDING,
        flexGrow: grow ? 1 : 0,
    }),
    count: { marginLeft: theme.space.PX_8 },
    indicator: (variant: 'default' | 'overlay') => ({
        position: 'absolute',
        left: 0,
        bottom: 0,
        height: 2,
        backgroundColor:
            variant === 'overlay'
                ? theme.colors.TEXT_STRONG
                : theme.colors.TEXT_BRAND,
        borderTopStartRadius: theme.radii.xs,
        borderTopEndRadius: theme.radii.xs,
    }),
}))
