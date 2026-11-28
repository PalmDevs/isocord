import { usePanGesture } from 'react-native-gesture-handler'
import { useSharedValue, withSpring } from 'react-native-reanimated'
import { useUnistyles } from 'react-native-unistyles'
import { DOCK_MODE_SPRING } from '../../../../design/tokens/motion'
import { DOCK_DRAG_SLOP, MIN_PIP_TOSS_VELOCITY } from './dockConstants'
import { cardFrame, pipRest } from './dockFrame'
import type { DockMotion, PipCorner } from './useDockMotion'

/** The PIP starts moving past this slop either way, so its buttons keep their taps. */
const SLOP_RANGE: [number, number] = [-DOCK_DRAG_SLOP, DOCK_DRAG_SLOP]

const clamp = (value: number, min: number, max: number) => {
    'worklet'
    return Math.min(Math.max(value, min), max)
}

/**
 * VoicePanelPIPUtils.calculatePIPPositionFromVelocity, rounded to a corner. Slow, the PIP lands on its nearest edge.
 * Tossed, it lands where its path meets an edge. `x` and `y` are its centre within its range of centres.
 */
function landingCorner(
    x: number,
    y: number,
    xRange: number,
    yRange: number,
    velocityX: number,
    velocityY: number,
): PipCorner {
    'worklet'
    let pipX = 0
    let pipY = 0
    if (
        Math.max(Math.abs(velocityX), Math.abs(velocityY)) <
        MIN_PIP_TOSS_VELOCITY
    ) {
        const left = clamp(x, 0, xRange)
        const right = clamp(xRange - x, 0, xRange)
        const top = clamp(y, 0, yRange)
        const bottom = clamp(yRange - y, 0, yRange)
        const nearest = Math.min(left, right, top, bottom)
        if (left === nearest || right === nearest) {
            pipX = left === nearest ? 0 : 1
            pipY = y / yRange
        } else {
            pipY = top === nearest ? 0 : 1
            pipX = x / xRange
        }
    } else {
        const slope = velocityY / velocityX
        const edgeX = velocityX > 0 ? xRange : 0
        const crossY = y + slope * (edgeX - x)
        if (crossY >= 0 && crossY <= yRange) {
            pipX = edgeX / xRange
            pipY = crossY / yRange
        } else {
            const edgeY = velocityY > 0 ? yRange : 0
            pipX = (x + (edgeY - y) / slope) / xRange
            pipY = edgeY / yRange
        }
    }
    return { right: clamp(pipX, 0, 1) >= 0.5, bottom: clamp(pipY, 0, 1) >= 0.5 }
}

/**
 * Snaps the PIP to the corner it is let go towards. The new corner takes over the frame where it is, then the drag
 * springs away. `radius` is the docked card's corner.
 */
export function snapPip(
    motion: DockMotion,
    radius: number,
    velocityX: number,
    velocityY: number,
): void {
    'worklet'
    const { geometry, pipCorner, pipDragX, pipDragY } = motion
    const pip = motion.pipSize.get()
    const frame = cardFrame(motion, radius)
    const left = geometry.pipSide + pip.width / 2
    const top = geometry.pipTop + pip.height / 2
    const corner = landingCorner(
        frame.x + pip.width / 2 - left,
        frame.top + pip.height / 2 - top,
        geometry.width - 2 * left,
        geometry.pipBottom - pip.height / 2 - top,
        velocityX,
        velocityY,
    )
    const rest = pipRest(motion, corner)
    pipCorner.set(corner)
    pipDragX.set(frame.x - rest.x)
    pipDragY.set(frame.top + pip.height - rest.bottom)
    pipDragX.set(withSpring(0, DOCK_MODE_SPRING))
    pipDragY.set(withSpring(0, DOCK_MODE_SPRING))
}

/** Moves the PIP so its centre is at the screen point `x`, `y`: the dock's drag hands it to the finger. */
export function centrePipAt(motion: DockMotion, x: number, y: number): void {
    'worklet'
    const pip = motion.pipSize.get()
    const rest = pipRest(motion, motion.pipCorner.get())
    motion.pipDragX.set(x - pip.width / 2 - rest.x)
    motion.pipDragY.set(y + pip.height / 2 - rest.bottom)
}

/**
 * Returns the pan that moves the PIP (VoicePanelPIP usePIPGesture). It follows the finger, then snaps to the corner
 * it is let go towards. Discord's PIP rests anywhere along an edge. Ours rests in the corners only.
 */
export function usePipPan(motion: DockMotion, enabled: boolean) {
    const { theme } = useUnistyles()
    const radius = theme.radii.lg
    const { pipDragX, pipDragY } = motion
    const start = useSharedValue({ x: 0, y: 0 })
    const driving = useSharedValue(false)
    return usePanGesture({
        enabled,
        activeOffsetX: SLOP_RANGE,
        activeOffsetY: SLOP_RANGE,
        onActivate: event => {
            'worklet'
            driving.set(true)
            start.set({
                x: event.absoluteX - pipDragX.get(),
                y: event.absoluteY - pipDragY.get(),
            })
        },
        onUpdate: event => {
            'worklet'
            pipDragX.set(event.absoluteX - start.get().x)
            pipDragY.set(event.absoluteY - start.get().y)
        },
        onDeactivate: event => {
            'worklet'
            driving.set(false)
            snapPip(motion, radius, event.velocityX, event.velocityY)
        },
        // A drag that was cancelled halfway lands as if let go still.
        onFinalize: () => {
            'worklet'
            if (!driving.get()) return
            driving.set(false)
            snapPip(motion, radius, 0, 0)
        },
    })
}
