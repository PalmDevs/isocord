import { interpolate } from 'react-native-reanimated'
import type { DockMotion, PipCorner } from './useDockMotion'

/** The card's frame on screen, in px. */
export interface CardFrame {
    /** Left edge's distance from the screen's left. */
    x: number
    /** Offset from the screen's bottom: 0 rests on it, negative is higher. */
    y: number
    width: number
    height: number
    /** Top edge's distance from the screen's top. */
    top: number
    topRadius: number
    bottomRadius: number
}

/** Returns how far open the card is, 0 docked to 1 full screen, from its animated height. */
export function openness(motion: DockMotion) {
    'worklet'
    const { collapsedHeight, height } = motion.geometry
    return interpolate(
        motion.height.get(),
        [collapsedHeight, height],
        [0, 1],
        'clamp',
    )
}

/** Returns where the PIP rests in `corner`: its left edge, and its bottom edge from the screen's top. */
export function pipRest(motion: DockMotion, corner: PipCorner) {
    'worklet'
    const { geometry } = motion
    const pip = motion.pipSize.get()
    return {
        x: corner.right
            ? geometry.width - geometry.pipSide - pip.width
            : geometry.pipSide,
        bottom: corner.bottom
            ? geometry.pipBottom
            : geometry.pipTop + pip.height,
    }
}

/**
 * Returns the card's frame: the dock's own frame, as tall as the pre-join contents by `motion.preJoin`, blended into
 * the PIP's by `motion.pip`. The pre-join card has the docked card's width and rest, so joining only shrinks it. The
 * PIP rests in one of the screen's corners, moved by its drag. `radius` is the docked card's corner.
 */
export function cardFrame(motion: DockMotion, radius: number): CardFrame {
    'worklet'
    const { geometry } = motion
    const progress = motion.pip.get()
    const pip = motion.pipSize.get()
    const rest = pipRest(motion, motion.pipCorner.get())
    const dockWidth = motion.width.get()
    const dockHeight = interpolate(
        motion.preJoin.get(),
        [0, 1],
        [motion.height.get(), motion.preJoinHeight.get()],
    )
    const width = interpolate(progress, [0, 1], [dockWidth, pip.width])
    const height = interpolate(progress, [0, 1], [dockHeight, pip.height])
    const y = interpolate(
        progress,
        [0, 1],
        [
            motion.offset.get(),
            rest.bottom + motion.pipDragY.get() - geometry.height,
        ],
    )
    // The bottom corners square off as the panel fills the screen.
    const bottomRadius = radius * (1 - openness(motion))
    return {
        x: interpolate(
            progress,
            [0, 1],
            [(geometry.width - dockWidth) / 2, rest.x + motion.pipDragX.get()],
        ),
        y,
        width,
        height,
        top: geometry.height + y - height,
        topRadius: interpolate(progress, [0, 1], [radius, geometry.pipRadius]),
        bottomRadius: interpolate(
            progress,
            [0, 1],
            [bottomRadius, geometry.pipRadius],
        ),
    }
}
