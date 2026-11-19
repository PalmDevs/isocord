import { useEffect } from 'react'
import { Pressable, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { Bubble } from '../Bubble'
import { Text } from '../Text'
import { useAnchor } from './popoverHooks'
import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import type { BubblePosition } from '../Bubble'

export interface TooltipProps {
    label: string
    /** Which side of the target the tooltip sits on. */
    position?: BubblePosition
    /** Controls visibility from outside. Leave out to let a long press on the target show it. */
    visible?: boolean
    onVisibleChange?: (visible: boolean) => void
    /** The element the tooltip points at. */
    children: ReactNode
    /** Style of the wrapper around the target. */
    style?: StyleProp<ViewStyle>
}

/**
 * Small brand-coloured label pointing at its target. Long-pressing the target shows it; tapping
 * anywhere dismisses it. Use `visible` to show it programmatically instead.
 */
export function Tooltip({
    label,
    position = 'top',
    visible,
    onVisibleChange,
    children,
    style,
}: TooltipProps) {
    const { ref, anchor, open, clear } = useAnchor()
    const controlled = visible !== undefined

    useEffect(() => {
        if (visible === undefined) return
        if (visible) open()
        else clear()
    }, [visible, open, clear])

    const dismiss = () => {
        clear()
        onVisibleChange?.(false)
    }

    return (
        <>
            <Pressable
                ref={ref}
                collapsable={false}
                disabled={controlled}
                onLongPress={() => open(() => onVisibleChange?.(true))}
                style={style}
            >
                {children}
            </Pressable>
            {anchor && (
                <Bubble
                    anchor={anchor}
                    position={position}
                    arrowColor="BACKGROUND_BRAND"
                    onDismiss={dismiss}
                >
                    <View accessibilityRole="alert" style={styles.body}>
                        <Text
                            variant="text-xs/bold"
                            color="TEXT_OVERLAY_LIGHT"
                            style={styles.text}
                        >
                            {label}
                        </Text>
                    </View>
                </Bubble>
            )}
        </>
    )
}

const styles = StyleSheet.create(theme => ({
    body: {
        maxWidth: 150,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.space.PX_8,
        paddingVertical: theme.space.PX_4,
        borderRadius: theme.radii.sm,
        backgroundColor: theme.colors.BACKGROUND_BRAND,
    },
    text: { textAlign: 'center' },
}))
