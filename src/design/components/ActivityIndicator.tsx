import { ActivityIndicator as NativeActivityIndicator } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import type { ActivityIndicatorProps } from 'react-native'
import type { SemanticColor } from '../tokens'

export interface SpinnerProps extends Omit<ActivityIndicatorProps, 'color'> {
    /** Semantic colour; defaults to the brand colour like the reference. */
    color?: SemanticColor
}

/** The platform spinner tinted with BACKGROUND_BRAND, large by default (ActivityIndicator). */
export function ActivityIndicator({
    size = 'large',
    animating = true,
    color = 'BACKGROUND_BRAND',
    ...props
}: SpinnerProps) {
    const { theme } = useUnistyles()
    return (
        <NativeActivityIndicator
            {...props}
            size={size}
            animating={animating}
            color={theme.colors[color]}
        />
    )
}
