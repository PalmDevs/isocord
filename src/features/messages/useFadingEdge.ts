import { ScrollView } from 'react-native'
import Animated, {
    clamp,
    useAnimatedProps,
    useAnimatedReaction,
    useAnimatedScrollHandler,
    useSharedValue,
} from 'react-native-reanimated'
import type { LayoutChangeEvent } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'

/**
 * FlashList's `renderScrollComponent` for `useFadingEdge`. FlashList calls it with the scroll view's props and ref,
 * so Reanimated's props reach the scroll view rather than FlashList's wrapper View.
 */
export const FadingEdgeScrollView = Animated.createAnimatedComponent(ScrollView)

/** Sets a shared value only when it changes, so a scroll in the middle commits no props. */
function setChanged(value: SharedValue<number>, next: number) {
    'worklet'
    if (value.get() !== next) value.set(next)
}

/**
 * Returns scroll view props and animated props that fade each edge by how far the list runs past it, up to
 * `length` dp. Our addition: the reference's lists have no fading edge.
 */
export function useFadingEdge(length: number) {
    const start = useSharedValue(0)
    const end = useSharedValue(0)
    const offset = useSharedValue(0)
    const content = useSharedValue(0)
    const viewport = useSharedValue(0)
    // Follows rows coming and going and the list resizing too, not only scrolls.
    useAnimatedReaction(
        () => [offset.get(), content.get() - viewport.get() - offset.get()],
        ([above = 0, below = 0]) => {
            setChanged(start, Math.round(clamp(above, 0, length)))
            setChanged(end, Math.round(clamp(below, 0, length)))
        },
    )
    const onScroll = useAnimatedScrollHandler(({ contentOffset }) => {
        offset.set(contentOffset.y)
    })
    // ReactScrollViewManager reads whole dp.
    const animatedProps = useAnimatedProps(() => ({
        fadingEdgeLength: { start: start.get(), end: end.get() },
    }))
    return {
        scrollProps: {
            onScroll,
            onContentSizeChange: (_width: number, height: number) =>
                content.set(height),
            onLayout: (event: LayoutChangeEvent) =>
                viewport.set(event.nativeEvent.layout.height),
        },
        animatedProps,
    }
}
