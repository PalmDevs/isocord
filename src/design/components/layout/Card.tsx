import { Pressable, View } from 'react-native'
import Animated, {
    interpolateColor,
    useAnimatedStyle,
    useDerivedValue,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { ON_PRESS_SPRING } from '../../tokens/motion'
import type {
    GestureResponderEvent,
    PressableProps,
    ViewProps,
} from 'react-native'
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
    /** Makes the card pressable, with an animated background. */
    onPress?: PressableProps['onPress']
    onPressIn?: PressableProps['onPressIn']
    onLongPress?: PressableProps['onLongPress']
    onPressOut?: PressableProps['onPressOut']
}

/** [rest, pressed] background of each variant; `null` pressed means TRANSPARENT's BACKGROUND_MOD_SUBTLE. */
const BACKGROUNDS: Record<
    CardVariant,
    { rest: SemanticColor | null; pressed: SemanticColor }
> = {
    primary: {
        rest: 'TABLEROW_BACKGROUND_DEFAULT',
        pressed: 'TABLEROW_BACKGROUND_PRESSED',
    },
    secondary: {
        rest: 'CARD_SECONDARY_BACKGROUND_DEFAULT',
        pressed: 'CARD_SECONDARY_BACKGROUND_ACTIVE',
    },
    muted: { rest: 'CARD_MUTED_BG', pressed: 'CARD_MUTED_PRESSED_BG' },
    transparent: { rest: null, pressed: 'BACKGROUND_MOD_SUBTLE' },
    'control-secondary': {
        rest: 'CONTROL_SECONDARY_BACKGROUND_DEFAULT',
        pressed: 'CONTROL_SECONDARY_BACKGROUND_ACTIVE',
    },
    'surface-high': {
        rest: 'BACKGROUND_SURFACE_HIGH',
        pressed: 'BACKGROUND_BASE_LOW',
    },
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
        <PressableCard
            {...props}
            accessibilityRole={props.accessibilityRole ?? 'button'}
            variant={variant}
            onPress={onPress}
            onPressIn={onPressIn}
            onLongPress={onLongPress}
            onPressOut={onPressOut}
            style={cardStyle}
        >
            {children}
        </PressableCard>
    )
}

function PressableCard({
    variant,
    onPress,
    onPressIn,
    onLongPress,
    onPressOut,
    style,
    children,
    ...props
}: ViewProps &
    Pick<CardProps, 'onPress' | 'onPressIn' | 'onLongPress' | 'onPressOut'> & {
        variant: CardVariant
    }) {
    const { theme } = useUnistyles()
    const pressed = useSharedValue(0)
    const progress = useDerivedValue(() =>
        withSpring(pressed.value, ON_PRESS_SPRING),
    )
    const { rest, pressed: pressedColor } = BACKGROUNDS[variant]
    const colors = [
        rest ? theme.colors[rest] : 'transparent',
        theme.colors[pressedColor],
    ]
    const animated = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(progress.value, [0, 1], colors),
    }))

    return (
        <AnimatedPressable
            {...props}
            unstable_pressDelay={130}
            onPress={onPress}
            onLongPress={onLongPress}
            onPressIn={(event: GestureResponderEvent) => {
                pressed.value = 1
                onPressIn?.(event)
            }}
            onPressOut={(event: GestureResponderEvent) => {
                pressed.value = 0
                onPressOut?.(event)
            }}
            style={[style, animated]}
        >
            {children}
        </AnimatedPressable>
    )
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

const styles = StyleSheet.create(theme => ({
    card: (
        variant: CardVariant,
        border: CardBorder,
        shadow: CardShadow,
        start: boolean,
        end: boolean,
        radius: number,
    ) => {
        const background = BACKGROUNDS[variant].rest
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
