import { View } from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated, {
    interpolate,
    useAnimatedStyle,
    useSharedValue,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { useSessionStore } from '../../../core/react'
import { NAV_BAR_HEIGHT } from '../../../design/components/layout/navBarHeight'
import { rtcStore } from '../rtc'
import { cardFrame, openness } from './dock/dockFrame'
import { useDockPan } from './dock/useDockPan'
import { FocusedVideo } from './grid/FocusedVideo'
import { ParticipantGrid } from './grid/ParticipantGrid'
import { usePanelFocus } from './grid/usePanelFocus'
import { PanelHeader } from './PanelHeader'
import { useCollapseOnBack } from './useCollapseOnBack'
import type { DockMotion } from './dock/useDockMotion'

/** How close to its top (px) the grid counts as at its top. */
const AT_TOP_SLOP = 1
/** Share of `height` the grid travels up while expanding, slower than the card's top edge. */
const GRID_PARALLAX_SHARE = 0.25
/** Scale the grid grows from as the panel opens. */
const GRID_COLLAPSED_SCALE = 0.92
/** Extra downward offset (px) on the header when collapsed, settling up under the handle bar. */
const HEADER_PARALLAX_OFFSET = 16
/** Openness range over which the grid fades in. */
const GRID_FADE_RANGE: [number, number] = [0, 0.5]
/** Openness range over which the header fades in, after clearing the controls. */
const HEADER_FADE_RANGE: [number, number] = [0.15, 0.5]

/**
 * Returns parallax styles for the header and grid as the dock expands: the header tracks the card's rising top edge,
 * while the grid glides up more slowly behind it.
 */
function usePanelParallax(motion: DockMotion, height: number) {
    const insets = useSafeAreaInsets()
    const { theme } = useUnistyles()
    const radius = theme.radii.lg
    const header = useAnimatedStyle(() => {
        const progress = openness(motion)
        const { top, y } = cardFrame(motion, radius)
        // DockBody's top edge in screen coordinates, matching useAboveNavigationBar.
        const bodyTop = Math.min(0, y + insets.bottom)
        const underHandle = Math.max(0, top - bodyTop - insets.top)
        const lag = interpolate(
            progress,
            [0, 1],
            [HEADER_PARALLAX_OFFSET, 0],
            'clamp',
        )
        return {
            opacity: interpolate(progress, HEADER_FADE_RANGE, [0, 1], 'clamp'),
            transform: [{ translateY: underHandle + lag }],
        }
    })
    const grid = useAnimatedStyle(() => {
        const progress = openness(motion)
        const travel = height * GRID_PARALLAX_SHARE
        return {
            opacity: interpolate(progress, GRID_FADE_RANGE, [0, 1], 'clamp'),
            transform: [
                {
                    translateY: interpolate(
                        progress,
                        [0, 1],
                        [travel, 0],
                        'clamp',
                    ),
                },
                {
                    scale: interpolate(
                        progress,
                        [0, 1],
                        [GRID_COLLAPSED_SCALE, 1],
                        'clamp',
                    ),
                },
            ],
        }
    })
    return { header, grid }
}

/**
 * The expanded panel above its controls (VoicePanelUI): the header, then the participant grid in what is left of
 * `height`, the room between the screen's top and the controls. A drag down from the grid's top closes the panel.
 */
export function PanelBody({
    motion,
    width,
    height,
}: {
    motion: DockMotion
    width: number
    height: number
}) {
    const insets = useSafeAreaInsets()
    const { theme } = useUnistyles()
    const channelId = useSessionStore(rtcStore, state => state.channelId)
    const guildId = useSessionStore(rtcStore, state => state.guildId)
    // VoicePanelCardConstants EDGE_GUTTER.
    const gutter = theme.space.PX_12
    const gridWidth = width - 2 * gutter
    const gridHeight = height - insets.top - NAV_BAR_HEIGHT - gutter
    const atTop = useSharedValue(true)
    const pan = useDockPan(motion, { scrollAtTop: atTop })
    const parallax = usePanelParallax(motion, height)
    const focus = usePanelFocus({
        x: gutter,
        y: 0,
        width: gridWidth,
        height: gridHeight,
    })
    useCollapseOnBack(focus.target !== null, focus.close)
    return (
        <View style={styles.body}>
            <Animated.View style={[styles.header, parallax.header]}>
                <PanelHeader motion={motion} />
            </Animated.View>
            {channelId && (
                <GestureDetector gesture={pan}>
                    <Animated.View style={[styles.grid, parallax.grid]}>
                        <ParticipantGrid
                            guildId={guildId}
                            channelId={channelId}
                            width={gridWidth}
                            height={gridHeight}
                            focus={focus}
                            onScroll={event => {
                                const y = event.nativeEvent.contentOffset.y
                                focus.scrollY.set(y)
                                atTop.set(y <= AT_TOP_SLOP)
                            }}
                        />
                        <FocusedVideo focus={focus} guildId={guildId} />
                    </Animated.View>
                </GestureDetector>
            )}
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    body: { flex: 1 },
    // Above the grid during parallax overlap so cards crossing under it do not show through.
    header: {
        zIndex: 1,
        backgroundColor: theme.colors.MOBILE_VOICE_PANEL_BACKGROUND,
    },
    grid: { flex: 1 },
}))
