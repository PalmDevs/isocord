import { useEffect, useState } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import { useDerivedValue, withSpring } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { useSession } from '../../../../core/react'
import { NAV_BAR_HEIGHT } from '../../../../design/components/layout/navBarHeight'
import {
    useBottomBarCovered,
    useReportOverlayInset,
    useTabBarHeight,
} from '../../../../design/components/layout/overlayInsets'
import { MODAL_SPRING } from '../../../../design/tokens/motion'
import { t } from '../../../../i18n'
import { PreJoinLayer } from '../../prejoin/PreJoinLayer'
import { dismissPreJoin } from '../../prejoin/preJoinStore'
import { useAutoDismissPreJoin } from '../../prejoin/useAutoDismissPreJoin'
import { usePanelRequest } from '../panelRequest'
import { useCollapseOnBack } from '../useCollapseOnBack'
import { useEndedStreamWatch } from '../useEndedStreamWatch'
import { useLocalVolumes } from '../useLocalVolumes'
import { DockCard, MorphLayer } from './DockCard'
import {
    CardHandleBar,
    DockBody,
    DockControls,
    DockHandle,
} from './DockContent'
import {
    DOCK_GUTTER,
    DOCK_HANDLE_AREA,
    PIP_CHANNEL_INPUT_HEIGHT,
    PIP_MAX_WIDTH_RATIO,
    PIP_PADDING,
    PIP_WINDOW_OFFSET,
} from './dockConstants'
import { useCardPresence } from './useCardPresence'
import { useDockMode } from './useDockMode'
import { useDockMotion } from './useDockMotion'
import { usePipPan } from './usePipPan'
import { usePreJoinMorph } from './usePreJoinMorph'
import { VoicePip } from './VoicePip'
import type { DockMode } from './useDockMode'
import type { DockMotion } from './useDockMotion'

/** The key of a card's entry in the overlay insets, before its channel's id. */
const OVERLAY_KEY = 'voice'

/** Returns `value`, or the last value it had before `hold` turned true. */
function useHeldWhile<T>(value: T, hold: boolean): T {
    const [held, setHeld] = useState(value)
    if (!hold && held !== value) setHeld(value)
    return hold ? held : value
}

/**
 * Returns where the PIP may go: below the navigation header, and above the tab bar or the screen's bottom. Over a
 * chat it keeps clear of the composer (getPIPBottomOffsetForPIPMode).
 */
function usePipBounds() {
    const insets = useSafeAreaInsets()
    const { height } = useWindowDimensions()
    const { theme } = useUnistyles()
    const barHeight = useTabBarHeight()
    const covered = useBottomBarCovered()
    const screenBottom = Math.max(insets.bottom, PIP_WINDOW_OFFSET)
    const bottomOffset = covered
        ? screenBottom + PIP_CHANNEL_INPUT_HEIGHT + PIP_WINDOW_OFFSET
        : barHeight > 0
          ? barHeight + PIP_WINDOW_OFFSET
          : screenBottom
    return {
        pipTop: insets.top + NAV_BAR_HEIGHT + DOCK_GUTTER,
        pipBottom: height - bottomOffset,
        pipSide: Math.max(insets.left, insets.right, PIP_WINDOW_OFFSET),
        // Concentric with the buttons inside it.
        pipRadius:
            theme.modules.button.BORDER_RADIUS + theme.space[PIP_PADDING],
    }
}

/** Returns the card's frame and mode, from the tab bar it docks on and the measured controls. */
function useCardMotion(behindPreJoin: boolean, preJoin: boolean) {
    const insets = useSafeAreaInsets()
    const { width, height } = useWindowDimensions()
    const barHeight = useTabBarHeight()
    const covered = useBottomBarCovered()
    const noBar = barHeight === 0 || covered
    const mode = useDockMode(noBar || behindPreJoin)
    const [controlsHeight, setControlsHeight] = useState(0)
    const collapsedHeight = DOCK_HANDLE_AREA + controlsHeight
    const docksOnBar = barHeight > 0 && !covered
    // On the tab bar, or the screen's bottom before any bar showed. Held while minimized, so the card turns back
    // into the dock where it left.
    const restBottom = useHeldWhile(
        (docksOnBar ? barHeight : insets.bottom) + DOCK_GUTTER,
        mode.minimized,
    )
    const geometry = {
        width,
        height,
        collapsedHeight,
        restBottom,
        ...usePipBounds(),
    }
    const motion = useDockMotion(geometry, preJoin)
    return { motion, mode, noBar, onControlsHeight: setControlsHeight }
}

