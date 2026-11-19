import { isValidElement, useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'
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
import { ICON_BUTTON_SIZES } from './iconButtonSizes'
import type { ReactElement } from 'react'
import type { ImageStyle, StyleProp, ViewStyle } from 'react-native'
import type { AnimatedStyle } from 'react-native-reanimated'
import type { IconName } from '../../icons/Icon'
import type { SemanticColor } from '../../tokens'
import type { ButtonSize } from './Button'
import type { ButtonVariant } from './buttonVariants'

export type IconButtonVariant = ButtonVariant | 'icon-only'
export type ToggleIconButtonVariant = 'default' | 'critical' | 'icon-only'

export interface IconButtonProps {
    /** An icon, or an element drawn as-is in its place, untinted and sized by the caller (BaseIconButton). */
    icon: IconName | ReactElement
    /** Optional caption rendered under the button (text-xs/medium). */
    label?: string
    accessibilityLabel?: string
    accessibilityHint?: string
    onPress?: () => void
    variant?: IconButtonVariant
    size?: ButtonSize
    disabled?: boolean
    /** Swaps the icon for an ellipsis and blocks presses. */
    loading?: boolean
    /** With a label: stretch the wrapper to fill the parent's main axis. */
    grow?: boolean
    style?: StyleProp<ViewStyle>
    /** Added to the icon's style, after its size: a turn of the icon alone (MediaKeyboardButtonIcon), for instance. */
    iconStyle?: StyleProp<AnimatedStyle<ImageStyle>>
}

interface IconColors {
    icon: SemanticColor
    iconPressed: SemanticColor
    background?: SemanticColor
    backgroundPressed: SemanticColor
    border?: SemanticColor
    borderPressed?: SemanticColor
}

// getButtonColorTokens() in the reference client; undefined means transparent.
const ICON_ONLY: IconColors = {
    icon: 'CONTROL_ICON_ONLY_ICON_DEFAULT',
    iconPressed: 'CONTROL_ICON_ONLY_ICON_DEFAULT',
    backgroundPressed: 'CONTROL_ICON_ONLY_BACKGROUND_ACTIVE',
}

const TOGGLES: Record<
    ToggleIconButtonVariant,
    Record<'off' | 'on', IconColors>
> = {
    default: {
        off: {
            icon: 'TOGGLEBUTTON_ICON_DEFAULT',
            iconPressed: 'TOGGLEBUTTON_ICON_ACTIVE',
            backgroundPressed: 'CONTROL_SECONDARY_BACKGROUND_ACTIVE',
            borderPressed: 'TOGGLEBUTTON_BORDER_ACTIVE',
        },
        on: {
            icon: 'TOGGLEBUTTON_ICON_SELECTED',
            iconPressed: 'TOGGLEBUTTON_ICON_ACTIVE',
            background: 'TOGGLEBUTTON_BACKGROUND_SELECTED',
            backgroundPressed: 'TOGGLEBUTTON_BACKGROUND_SELECTED_HOVER',
            border: 'TOGGLEBUTTON_BORDER_SELECTED',
            borderPressed: 'TOGGLEBUTTON_BORDER_ACTIVE',
        },
    },
    critical: {
        off: {
            icon: 'TOGGLEBUTTON_CRITICAL_ICON_DEFAULT',
            iconPressed: 'TOGGLEBUTTON_CRITICAL_ICON_ACTIVE',
            backgroundPressed: 'CONTROL_SECONDARY_BACKGROUND_ACTIVE',
            borderPressed: 'TOGGLEBUTTON_CRITICAL_BORDER_ACTIVE',
        },
        on: {
            icon: 'TOGGLEBUTTON_CRITICAL_ICON_SELECTED',
            iconPressed: 'TOGGLEBUTTON_CRITICAL_ICON_ACTIVE',
            background: 'TOGGLEBUTTON_CRITICAL_BACKGROUND_SELECTED',
            backgroundPressed:
                'TOGGLEBUTTON_CRITICAL_BACKGROUND_SELECTED_HOVER',
            borderPressed: 'TOGGLEBUTTON_CRITICAL_BORDER_ACTIVE',
        },
    },
    'icon-only': {
        off: {
            icon: 'TOGGLEBUTTON_ICON_ONLY_ICON_DEFAULT',
            iconPressed: 'TOGGLEBUTTON_ICON_ONLY_ICON_ACTIVE',
            backgroundPressed: 'CONTROL_ICON_ONLY_BACKGROUND_ACTIVE',
            borderPressed: 'CONTROL_ICON_ONLY_BORDER_ACTIVE',
        },
        on: {
            icon: 'TOGGLEBUTTON_ICON_ONLY_ICON_SELECTED',
            iconPressed: 'TOGGLEBUTTON_ICON_ONLY_ICON_ACTIVE',
            backgroundPressed: 'CONTROL_ICON_ONLY_BACKGROUND_ACTIVE',
            borderPressed: 'CONTROL_ICON_ONLY_BORDER_ACTIVE',
        },
    },
}

function getColors(variant: IconButtonVariant): IconColors {
    if (variant === 'icon-only') return ICON_ONLY
    const v = VARIANTS[variant]
    return {
        icon: v.text,
        iconPressed: v.text,
        background: v.background,
        backgroundPressed: v.backgroundPressed,
        border: v.border,
        borderPressed: v.borderPressed,
    }
}
const MINIMUM_HIT_AREA = 44
/** BaseIconButton's scaleAmountInPx default (Button uses 8). */
const PRESS_SCALE_PX = 4

const AnimatedIcon = Animated.createAnimatedComponent(Icon)

interface BaseProps extends Omit<IconButtonProps, 'variant'> {
    colors: IconColors
    /** The variant, for the button theme's colours. Unset for icon-only and toggle buttons. */
    themeVariant?: ButtonVariant
    accessibilityRole?: 'button' | 'togglebutton'
    checked?: boolean
}

function BaseIconButton({
    icon,
    colors: tokenColors,
    themeVariant,
    accessibilityLabel,
    accessibilityHint,
    accessibilityRole = 'button',
    checked,
    onPress,
    size = 'md',
    disabled = false,
    loading = false,
    style,
    iconStyle,
}: BaseProps) {
    const { theme } = useUnistyles()
    const themed = useThemedSurface(themeVariant)
    const colors = themed?.text
        ? { ...tokenColors, icon: themed.text, iconPressed: themed.text }
        : tokenColors
    const config = ICON_BUTTON_SIZES[size]
    const width = useSharedValue(0)
    const pressed = useSharedValue(0)
    const opacity = useSharedValue(disabled ? 0.5 : 1)
    const loadingProgress = useSharedValue(loading ? 1 : 0)

    useEffect(() => {
        opacity.value = withSpring(disabled ? 0.5 : 1, ON_PRESS_SPRING)
    }, [disabled, opacity])
    // Keep the ellipsis mounted while it fades out.
    const [ellipsisMounted, setEllipsisMounted] = useState(loading)
    useEffect(() => {
        loadingProgress.value = withSpring(loading ? 1 : 0, ON_PRESS_SPRING)
        if (loading) {
            setEllipsisMounted(true)
            return
        }
        const timeout = setTimeout(() => setEllipsisMounted(false), 400)
        return () => clearTimeout(timeout)
    }, [loading, loadingProgress])

    // One spring drives the colour blend and the shrink, like useButtonScaleStyles.
    const progress = useDerivedValue(() =>
        withSpring(pressed.value, ON_PRESS_SPRING),
    )
    const backgrounds = themed?.background ?? [
        colors.background ? theme.colors[colors.background] : 'transparent',
        theme.colors[colors.backgroundPressed],
    ]
    const borderDefault = colors.border
        ? theme.colors[colors.border]
        : 'transparent'
    const borders = themed?.border ?? [
        borderDefault,
        colors.borderPressed
            ? theme.colors[colors.borderPressed]
            : borderDefault,
    ]
    const tints = [theme.colors[colors.icon], theme.colors[colors.iconPressed]]

    const pillStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        backgroundColor: interpolateColor(progress.value, [0, 1], backgrounds),
        borderColor: interpolateColor(progress.value, [0, 1], borders),
        transform: [
            {
                scale:
                    width.value > 0
                        ? (width.value - progress.value * PRESS_SCALE_PX) /
                          width.value
                        : 1,
            },
        ],
    }))
    const animatedIconStyle = useAnimatedStyle(() => ({
        opacity: 1 - loadingProgress.value,
        tintColor: interpolateColor(progress.value, [0, 1], tints),
    }))
    const loaderStyle = useAnimatedStyle(() => ({
        opacity: loadingProgress.value,
    }))

    return (
        <Pressable
            accessibilityRole={accessibilityRole}
            accessibilityLabel={accessibilityLabel}
            accessibilityHint={accessibilityHint}
            accessibilityState={{
                disabled,
                busy: loading,
                ...(checked === undefined ? null : { checked }),
            }}
            disabled={disabled || loading}
            hitSlop={Math.max((MINIMUM_HIT_AREA - config.height) / 2, 0)}
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
            style={[styles.button, style]}
        >
            <Animated.View style={[styles.pill(size), pillStyle]}>
                {isValidElement(icon) ? (
                    icon
                ) : (
                    <AnimatedIcon
                        name={icon}
                        color={colors.icon}
                        style={[
                            styles.icon(config.icon),
                            iconStyle,
                            animatedIconStyle,
                        ]}
                    />
                )}
                {ellipsisMounted ? (
                    <Animated.View
                        pointerEvents="none"
                        style={[styles.loading, loaderStyle]}
                    >
                        <ButtonEllipsis
                            size={size === 'lg' ? 'sm' : 'xs'}
                            color={colors.icon}
                        />
                    </Animated.View>
                ) : null}
            </Animated.View>
        </Pressable>
    )
}

