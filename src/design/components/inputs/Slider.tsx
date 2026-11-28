import { useEffect, useRef } from 'react'
import { View } from 'react-native'
import {
    GestureDetector,
    usePanGesture,
    useSimultaneousGestures,
    useTapGesture,
} from 'react-native-gesture-handler'
import Animated, {
    useAnimatedStyle,
    useSharedValue,
} from 'react-native-reanimated'
import { StyleSheet } from 'react-native-unistyles'
import { scheduleOnRN } from 'react-native-worklets'
import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'

export interface SliderProps {
    value?: number
    minimumValue?: number
    maximumValue?: number
    /** Snap to multiples of this size above the minimum. Continuous when omitted. */
    step?: number
    /** Fires on every change while dragging or tapping. */
    onValueChange?: (value: number) => void
    /** Fires once when the finger lifts. */
    onSlidingComplete?: (value: number) => void
    disabled?: boolean
    /** Shown before the track, e.g. a muted speaker icon. */
    startIcon?: ReactNode
    /** Shown after the track. */
    endIcon?: ReactNode
    /** Drawn in place of the track and its fill, such as VoiceSensitivity's meter. Transparent tracks in the reference. */
    track?: ReactNode
    style?: StyleProp<ViewStyle>
}

const THUMB_SIZE = 20
const TRACK_HEIGHT = 4

/**
 * Horizontal slider. The reference wraps the native community slider with tap-to-seek; this is the same
 * look and behaviour built from gesture-handler and Reanimated so it needs no native module.
 */
export function Slider({
    value = 0,
    minimumValue = 0,
    maximumValue = 1,
    step,
    onValueChange,
    onSlidingComplete,
    disabled = false,
    startIcon,
    endIcon,
    track,
    style,
}: SliderProps) {
    const range = maximumValue - minimumValue
    const toProgress = (v: number) =>
        range === 0 ? 0 : Math.min(Math.max((v - minimumValue) / range, 0), 1)
    const progress = useSharedValue(toProgress(value))
    const width = useSharedValue(0)
    const dragging = useRef(false)

    // Follow the controlled value, except while the finger is the one moving the thumb.
    // biome-ignore lint/correctness/useExhaustiveDependencies: toProgress only closes over the listed bounds
    useEffect(() => {
        if (!dragging.current) progress.set(toProgress(value))
    }, [value, minimumValue, maximumValue, progress])

    const setDragging = (active: boolean) => {
        dragging.current = active
    }

    /** Maps a touch x to a stepped progress, updates the thumb and reports the new value. */
    const seek = (x: number) => {
        'worklet'
        const usable = width.get() - THUMB_SIZE
        if (usable <= 0) return
        let next = Math.min(Math.max((x - THUMB_SIZE / 2) / usable, 0), 1)
        if (step != null && step > 0 && range > 0) {
            next =
                Math.min(Math.round((next * range) / step) * step, range) /
                range
        }
        if (next === progress.get()) return
        progress.set(next)
        if (onValueChange)
            scheduleOnRN(onValueChange, minimumValue + next * range)
    }

    const finish = () => {
        'worklet'
        scheduleOnRN(setDragging, false)
        if (onSlidingComplete)
            scheduleOnRN(
                onSlidingComplete,
                minimumValue + progress.get() * range,
            )
    }

    const pan = usePanGesture({
        enabled: !disabled,
        // Taps seek through the tap gesture; a small horizontal slop keeps vertical scrolling of the parent working.
        activeOffsetX: [-4, 4],
        failOffsetY: [-16, 16],
        onActivate: event => {
            scheduleOnRN(setDragging, true)
            seek(event.x)
        },
        onUpdate: event => seek(event.x),
        onDeactivate: finish,
    })
    const tap = useTapGesture({
        enabled: !disabled,
        onDeactivate: event => {
            seek(event.x)
            finish()
        },
    })
    const gesture = useSimultaneousGestures(pan, tap)

    const filledStyle = useAnimatedStyle(() => ({
        width: THUMB_SIZE / 2 + progress.get() * (width.get() - THUMB_SIZE),
    }))
    const thumbStyle = useAnimatedStyle(() => ({
        left: progress.get() * (width.get() - THUMB_SIZE),
    }))

    return (
        <View style={[styles.container, disabled && styles.disabled, style]}>
            {startIcon != null && (
                <View style={styles.startIcon}>{startIcon}</View>
            )}
            <GestureDetector gesture={gesture}>
                <View
                    accessible
                    accessibilityRole="adjustable"
                    accessibilityState={{ disabled }}
                    accessibilityValue={{
                        min: minimumValue,
                        max: maximumValue,
                        now: value,
                    }}
                    accessibilityActions={[
                        { name: 'increment' },
                        { name: 'decrement' },
                    ]}
                    onAccessibilityAction={event => {
                        const delta = step ?? range / 10
                        const direction =
                            event.nativeEvent.actionName === 'increment'
                                ? 1
                                : -1
                        onValueChange?.(
                            Math.min(
                                Math.max(
                                    value + direction * delta,
                                    minimumValue,
                                ),
                                maximumValue,
                            ),
                        )
                    }}
                    onLayout={event =>
                        width.set(event.nativeEvent.layout.width)
                    }
                    style={styles.slider}
                >
                    {track ?? (
                        <>
                            <View style={styles.track} />
                            <Animated.View
                                style={[
                                    styles.track,
                                    styles.filled,
                                    filledStyle,
                                ]}
                            />
                        </>
                    )}
                    <Animated.View style={[styles.thumb, thumbStyle]} />
                </View>
            </GestureDetector>
            {endIcon != null && <View style={styles.endIcon}>{endIcon}</View>}
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    container: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    disabled: { opacity: 0.5 },
    // 40px tall for a comfortable touch target; the track is drawn in its middle.
    slider: { flex: 1, height: 40, justifyContent: 'center' },
    track: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: TRACK_HEIGHT,
        borderRadius: TRACK_HEIGHT / 2,
        backgroundColor: theme.colors.SLIDER_TRACK_BACKGROUND,
    },
    filled: {
        right: undefined,
        backgroundColor: theme.colors.REDESIGN_INPUT_CONTROL_SELECTED,
    },
    thumb: {
        position: 'absolute',
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        borderRadius: theme.radii.round,
        backgroundColor: theme.colors.REDESIGN_INPUT_CONTROL_SELECTED,
    },
    startIcon: { marginRight: theme.space.PX_8 },
    endIcon: { marginLeft: theme.space.PX_8 },
}))
