import { View } from 'react-native'
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { RING_SPRING } from '../../tokens/motion'
import { INPUT_HEIGHTS } from './inputHeights'
import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import type { InputSize } from './inputHeights'
export type InputStatus = 'default' | 'error'

export interface InputFieldContainerProps {
    size?: InputSize
    /** Uses the pill-ish round radius instead of the per-size radius. */
    round?: boolean
    status?: InputStatus
    isFocused?: boolean
    disabled?: boolean
    /** Fixed height, for text areas. */
    height?: number
    style?: StyleProp<ViewStyle>
    children: ReactNode
}

/** Field background, border and animated focus/error ring. Children sit in a row. */
export function InputFieldContainer({
    size = 'lg',
    round = false,
    status = 'default',
    isFocused = false,
    disabled = false,
    height,
    style,
    children,
}: InputFieldContainerProps) {
    const { theme } = useUnistyles()
    const errorColor = theme.colors.INPUT_BORDER_ERROR_DEFAULT
    const focusColor = theme.colors.INPUT_BORDER_ACTIVE

    // The ring sits outside the field and grows outward, so the field itself never shifts.
    const ringStyle = useAnimatedStyle(() => {
        const isError = status !== 'default'
        const width = isError ? 2 : isFocused ? 1 : 0
        const color = isError
            ? errorColor
            : isFocused
              ? focusColor
              : 'transparent'
        return {
            borderWidth: withSpring(width, RING_SPRING),
            borderColor: withSpring(color, RING_SPRING),
            left: -width,
            right: -width,
            top: -width,
            bottom: -width,
        }
    })

    return (
        <View
            style={[
                styles.field(size, round, height),
                disabled && styles.disabled,
                style,
            ]}
        >
            <Animated.View
                pointerEvents="none"
                style={[styles.ring(size, round), ringStyle]}
            />
            {children}
        </View>
    )
}

const styles = StyleSheet.create(theme => {
    const m = theme.modules.mobile
    const radius = (size: InputSize, round: boolean) =>
        round
            ? /* ? m.INPUT_FIELD_ROUND_RADIUS */
              theme.radii.round
            : size === 'lg'
              ? m.INPUT_FIELD_RADIUS_LG
              : size === 'md'
                ? m.INPUT_FIELD_RADIUS_MD
                : m.INPUT_FIELD_RADIUS_SM
    return {
        disabled: { opacity: 0.5 },
        field: (size: InputSize, round: boolean, height?: number) => ({
            flexDirection: 'row',
            alignItems: height === undefined ? 'center' : 'flex-start',
            minHeight: INPUT_HEIGHTS[size],
            height,
            borderRadius: radius(size, round),
            borderWidth: m.INPUT_FIELD_BORDER_WIDTH,
            borderColor: theme.colors.INPUT_BORDER_DEFAULT,
            backgroundColor: theme.colors.INPUT_BACKGROUND_DEFAULT,
        }),
        ring: (size: InputSize, round: boolean) => ({
            position: 'absolute',
            borderRadius: radius(size, round),
        }),
    }
})