export function IconButton({
    variant = 'primary',
    label,
    grow = false,
    style,
    ...props
}: IconButtonProps) {
    const button = (
        <BaseIconButton
            {...props}
            colors={getColors(variant)}
            themeVariant={variant === 'icon-only' ? undefined : variant}
            accessibilityLabel={
                props.accessibilityLabel ??
                label ??
                (typeof props.icon === 'string' ? props.icon : undefined)
            }
            style={label ? undefined : style}
        />
    )
    if (label === undefined) return button
    // The caption sits under the button and is part of the same target.
    return (
        <View style={[styles.labelWrapper(grow), style]}>
            {button}
            <Text
                variant="text-xs/medium"
                color="INTERACTIVE_TEXT_DEFAULT"
                style={styles.label}
            >
                {label}
            </Text>
        </View>
    )
}

export interface ToggleIconButtonProps
    extends Omit<IconButtonProps, 'variant' | 'label' | 'grow'> {
    /** Whether the toggle is on. */
    pressed?: boolean
    /** Icon shown while on; falls back to `icon`. */
    selectedIcon?: IconName | ReactElement
    variant?: ToggleIconButtonVariant
}

export function ToggleIconButton({
    pressed = false,
    selectedIcon,
    icon,
    variant = 'default',
    ...props
}: ToggleIconButtonProps) {
    return (
        <BaseIconButton
            {...props}
            icon={pressed ? (selectedIcon ?? icon) : icon}
            colors={TOGGLES[variant][pressed ? 'on' : 'off']}
            accessibilityRole="togglebutton"
            checked={pressed}
        />
    )
}

const styles = StyleSheet.create(theme => ({
    button: { flexShrink: 0, flexGrow: 0, alignSelf: 'center' },
    pill: (size: ButtonSize) => ({
        height: ICON_BUTTON_SIZES[size].height,
        width: ICON_BUTTON_SIZES[size].height,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderRadius:
            size === 'lg'
                ? theme.modules.button.BORDER_RADIUS_LG
                : theme.modules.button.BORDER_RADIUS,
    }),
    icon: (size: number) => ({ width: size, height: size }),
    loading: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    labelWrapper: (grow: boolean) => ({
        alignItems: 'center',
        alignSelf: 'center',
        flexGrow: grow ? 1 : 0,
        gap: theme.space.PX_8,
        paddingBottom: theme.space.PX_4,
    }),
    label: { textAlign: 'center' },
}))
