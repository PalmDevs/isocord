import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import type { ReactNode } from 'react'
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native'

export interface StackProps {
    /** Gap between children. */
    spacing?: number
    direction?: 'vertical' | 'horizontal'
    /** Cross-axis alignment. */
    align?: ViewStyle['alignItems']
    /** Main-axis alignment. */
    justify?: ViewStyle['justifyContent']
    children?: ReactNode
    style?: StyleProp<ViewStyle>
    onLayout?: (event: LayoutChangeEvent) => void
}

/** Flex container with a uniform gap; stretches to the parent's width (Stack). */
export function Stack({
    spacing = 8,
    direction = 'vertical',
    align = 'stretch',
    justify = 'flex-start',
    children,
    style,
    onLayout,
}: StackProps) {
    return (
        <View
            style={[styles.stack(spacing, direction, align, justify), style]}
            onLayout={onLayout}
        >
            {children}
        </View>
    )
}

const styles = StyleSheet.create({
    stack: (
        gap: number,
        direction: 'vertical' | 'horizontal',
        alignItems: ViewStyle['alignItems'],
        justifyContent: ViewStyle['justifyContent'],
    ) => ({
        width: '100%',
        gap,
        alignItems,
        justifyContent,
        flexDirection: direction === 'horizontal' ? 'row' : 'column',
    }),
})
