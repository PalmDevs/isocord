import { useEffect } from 'react'
import { Pressable } from 'react-native'
import Animated, {
    interpolate,
    interpolateColor,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { Icon } from '../icons/Icon'
import { SUBTLE_SPRING } from '../tokens/motion'
import type { PressableProps } from 'react-native'

export interface FormSwitchProps
    extends Pick<
        PressableProps,
        'accessibilityLabel' | 'accessibilityHint' | 'testID'
    > {
    value: boolean
    onValueChange?: (value: boolean) => void
    disabled?: boolean
    /** Hide the switch from accessibility, for use inside a row that is itself the switch. */
    'aria-hidden'?: boolean
}

/** The Mana toggle: a 56x28 track whose knob and colours spring between off and on. */
export function FormSwitch({
    value,
    onValueChange,
    disabled = false,
    'aria-hidden': hidden = false,
    ...accessibility
}: FormSwitchProps) {
    const { theme } = useUnistyles()
    const progress = useSharedValue(value ? 1 : 0)
    const { colors, modules } = theme
    const track = [
        colors.SWITCH_BACKGROUND_DEFAULT,
        colors.SWITCH_BACKGROUND_SELECTED_DEFAULT,
    ]
    const border = [
        colors.SWITCH_BORDER_DEFAULT,
        colors.SWITCH_BORDER_SELECTED_DEFAULT,
    ]
    const knob = [
        colors.SWITCH_THUMB_BACKGROUND_DEFAULT,
        colors.SWITCH_THUMB_BACKGROUND_SELECTED_DEFAULT,
    ]
    const knobTravel = modules.mobile.CONTROL_SWITCH_KNOB_CHECKED_OFFSET

    useEffect(() => {
        progress.set(withSpring(value ? 1 : 0, SUBTLE_SPRING))
    }, [value, progress])

    const trackStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(progress.get(), [0, 1], track),
        borderColor: interpolateColor(progress.get(), [0, 1], border),
    }))
    const knobStyle = useAnimatedStyle(() => ({
        left: interpolate(progress.get(), [0, 1], [0, knobTravel]),
        backgroundColor: interpolateColor(progress.get(), [0, 1], knob),
    }))

    return (
        <AnimatedPressable
            {...(hidden
                ? {
                      accessibilityElementsHidden: true,
                      importantForAccessibility: 'no-hide-descendants' as const,
                  }
                : {
                      accessible: true,
                      accessibilityRole: 'switch' as const,
                      accessibilityState: { disabled, checked: value },
                      ...accessibility,
                  })}
            disabled={disabled}
            onPress={() => onValueChange?.(!value)}
            style={[styles.track, trackStyle, disabled && styles.disabled]}
        >
            <Animated.View style={[styles.knob, knobStyle]} />
        </AnimatedPressable>
    )
}

/** Springs a box's border and fill between two colours, then pops the inner glyph in and out. */
function useSelectionStyles(
    selected: boolean,
    on: { borderColor: string; backgroundColor: string },
    off: { borderColor: string; backgroundColor: string },
) {
    const reducedMotion = useReducedMotion()
    const box = useAnimatedStyle(() => ({
        borderColor: withSpring(
            selected ? on.borderColor : off.borderColor,
            SUBTLE_SPRING,
        ),
        backgroundColor: withSpring(
            selected ? on.backgroundColor : off.backgroundColor,
            SUBTLE_SPRING,
        ),
    }))
    const glyph = useAnimatedStyle(() => ({
        opacity: withSpring(selected ? 1 : 0, SUBTLE_SPRING),
        transform: [
            {
                scale: withSpring(
                    selected || reducedMotion ? 1 : 0.5,
                    SUBTLE_SPRING,
                ),
            },
        ],
    }))
    return { box, glyph }
}

export interface FormCheckboxProps {
    checked: boolean
}

/** The checkbox box on its own: a 24px rounded square that fills and shows a checkmark when checked. */
export function FormCheckbox({ checked }: FormCheckboxProps) {
    const { theme } = useUnistyles()
    const { colors } = theme
    const { box, glyph } = useSelectionStyles(
        checked,
        {
            borderColor: colors.CHECKBOX_BORDER_SELECTED_DEFAULT,
            backgroundColor: colors.CHECKBOX_BACKGROUND_SELECTED_DEFAULT,
        },
        {
            borderColor: colors.CHECKBOX_BORDER_DEFAULT,
            backgroundColor: colors.CHECKBOX_BACKGROUND_DEFAULT,
        },
    )

    return (
        <Animated.View style={[styles.checkbox, box]}>
            <Animated.View style={glyph}>
                <Icon
                    name="CheckmarkSmallBoldIcon"
                    color="CHECKBOX_ICON_ACTIVE"
                    style={styles.checkmark}
                />
            </Animated.View>
        </Animated.View>
    )
}

export interface FormRadioProps {
    selected: boolean
}

/** The radio circle on its own: a 24px ring that fills and shows a white dot when selected. */
export function FormRadio({ selected }: FormRadioProps) {
    const { theme } = useUnistyles()
    const { colors } = theme
    const { box, glyph } = useSelectionStyles(
        selected,
        {
            borderColor: colors.REDESIGN_INPUT_CONTROL_SELECTED,
            backgroundColor: colors.REDESIGN_INPUT_CONTROL_SELECTED,
        },
        {
            borderColor: colors.RADIO_BORDER_DEFAULT,
            backgroundColor: 'transparent',
        },
    )

    return (
        <Animated.View style={[styles.radio, box]}>
            <Animated.View style={[styles.dot, glyph]} />
        </Animated.View>
    )
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

const styles = StyleSheet.create(theme => ({
    track: {
        width: theme.modules.mobile.CONTROL_SWITCH_WIDTH,
        height: theme.modules.mobile.CONTROL_SWITCH_HEIGHT,
        padding: theme.space.PX_4 - 1,
        flexGrow: 0,
        flexShrink: 0,
        borderRadius: theme.radii.lg,
        borderWidth: 1,
    },
    knob: {
        width: theme.modules.mobile.CONTROL_SWITCH_KNOB_SIZE,
        height: theme.modules.mobile.CONTROL_SWITCH_KNOB_SIZE,
        borderRadius: theme.radii.round,
    },
    checkbox: {
        width: theme.modules.mobile.CONTROL_CHECKBOX_SIZE_DEFAULT,
        height: theme.modules.mobile.CONTROL_CHECKBOX_SIZE_DEFAULT,
        flexGrow: 0,
        flexShrink: 0,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.modules.mobile.CONTROL_CHECKBOX_BORDER_RADIUS,
        borderWidth: theme.modules.mobile.CONTROL_CHECKBOX_BORDER_WIDTH,
    },
    checkmark: { width: 20, height: 20 },
    radio: {
        width: theme.modules.mobile.CONTROL_RADIO_ICON_SIZE_DEFAULT,
        height: theme.modules.mobile.CONTROL_RADIO_ICON_SIZE_DEFAULT,
        flexGrow: 0,
        flexShrink: 0,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radii.round,
        borderWidth: theme.modules.mobile.CONTROL_RADIO_ICON_BORDER_WIDTH,
    },
    dot: {
        width: theme.modules.mobile.CONTROL_RADIO_ICON_DOT_SIZE_DEFAULT,
        height: theme.modules.mobile.CONTROL_RADIO_ICON_DOT_SIZE_DEFAULT,
        borderRadius: theme.radii.round,
        backgroundColor: theme.colors.WHITE,
    },
    disabled: {
        opacity: 0.5,
    },
}))
