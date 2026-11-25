import {
    StyleSheet as NativeStyleSheet,
    useWindowDimensions,
    View,
} from 'react-native'
import { useUnistyles } from 'react-native-unistyles'

/**
 * ThemedGradient: the gradient theme's background behind a screen. Nothing on a base theme.
 * `overlays` draw see-through colours over it, top first, for a layer whose own background the gradient covers.
 * `offset` is the layer's position on screen, so its gradient lines up with the screen's (ScreenAlignedThemedGradient).
 * No hardware texture: each full-window layer held 10 MB of GPU memory and saved no frame time (2026-11-24).
 */
export function ThemedGradient({
    overlays = [],
    offset,
}: {
    overlays?: string[]
    offset?: { x: number; y: number }
}) {
    const { theme } = useUnistyles()
    const window = useWindowDimensions()
    if (!theme.background) return null
    const backgroundImage = [
        ...overlays.map(color => `linear-gradient(${color}, ${color})`),
        theme.background,
    ].join(', ')
    const frame = offset
        ? {
              position: 'absolute' as const,
              left: -offset.x,
              top: -offset.y,
              width: window.width,
              height: window.height,
          }
        : NativeStyleSheet.absoluteFill
    return <View pointerEvents="none" style={[frame, { backgroundImage }]} />
}
