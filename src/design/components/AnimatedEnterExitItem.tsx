import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import type { ComponentProps, ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'

type Entering = ComponentProps<typeof Animated.View>['entering']
type Exiting = ComponentProps<typeof Animated.View>['exiting']

export interface AnimatedEnterExitItemProps {
    children?: ReactNode
    /** Animation on mount; defaults to a fade in. Pass `null` to skip. */
    entering?: Entering | null
    /** Animation on unmount; defaults to a fade out. Pass `null` to skip. */
    exiting?: Exiting | null
    style?: StyleProp<ViewStyle>
}

/**
 * Wraps a list item so it animates in on mount and out on unmount. The reference tracks transition
 * states in a store and calls cleanUp after the exit; Reanimated's layout animations do that natively.
 */
export function AnimatedEnterExitItem({
    children,
    entering = FadeIn,
    exiting = FadeOut,
    style,
}: AnimatedEnterExitItemProps) {
    return (
        <Animated.View
            entering={entering ?? undefined}
            exiting={exiting ?? undefined}
            style={style}
        >
            {children}
        </Animated.View>
    )
}
