import { useRef } from 'react'
import {
    codegenNativeCommands,
    Pressable,
    processColor,
    View,
} from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import type { ElementRef, ReactNode } from 'react'
import type {
    CodegenTypes,
    GestureResponderEvent,
    PressableProps,
    StyleProp,
    ViewStyle,
} from 'react-native'

export interface RipplePressableProps
    extends Omit<PressableProps, 'style' | 'children'> {
    style?: StyleProp<ViewStyle>
    children?: ReactNode
    /** Icon-only targets: the ripple spreads past the view instead of being clipped to it. */
    borderless?: boolean
    radius?: number
}

const CLIPPED: ViewStyle = { overflow: 'hidden' }

type ViewRef = ElementRef<typeof View>

/** The commands of React Native's own view that Pressable's android_ripple sends (useAndroidRippleForView). */
const ViewCommands = codegenNativeCommands<{
    hotspotUpdate: (
        view: ViewRef,
        x: CodegenTypes.Int32,
        y: CodegenTypes.Int32,
    ) => void
    setPressed: (view: ViewRef, pressed: boolean) => void
}>({ supportedCommands: ['hotspotUpdate', 'setPressed'] })

/**
 * Returns a Pressable with the Android button ripple (MOBILE_ANDROID_BUTTON_BACKGROUND_RIPPLE).
 * A ripple on the pressable's own background ignores borderRadius.
 * The reference's PressableBase passes `cornerRadius`, which stock React Native lacks.
 * A child layer draws a bounded ripple instead, so the rounded `overflow: 'hidden'` clips it.
 * ReactViewGroup doesn't forward its pressed state, so the layer gets the same view commands as Pressable.
 */
export function RipplePressable({
    style,
    borderless,
    radius,
    children,
    onPressIn,
    onPressMove,
    onPressOut,
    ...props
}: RipplePressableProps) {
    const { theme } = useUnistyles()
    const color = theme.colors.MOBILE_ANDROID_BUTTON_BACKGROUND_RIPPLE
    const ripple = useRef<ViewRef>(null)

    if (borderless)
        return (
            <Pressable
                {...props}
                onPressIn={onPressIn}
                onPressMove={onPressMove}
                onPressOut={onPressOut}
                android_ripple={{ color, borderless, radius }}
                style={style}
            >
                {children}
            </Pressable>
        )

    const layer = () => ripple.current
    const hotspot = (view: ViewRef, event: GestureResponderEvent) =>
        ViewCommands.hotspotUpdate(
            view,
            event.nativeEvent.locationX ?? 0,
            event.nativeEvent.locationY ?? 0,
        )
    return (
        <Pressable
            {...props}
            onPressIn={event => {
                const view = layer()
                if (view) {
                    hotspot(view, event)
                    ViewCommands.setPressed(view, true)
                }
                onPressIn?.(event)
            }}
            onPressMove={event => {
                const view = layer()
                if (view) hotspot(view, event)
                onPressMove?.(event)
            }}
            onPressOut={event => {
                const view = layer()
                if (view) ViewCommands.setPressed(view, false)
                onPressOut?.(event)
            }}
            style={[style, CLIPPED]}
        >
            <View
                ref={ripple}
                // The commands below need this view to exist natively.
                collapsable={false}
                nativeBackgroundAndroid={{
                    type: 'RippleAndroid',
                    color: processColor(color) ?? undefined,
                    rippleRadius: radius,
                }}
                style={styles.ripple}
            />
            {children}
        </Pressable>
    )
}

const styles = StyleSheet.create({
    ripple: StyleSheet.absoluteFillObject,
})