/**
 * Returns the bottom space the card takes from the pages: the pre-join's height, or the docked card's. A chat only
 * covers the pages for a while: their space stays until the user minimizes the dock. A pre-join takes the space from
 * the call behind it. Released as an exit starts, so the pages follow the card out.
 */
function useCardInset(
    channelId: string,
    size: number,
    { closing, hidden }: { closing: boolean; hidden: boolean },
) {
    const barHeight = useTabBarHeight()
    useReportOverlayInset(
        `${OVERLAY_KEY}:${channelId}`,
        barHeight > 0 && !closing && !hidden ? size + 2 * DOCK_GUTTER : 0,
    )
}

export interface VoiceDockProps {
    channelId: string
    /** Set while the card shows the channel's pre-join instead of the call: the channel's server. */
    preJoinGuildId?: string | null
    /** Another channel's pre-join shows: the call waits as the PIP. */
    behindPreJoin?: boolean
    /** The card leaves like an alert: the pre-join was dismissed, or the call ended. */
    closing?: boolean
    onExited?: () => void
}

/**
 * The voice card above the tab bar, QuestDock style. It shows a channel's pre-join until we join, then shrinks into
 * the call's dock in place (PreJoinTransitioner). The dock has a handle and the controls. A drag or a tap on the
 * handle or status grows it into the full-screen panel. Its children keep fixed sizes and hang from its edges, so a
 * growing card never relayouts them. Without a tab bar to dock on (a chat, a pushed screen), after a fast swipe
 * down, or `behindPreJoin`, the card turns into the PIP. The PIP can be dragged to any corner.
 */
export function VoiceDock({
    channelId,
    preJoinGuildId = null,
    behindPreJoin = false,
    closing = false,
    onExited,
}: VoiceDockProps) {
    const session = useSession()
    const preJoin = preJoinGuildId !== null
    const { motion, mode, noBar, onControlsHeight } = useCardMotion(
        behindPreJoin,
        preJoin,
    )
    const presence = useCardPresence(closing, onExited)
    const morph = usePreJoinMorph(motion, preJoinGuildId)
    // The panel stays open over a chat. It minimizes once collapsed. A pre-join leaves instead. Held while closing,
    // so an ended call leaves the PIP as the PIP.
    const pipShown = useHeldWhile(
        mode.minimized && !motion.open && !preJoin,
        closing,
    )
    const dismiss = () => dismissPreJoin(session)
    useCardInset(
        channelId,
        preJoin ? morph.height : motion.geometry.collapsedHeight,
        { closing, hidden: !preJoin && (mode.userMinimized || behindPreJoin) },
    )
    useCollapseOnBack(
        preJoin ? !closing : motion.open,
        preJoin ? dismiss : motion.collapse,
    )
    useAutoDismissPreJoin(preJoin && !closing ? preJoinGuildId : null, noBar)
    useLocalVolumes()
    useEndedStreamWatch()
    // Expanding the call overlay opens the panel here, as a tap on the PIP does.
    usePanelRequest(!preJoin && !closing, () => {
        if (!noBar) mode.restore()
        motion.expand()
    })
    const { pip, pipDragX, pipDragY } = motion
    useEffect(() => {
        pip.set(
            withSpring(pipShown ? 1 : 0, MODAL_SPRING, finished => {
                'worklet'
                if (!finished || pipShown) return
                // A drag that turned the PIP back into the dock left it off its corner.
                pipDragX.set(0)
                pipDragY.set(0)
            }),
        )
    }, [pip, pipDragX, pipDragY, pipShown])
    const preJoinHidden = useDerivedValue(() => 1 - motion.preJoin.get())
    return (
        <DockCard motion={motion} presence={presence} closing={closing}>
            <CallLayers
                motion={motion}
                mode={mode}
                channelId={channelId}
                state={preJoin ? 'preJoin' : pipShown ? 'pip' : 'dock'}
                onControlsHeight={onControlsHeight}
                onPipPress={
                    behindPreJoin
                        ? dismiss
                        : () => {
                              // Tapping the PIP on the tabs clears a manual minimize, so collapsing returns to the dock.
                              if (!noBar) mode.restore()
                              motion.expand()
                          }
                }
            />
            {morph.guildId !== null && (
                <MorphLayer
                    hidden={preJoinHidden}
                    shown={preJoin}
                    style={styles.preJoinLayer(motion.geometry.width)}
                >
                    <PreJoinLayer
                        guildId={morph.guildId}
                        channelId={channelId}
                        geometry={motion.geometry}
                        presence={presence}
                        height={morph.height}
                        onHeight={morph.onHeight}
                        onDismiss={dismiss}
                    />
                </MorphLayer>
            )}
            <CardHandleBar motion={motion} />
        </DockCard>
    )
}

