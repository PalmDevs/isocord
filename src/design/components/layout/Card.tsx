import { View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { RipplePressable } from '../buttons/RipplePressable'
import type { PressableProps, ViewProps } from 'react-native'
import type { SemanticColor } from '../../tokens'

export type CardVariant =
    | 'primary'
    | 'secondary'
    | 'muted'
    | 'transparent'
    | 'control-secondary'
    | 'surface-high'
export type CardBorder =
    | 'none'
    | 'subtle'
    | 'strong'
    | 'faint'
    | 'control-secondary'
export type CardShadow = 'none' | 'border' | 'low' | 'medium' | 'high' | 'ledge'

export interface CardProps extends ViewProps {
    variant?: CardVariant
    border?: CardBorder
    shadow?: CardShadow
    /** Round the top corners. Turn off for a card attached to the one above. */
    start?: boolean
    /** Round the bottom corners. */
    end?: boolean
    /** Corner radius; defaults to the CARD_DEFAULT_RADIUS token. */
    radius?: number
    /** Makes the card pressable, with a ripple background. */
    onPress?: PressableProps['onPress']
    onPressIn?: PressableProps['onPressIn']
    onLongPress?: PressableProps['onLongPress']
    onPressOut?: PressableProps['onPressOut']
}

/** Rest background of each variant. */
const BACKGROUNDS: Record<CardVariant, SemanticColor | null> = {
    primary: 'TABLEROW_BACKGROUND_DEFAULT',
    secondary: 'CARD_SECONDARY_BACKGROUND_DEFAULT',
    muted: 'CARD_MUTED_BG',
    transparent: null,
    'control-secondary': 'CONTROL_SECONDARY_BACKGROUND_DEFAULT',
    'surface-high': 'BACKGROUND_SURFACE_HIGH',
}

const BORDERS: Record<Exclude<CardBorder, 'none'>, SemanticColor> = {
    subtle: 'BORDER_SUBTLE',
    strong: 'BORDER_STRONG',
    faint: 'BORDER_MUTED',
    'control-secondary': 'CONTROL_SECONDARY_BORDER_DEFAULT',
}

const SHADOWS = {
    border: 'SHADOW_BORDER',
    low: 'SHADOW_LOW',
    medium: 'SHADOW_MEDIUM',
    high: 'SHADOW_HIGH',
    ledge: 'SHADOW_LEDGE',
} as const

export function Card({
    variant = 'primary',
    border = 'faint',
    shadow = 'none',
    start = true,
    end = true,
    radius,
    onPress,
    onPressIn,
    onLongPress,
    onPressOut,
    style,
    children,
    ...props
}: CardProps) {
    const { theme } = useUnistyles()
    const resolvedRadius = radius ?? theme.modules.mobile.CARD_DEFAULT_RADIUS
    const cardStyle = [
        styles.card(variant, border, shadow, start, end, resolvedRadius),
        style,
    ]

    if (!onPress) {
        return (
            <View {...props} style={cardStyle}>
                {children}
            </View>
        )
    }

    return (
        <RipplePressable
            accessibilityRole={props.accessibilityRole ?? 'button'}
            {...props}
            onPress={onPress}
            onPressIn={onPressIn}
            onLongPress={onLongPress}
            onPressOut={onPressOut}
            style={cardStyle}
        >
            {children}
        </RipplePressable>
    )
}

const styles = StyleSheet.create(theme => ({
    card: (
        variant: CardVariant,
        border: CardBorder,
        shadow: CardShadow,
        start: boolean,
        end: boolean,
        radius: number,
    ) => {
        const background = BACKGROUNDS[variant]
        const backgroundColor = background
            ? theme.colors[background]
            : 'transparent'
        return {
            padding: theme.space.PX_16,
            boxShadow:
                shadow === 'none' ? undefined : theme.shadows[SHADOWS[shadow]],
            borderTopStartRadius: start ? radius : undefined,
            borderTopEndRadius: start ? radius : undefined,
            borderBottomStartRadius: end ? radius : undefined,
            borderBottomEndRadius: end ? radius : undefined,
            borderWidth: border === 'none' ? 0 : 1,
            borderColor:
                border === 'none'
                    ? backgroundColor
                    : theme.colors[BORDERS[border]],
            backgroundColor,
        }
    },
}))
