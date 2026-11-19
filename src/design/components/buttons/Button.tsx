import { useEffect, useState } from 'react'
import { Pressable } from 'react-native'
import Animated, {
    interpolateColor,
    useAnimatedStyle,
    useDerivedValue,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { Icon } from '../../icons/Icon'
import { ON_PRESS_SPRING } from '../../tokens/motion'
import { Text } from '../Text'
import { ButtonEllipsis } from './ButtonEllipsis'
import { useThemedSurface } from './buttonTheme'
import { VARIANTS } from './buttonVariants'
import type { ImageStyle, StyleProp, ViewStyle } from 'react-native'
import type { AnimatedStyle } from 'react-native-reanimated'
import type { IconName } from '../../icons/Icon'
import type { TextVariant } from '../../tokens'
import type { ButtonVariant } from './buttonVariants'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps {
    /** Leave out for an icon-only button; give it an `accessibilityLabel` then. */
    text?: string
    /** Leading or trailing glyph, sized to the button. */
    icon?: IconName
    iconPosition?: 'start' | 'end'
    /** Override the size's default label variant. */
    textVariant?: TextVariant
    accessibilityLabel?: string
    onPress?: () => void
    variant?: ButtonVariant
    size?: ButtonSize
    disabled?: boolean
    /** Shows a spinner and blocks presses. */
    loading?: boolean
    /** Stretch to the parent's width instead of hugging the label. */
    grow?: boolean
    style?: StyleProp<ViewStyle>
    /** Added to the button itself, after its size and animated colours: the composer's send button square, for instance. */
    buttonStyle?: StyleProp<ViewStyle>
    /** Added to the icon's style, after its size, like IconButton's: the reference's BaseTextButtonIcon draws an animated Icon. */
    iconStyle?: StyleProp<AnimatedStyle<ImageStyle>>
}

const SIZES: Record<
    ButtonSize,
    {
        height: number
        paddingHorizontal: number
        text: TextVariant
        icon: number
        hitSlop: number
    }
> = {
    sm: {
        height: 32,
        paddingHorizontal: 12,
        text: 'text-sm/semibold',
        icon: 18,
        hitSlop: 6,
    },
    md: {
        height: 40,
        paddingHorizontal: 20,
        text: 'text-sm/semibold',
        icon: 20,
        hitSlop: 2,
    },
    lg: {
        height: 48,
        paddingHorizontal: 24,
        text: 'text-md/semibold',
        icon: 24,
        hitSlop: 0,
    },
}

/** How far the button shrinks while pressed, in pixels of width. */
const PRESS_SCALE_PX = 8

// BaseTextButton: createAnimatedComponent(Icon), so callers can animate the glyph.
const AnimatedIcon = Animated.createAnimatedComponent(Icon)

export function Button({
    text,
    onPress,
    icon,
    iconPosition = 'start',
    textVariant,
    accessibilityLabel,
    variant = 'primary',
    size = 'md',
    disabled = false,
    loading = false,
    grow = false,
    style,
    buttonStyle,
    iconStyle,
}: ButtonProps) {
    const { theme } = useUnistyles()
    const width = useSharedValue(0)
    const pressed = useSharedValue(0)
    const opacity = useSharedValue(disabled ? 0.5 : 1)
    const themed = useThemedSurface(variant)
    const colors = {
        ...VARIANTS[variant],
        ...(themed?.text && { text: themed.text }),
    }
    const config = SIZES[size]
    // 0..1 loading progress: label slides up and fades, the ellipsis slides in from below.
    const loadingProgress = useSharedValue(loading ? 1 : 0)
    const [ellipsisMounted, setEllipsisMounted] = useState(loading)
    const offsetY = size === 'lg' ? 18 : 12

    useEffect(() => {
        loadingProgress.value = withSpring(loading ? 1 : 0, ON_PRESS_SPRING)
        if (loading) {
            setEllipsisMounted(true)
            return
        }
        const timeout = setTimeout(() => setEllipsisMounted(false), 400)
        return () => clearTimeout(timeout)
    }, [loading, loadingProgress])

    const contentStyle = useAnimatedStyle(() => ({
        opacity: 1 - loadingProgress.value,
        transform: [{ translateY: -offsetY * loadingProgress.value }],
    }))
    const ellipsisStyle = useAnimatedStyle(() => ({
        opacity: loadingProgress.value,
        transform: [{ translateY: offsetY * (1 - loadingProgress.value) }],
    }))

    useEffect(() => {
        opacity.value = withSpring(disabled ? 0.5 : 1, ON_PRESS_SPRING)
    }, [disabled, opacity])

    // One spring drives both the colour blend and the shrink, like useButtonScaleStyles.
    const progress = useDerivedValue(() =>
        withSpring(pressed.value, ON_PRESS_SPRING),
    )
    const backgrounds = themed?.background ?? [
        theme.colors[colors.background],
        theme.colors[colors.backgroundPressed],
    ]
    const borders = themed?.border ?? [
        colors.border ? theme.colors[colors.border] : 'transparent',
        colors.borderPressed
            ? theme.colors[colors.borderPressed]
            : colors.border
              ? theme.colors[colors.border]
              : 'transparent',
    ]
    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        backgroundColor: interpolateColor(progress.value, [0, 1], backgrounds),
        borderColor: interpolateColor(progress.value, [0, 1], borders),
        transform: [
            {
                scale:
                    width.value > 0
                        ? 1 - (progress.value * PRESS_SCALE_PX) / width.value
                        : 1,
            },
        ],
    }))

    const iconElement = icon ? (
        <AnimatedIcon
            name={icon}
            color={colors.text}
            style={[styles.icon(config.icon), iconStyle]}
        />
    ) : null

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel ?? text}
            accessibilityState={{ disabled, busy: loading }}
            disabled={disabled || loading}
            hitSlop={{ top: config.hitSlop, bottom: config.hitSlop }}
            onPress={onPress}
            onPressIn={() => {
                pressed.value = 1
            }}
            onPressOut={() => {
                pressed.value = 0
            }}
            onLayout={event => {
                width.value = event.nativeEvent.layout.width
            }}
            style={[grow ? styles.grow : styles.hug, style]}
        >
            <Animated.View
                style={[styles.button(size), animatedStyle, buttonStyle]}
            >
                {/* The label stays laid out while loading so the button keeps its width. */}
                <Animated.View style={[styles.content, contentStyle]}>
                    {iconPosition === 'start' && iconElement}
                    {text !== undefined && (
                        <Text
                            variant={textVariant ?? config.text}
                            color={colors.text}
                            lineClamp={1}
                            style={[
                                styles.label,
                                icon && styles.labelGap(iconPosition),
                            ]}
                        >
                            {text}
                        </Text>
                    )}
                    {iconPosition === 'end' && iconElement}
                </Animated.View>
                {ellipsisMounted && (
                    <Animated.View
                        pointerEvents="none"
                        style={[styles.loading, ellipsisStyle]}
                    >
                        <ButtonEllipsis size={size} color={colors.text} />
                    </Animated.View>
                )}
            </Animated.View>
        </Pressable>
    )
}

const styles = StyleSheet.create(theme => ({
    grow: { alignSelf: 'stretch' },
    hug: { alignSelf: 'flex-start' },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: { flexShrink: 1 },
    // BaseTextButton: the label side next to the icon gets 4px, nothing extra outside the icon.
    labelGap: (position: 'start' | 'end') =>
        position === 'start'
            ? { paddingLeft: theme.space.PX_4 }
            : { paddingRight: theme.space.PX_4 },
    loading: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    icon: (size: number) => ({
        width: size,
        height: size,
        flexShrink: 0,
    }),
    button: (size: ButtonSize) => ({
        height: SIZES[size].height,
        paddingHorizontal: SIZES[size].paddingHorizontal,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius:
            size === 'lg'
                ? theme.modules.button.BORDER_RADIUS_LG
                : theme.modules.button.BORDER_RADIUS,
        borderWidth: 1,
    }),
}))