/**
 * The call's contents: the dock with its panel, and the PIP. They cross-fade as the card turns into the PIP. While
 * the card shows a pre-join they wait hidden, measured, so joining knows the docked card's height.
 */
function CallLayers({
    motion,
    mode,
    channelId,
    state,
    onControlsHeight,
    onPipPress,
}: {
    motion: DockMotion
    mode: DockMode
    channelId: string
    state: 'preJoin' | 'dock' | 'pip'
    onControlsHeight: (height: number) => void
    onPipPress: () => void
}) {
    const pipPan = usePipPan(motion, state === 'pip')
    const dockHidden = useDerivedValue(() =>
        Math.max(motion.pip.get(), motion.preJoin.get()),
    )
    const pipHidden = useDerivedValue(() => 1 - motion.pip.get())
    const toggle = motion.open ? motion.collapse : motion.expand
    const label = motion.open ? t('voice.minimize') : t('voice.expand')
    return (
        <>
            <MorphLayer
                hidden={dockHidden}
                shown={state === 'dock'}
                style={styles.dockLayer}
            >
                {motion.mounted && (
                    <DockBody
                        motion={motion}
                        controlsHeight={
                            motion.geometry.collapsedHeight - DOCK_HANDLE_AREA
                        }
                    />
                )}
                <DockControls
                    motion={motion}
                    onHeight={onControlsHeight}
                    channelId={channelId}
                    label={label}
                    onToggle={toggle}
                    onMinimize={mode.minimize}
                    onRestore={mode.restore}
                />
                <DockHandle
                    motion={motion}
                    label={label}
                    onToggle={toggle}
                    onMinimize={mode.minimize}
                    onRestore={mode.restore}
                />
            </MorphLayer>
            {/* Centred in the card: the PIP's contents enter exactly as the dock's leave. */}
            <MorphLayer
                hidden={pipHidden}
                shown={state === 'pip'}
                pointerEvents="box-none"
                style={styles.pipLayer(motion.geometry.width)}
            >
                <GestureDetector gesture={pipPan}>
                    <View collapsable={false}>
                        <VoicePip
                            channelId={channelId}
                            onPress={onPipPress}
                            onSize={size => motion.pipSize.set(size)}
                        />
                    </View>
                </GestureDetector>
            </MorphLayer>
        </>
    )
}

const styles = StyleSheet.create({
    dockLayer: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
    },
    // As wide as the PIP may get, so the card's width never limits the measured contents.
    pipLayer: (screenWidth: number) => ({
        position: 'absolute',
        width: screenWidth * PIP_MAX_WIDTH_RATIO,
        alignItems: 'center',
    }),
    // On the card's bottom edge, where the dock's controls take over: a shrinking card clips its top.
    preJoinLayer: (screenWidth: number) => ({
        position: 'absolute',
        bottom: 0,
        width: screenWidth - 2 * DOCK_GUTTER,
    }),
})
