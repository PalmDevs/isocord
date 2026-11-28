import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import { useAnimatedOverlayInset } from './overlayInsets'

/**
 * Draws an empty view as tall as the overlays over the page's bottom, such as the voice dock. Pages put it at the end
 * of their scrolling content. Its height springs, so the space opens and closes with the dock.
 */
export function OverlaySpacer() {
    const inset = useAnimatedOverlayInset()
    const style = useAnimatedStyle(() => ({ height: inset.get() }))
    return <Animated.View style={style} />
}

/** Returns a style that lifts a view anchored to the page's bottom above the overlays, following them as they move. */
export function useAboveOverlaysStyle() {
    const inset = useAnimatedOverlayInset()
    return useAnimatedStyle(() => ({
        transform: [{ translateY: -inset.get() }],
    }))
}
