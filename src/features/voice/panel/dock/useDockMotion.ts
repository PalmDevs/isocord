import { useEffect, useState } from 'react'
import { useSharedValue, withSpring } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { DOCK_MODE_SPRING } from '../../../../design/tokens/motion'
import { DOCK_GUTTER } from './dockConstants'
import type { SharedValue } from 'react-native-reanimated'

/** The dock's frames, in screen pixels. */
export interface DockGeometry {
    /** The screen's width, the open panel's width. */
    width: number
    /** The screen's height, the open panel's height. */
    height: number
    /** The docked card's height: its handle and the controls. */
    collapsedHeight: number
    /** The docked card's distance from the screen's bottom. */
    restBottom: number
    /** The PIP's least distance from the screen's top. */
    pipTop: number
    /** The lowest the PIP's bottom edge goes, from the screen's top. */
    pipBottom: number
    /** The PIP's distance from the screen's sides. */
    pipSide: number
    /** The PIP's corner radius. */
    pipRadius: number
}

/** The screen corner the PIP rests in. */
export interface PipCorner {
    right: boolean
    bottom: boolean
}

/** The PIP's measured size. */
export interface PipSize {
    width: number
    height: number
}

export interface DockMotion {
    geometry: DockGeometry
    /** The card's frame, animated: height, width, and vertical offset from the screen's bottom. */
    height: SharedValue<number>
    width: SharedValue<number>
    offset: SharedValue<number>
    /** Where the dock rests: 0 docked, 1 open. */
    resting: SharedValue<number>
    /** How far the docked card has turned into the PIP, 0 to 1. */
    pip: SharedValue<number>
    /** How far the card shows a channel's pre-join instead of the call, 0 to 1. */
    preJoin: SharedValue<number>
    /** The pre-join contents' measured height: the card's height while `preJoin` is 1. */
    preJoinHeight: SharedValue<number>
    pipSize: SharedValue<PipSize>
    pipCorner: SharedValue<PipCorner>
    /** The PIP's distance from its corner, while dragged or snapping back. */
    pipDragX: SharedValue<number>
    pipDragY: SharedValue<number>
    /** The panel is open or opening, for back handling and accessibility. */
    open: boolean
    /** The panel's contents exist: from the start of an opening to the end of a closing. */
    mounted: boolean
    expand: () => void
    collapse: () => void
    settle: (to: 0 | 1, velocity?: number) => void
    setMounted: (mounted: boolean) => void
}

/** The card's frame for one mode. */
export function frameOf(geometry: DockGeometry, open: boolean) {
    'worklet'
    return open
        ? { height: geometry.height, width: geometry.width, offset: 0 }
        : {
              height: geometry.collapsedHeight,
              width: geometry.width - 2 * DOCK_GUTTER,
              offset: -geometry.restBottom,
          }
}

/**
 * QuestDock's frame: one card whose height, width and offset spring between the docked card and the full-screen
 * panel (QuestDock.tsx wrapper specs with QUEST_DOCK_MODE_CHANGE_PHYSICS). A drag writes the same values. A card
 * that mounts for a pre-join starts as it (`preJoin`).
 */
export function useDockMotion(
    geometry: DockGeometry,
    preJoin: boolean,
): DockMotion {
    const rest = frameOf(geometry, false)
    const height = useSharedValue(rest.height)
    const width = useSharedValue(rest.width)
    const offset = useSharedValue(rest.offset)
    const resting = useSharedValue(0)
    const pip = useSharedValue(0)
    const preJoinProgress = useSharedValue(preJoin ? 1 : 0)
    const preJoinHeight = useSharedValue(0)
    const pipSize = useSharedValue<PipSize>({ width: 0, height: 0 })
    // VoicePanelPIP's default position: the top right.
    const pipCorner = useSharedValue<PipCorner>({ right: true, bottom: false })
    const pipDragX = useSharedValue(0)
    const pipDragY = useSharedValue(0)
    const [open, setOpen] = useState(false)
    const [mounted, setMounted] = useState(false)
    const { collapsedHeight, restBottom, width: screenWidth } = geometry
    const screenHeight = geometry.height
    // The frames change with the measured controls and rotation: snap to the resting one.
    // biome-ignore lint/correctness/useExhaustiveDependencies: the frame's numbers are the dependencies.
    useEffect(() => {
        const frame = frameOf(geometry, resting.get() === 1)
        height.set(frame.height)
        width.set(frame.width)
        offset.set(frame.offset)
    }, [collapsedHeight, screenWidth, screenHeight])
    // A docked card moves to its new rest, such as onto the tab bar as a chat leaves.
    // biome-ignore lint/correctness/useExhaustiveDependencies: the rest is the dependency.
    useEffect(() => {
        if (resting.get() === 1) return
        offset.set(withSpring(-restBottom, DOCK_MODE_SPRING))
    }, [restBottom])
    const settle = (to: 0 | 1, velocity = 0) => {
        'worklet'
        const frame = frameOf(geometry, to === 1)
        resting.set(to)
        scheduleOnRN(setOpen, to === 1)
        if (to === 1) scheduleOnRN(setMounted, true)
        // A finger moving up grows the card.
        const spring = { ...DOCK_MODE_SPRING, velocity: -velocity }
        height.set(
            withSpring(frame.height, spring, finished => {
                'worklet'
                if (finished && to === 0) scheduleOnRN(setMounted, false)
            }),
        )
        width.set(withSpring(frame.width, DOCK_MODE_SPRING))
        offset.set(withSpring(frame.offset, DOCK_MODE_SPRING))
    }
    return {
        geometry,
        height,
        width,
        offset,
        resting,
        pip,
        preJoin: preJoinProgress,
        preJoinHeight,
        pipSize,
        pipCorner,
        pipDragX,
        pipDragY,
        open,
        mounted,
        expand: () => settle(1),
        collapse: () => settle(0),
        settle,
        setMounted,
    }
}
