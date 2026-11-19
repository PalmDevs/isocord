import { Text as NativeText } from 'react-native'
import Animated from 'react-native-reanimated'
import { StyleSheet } from 'react-native-unistyles'
import type { TextProps as NativeTextProps } from 'react-native'
import type { SemanticColor, TextVariant } from '../tokens'

export interface TextProps extends NativeTextProps {
    variant?: TextVariant
    color?: SemanticColor
    /** Maximum number of lines before truncating. */
    lineClamp?: number
    /** Fixed-width digits, for counters and timers that change in place. */
    tabularNumbers?: boolean
    /** Render a Reanimated text so `style` can hold animated styles. */
    animated?: boolean
}

export function Text({
    variant = 'text-md/normal',
    color = 'TEXT_DEFAULT',
    lineClamp,
    tabularNumbers = false,
    animated = false,
    style,
    ...props
}: TextProps) {
    const Component = animated ? Animated.Text : NativeText
    return (
        <Component
            numberOfLines={lineClamp}
            {...props}
            style={[styles.text(variant, color, tabularNumbers), style]}
        />
    )
}

const styles = StyleSheet.create(theme => ({
    text: (
        variant: TextVariant,
        color: SemanticColor,
        tabularNumbers: boolean,
    ) => ({
        ...theme.text[variant],
        color: theme.colors[color],
        includeFontPadding: false,
        fontVariant: tabularNumbers ? ['tabular-nums' as const] : undefined,
    }),
}))
