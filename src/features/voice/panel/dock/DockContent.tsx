import { Pressable, View } from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated, {
    interpolate,
    useAnimatedStyle,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { MODAL_HIDDEN } from '../../../../design/tokens/motion'
import { openChannel } from '../../../chat/links/openChannel'
import { VoiceControls } from '../../controls/VoiceControls'
import { PanelBody } from '../PanelBody'
import { DOCK_GUTTER, DOCK_HANDLE_AREA } from './dockConstants'
import { cardFrame } from './dockFrame'
import { useDockPan } from './useDockPan'
import type { DockMotion } from './useDockMotion'

/**
 * Returns a style that keeps a view on the card's top edge until that edge reaches the status bar. It then stays
 * below the status bar.
 */
function useBelowStatusBar(motion: DockMotion) {
    const insets = useSafeAreaInsets()
    const { theme } = useUnistyles()
    const radius = theme.radii.lg
    return useAnimatedStyle(() => {
        const { top } = cardFrame(motion, radius)
        return { transform: [{ translateY: Math.max(0, insets.top - top) }] }
    })
}

/**
 * Returns a style that keeps a view on the card's bottom edge until that edge reaches the navigation bar. It then
 * stays above the navigation bar.
 */
function useAboveNavigationBar(motion: DockMotion) {
    const insets = useSafeAreaInsets()
    const { theme } = useUnistyles()
    const radius = theme.radii.lg
    return useAnimatedStyle(() => {
        const { y } = cardFrame(motion, radius)
        return {
            transform: [{ translateY: -Math.max(0, insets.bottom + y) }],
        }
    })
}

/**
 * The drag handle's bar on the card's top edge, shared by the pre-join and the dock: joining slides it down with the
 * edge. It fades with the dock's contents as the card turns into the PIP. Each state's own touch area lies under it.
 */
export function CardHandleBar({ motion }: { motion: DockMotion }) {
    const belowStatusBar = useBelowStatusBar(motion)
    const fade = useAnimatedStyle(() => ({
        opacity: interpolate(
            motion.pip.get(),
            [0, 1],
            [1, MODAL_HIDDEN.opacity],
        ),
    }))
    return (
        <Animated.View
            pointerEvents="none"
            style={[styles.handleSlot, belowStatusBar, fade]}
        >
            <View style={styles.handleArea}>
                <View style={styles.handle} />
            </View>
        </Animated.View>
    )
}

/** The drag handle's touch area on the card's top edge, under `CardHandleBar`. Tapping it opens or closes the panel. */
export function DockHandle({
    motion,
    label,
    onToggle,
    onMinimize,
    onRestore,
}: {
    motion: DockMotion
    label: string
    onToggle: () => void
    onMinimize: () => void
    onRestore: () => void
}) {
    const pan = useDockPan(motion, { onMinimize, onRestore })
    const handleStyle = useBelowStatusBar(motion)
    return (
        <GestureDetector gesture={pan}>
            <Animated.View style={[styles.handleSlot, handleStyle]}>
                {/* No ripple: the handle is the card's chrome. */}
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    onPress={onToggle}
                >
                    <View style={styles.handleArea} />
                </Pressable>
            </Animated.View>
        </GestureDetector>
    )
}

/** The panel above the controls, at its open size from the start: the card's top edge reveals it. */
export function DockBody({
    motion,
    controlsHeight,
}: {
    motion: DockMotion
    controlsHeight: number
}) {
    const insets = useSafeAreaInsets()
    const { width, height } = motion.geometry
    const bodyHeight = height - controlsHeight - insets.bottom
    const bodyStyle = useAboveNavigationBar(motion)
    return (
        <Animated.View
            pointerEvents={motion.open ? 'auto' : 'none'}
            style={[styles.body(width, bodyHeight, controlsHeight), bodyStyle]}
        >
            <PanelBody motion={motion} width={width} height={bodyHeight} />
        </Animated.View>
    )
}

/** The controls on the card's bottom edge. */
export function DockControls({
    motion,
    onHeight,
    channelId,
    label,
    onToggle,
    onMinimize,
    onRestore,
}: {
    motion: DockMotion
    onHeight: (height: number) => void
    channelId: string
    label: string
    onToggle: () => void
    onMinimize: () => void
    onRestore: () => void
}) {
    const pan = useDockPan(motion, { onMinimize, onRestore })
    const controlsStyle = useAboveNavigationBar(motion)
    return (
        <GestureDetector gesture={pan}>
            <Animated.View
                onLayout={event => onHeight(event.nativeEvent.layout.height)}
                style={[styles.controls(motion.geometry.width), controlsStyle]}
            >
                <VoiceControls
                    channelId={channelId}
                    infoLabel={label}
                    onInfoPress={onToggle}
                    onOpenChat={() => {
                        motion.collapse()
                        openChannel(channelId)
                    }}
                    onCollapse={motion.collapse}
                />
            </Animated.View>
        </GestureDetector>
    )
}

const styles = StyleSheet.create(theme => ({
    body: (width: number, height: number, bottom: number) => ({
        position: 'absolute',
        bottom,
        width,
        height,
        overflow: 'hidden',
    }),
    controls: (screenWidth: number) => ({
        position: 'absolute',
        bottom: 0,
        width: screenWidth - 2 * DOCK_GUTTER,
    }),
    handleSlot: { position: 'absolute', top: 0 },
    handleArea: {
        alignSelf: 'center',
        width: theme.space.PX_64,
        height: DOCK_HANDLE_AREA,
        alignItems: 'center',
        justifyContent: 'center',
    },
    handle: {
        width: theme.space.PX_32,
        height: theme.space.PX_4,
        borderRadius: theme.radii.round,
        backgroundColor: theme.colors.BORDER_STRONG,
    },
}))
