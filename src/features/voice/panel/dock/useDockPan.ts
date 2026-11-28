import {
    GestureStateManager,
    usePanGesture,
} from 'react-native-gesture-handler'
import { useSharedValue, withSpring } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useUnistyles } from 'react-native-unistyles'
import { scheduleOnRN } from 'react-native-worklets'
import {
    DOCK_MODE_SPRING,
    MODAL_SPRING,
} from '../../../../design/tokens/motion'
import {
    DOCK_COLLAPSED_FRICTION,
    DOCK_DRAG_SLOP,
    DOCK_TRANSITION_DISTANCE,
    DOCK_TRANSITION_VELOCITY,
} from './dockConstants'
import { frameOf } from './useDockMotion'
import { centrePipAt, snapPip } from './usePipPan'
import type {
    GestureTouchEvent,
    PanGestureEvent,
} from 'react-native-gesture-handler'
import type { SharedValue } from 'react-native-reanimated'
import type { DockMotion } from './useDockMotion'

/** How far a finger moves over a list before a drag is told apart from a scroll or a tap (SheetDrag's). */
const DECIDE_SLOP = 4
/** Over fixed chrome: the drag starts past the slop either way, and a sideways move fails it. */
const SLOP_RANGE: [number, number] = [-DOCK_DRAG_SLOP, DOCK_DRAG_SLOP]
/** How far (px) above the bottom inset a PIP under the finger must be dragged to turn back into the dock. */
const PIP_SWITCH_HYSTERESIS = 24

export interface DockPanOptions {
    /**
     * Called when the docked card minimizes to the PIP: on a fast downward swipe, or once a drag brings its bottom
     * edge to the screen's bottom inset.
     */
    onMinimize?: () => void
    /** Called when the same drag brings the PIP back above the bottom inset: it undoes `onMinimize`. */
    onRestore?: () => void
    /**
     * Set around a scrolling list: whether it is at its top. The pan then drags only when the list is at its top
     * and the finger moves down, like `SheetDrag`. Otherwise the list scrolls.
     */
    scrollAtTop?: SharedValue<boolean>
}

/**
 * Returns the drag's hand-off to the PIP. `start` turns the card into the PIP centred under the finger, `follow`
 * moves it with the finger, `stop` turns it back into the docked card, and `drop` lets it go to a corner (usePipPan's
 * snap) while the dock rests docked.
 */
function usePipHandOff(motion: DockMotion) {
    const { theme } = useUnistyles()
    const radius = theme.radii.lg
    const active = useSharedValue(false)
    const start = useSharedValue({ x: 0, y: 0 })
    return {
        active,
        start: (event: PanGestureEvent) => {
            'worklet'
            active.set(true)
            centrePipAt(motion, event.absoluteX, event.absoluteY)
            start.set({
                x: event.absoluteX - motion.pipDragX.get(),
                y: event.absoluteY - motion.pipDragY.get(),
            })
            // At once, ahead of the dock mode's own spring to the PIP.
            motion.pip.set(withSpring(1, MODAL_SPRING))
        },
        follow: (event: PanGestureEvent) => {
            'worklet'
            motion.pipDragX.set(event.absoluteX - start.get().x)
            motion.pipDragY.set(event.absoluteY - start.get().y)
        },
        stop: () => {
            'worklet'
            active.set(false)
            motion.pip.set(withSpring(0, MODAL_SPRING))
        },
        drop: (velocityX: number, velocityY: number) => {
            'worklet'
            active.set(false)
            snapPip(motion, radius, velocityX, velocityY)
            motion.settle(0)
        },
    }
}

/**
 * Returns the pan that moves the dock, QuestDock's (QuestDockGestureDetector). Below the transition height the
 * docked card only shifts, with friction that grows as it goes. Past it the card becomes the panel and its top
 * follows the finger. On release a fast upward fling or a drag left in the panel opens it. A fast downward swipe of
 * the docked card minimizes it. Anything else docks it. With `onMinimize`, a docked card dragged down until its
 * bottom edge meets the screen's bottom inset turns into the PIP under the finger. Dragged back above the inset in
 * the same drag, it turns back into the docked card (`onRestore`).
 */
export function useDockPan(
    motion: DockMotion,
    { onMinimize, onRestore, scrollAtTop }: DockPanOptions = {},
) {
    const { geometry, height, width, offset, resting, settle } = motion
    const { setMounted } = motion
    const insets = useSafeAreaInsets()
    const start = useSharedValue({ y: 0, top: 0 })
    const drawer = useSharedValue(false)
    const driving = useSharedValue(false)
    const decide = useDecideOverList(motion, scrollAtTop)
    const pip = usePipHandOff(motion)
    // QuestDock's friction below the transition height: the docked card's offset for a pull to `next`.
    const shiftedOffset = (next: number) => {
        'worklet'
        const frame = frameOf(geometry, false)
        const friction =
            1 - next / DOCK_TRANSITION_DISTANCE / DOCK_COLLAPSED_FRICTION
        return frame.offset - (next - frame.height) * friction
    }
    // Listed one by one: the worklets plugin rejects a spread in a gesture config.
    return usePanGesture({
        activeOffsetY: decide.activeOffsetY,
        failOffsetX: decide.failOffsetX,
        manualActivation: decide.manualActivation,
        onTouchesDown: decide.onTouchesDown,
        onTouchesMove: decide.onTouchesMove,
        onActivate: event => {
            'worklet'
            driving.set(true)
            const open = resting.get() === 1
            start.set({
                y: event.absoluteY,
                top: height.get() - offset.get(),
            })
            drawer.set(open)
            scheduleOnRN(setMounted, true)
        },
        onUpdate: event => {
            'worklet'
            const dockFrame = frameOf(geometry, false)
            const top = start.get().top - (event.absoluteY - start.get().y)
            const next = top + dockFrame.offset
            if (pip.active.get()) {
                const back =
                    shiftedOffset(next) < -insets.bottom - PIP_SWITCH_HYSTERESIS
                if (!back) {
                    pip.follow(event)
                    return
                }
                pip.stop()
                if (onRestore !== undefined) scheduleOnRN(onRestore)
            }
            if (next >= DOCK_TRANSITION_DISTANCE) {
                drawer.set(true)
                const openFrame = frameOf(geometry, true)
                height.set(
                    withSpring(
                        Math.min(top + openFrame.offset, openFrame.height),
                        DOCK_MODE_SPRING,
                    ),
                )
                width.set(withSpring(openFrame.width, DOCK_MODE_SPRING))
                offset.set(withSpring(openFrame.offset, DOCK_MODE_SPRING))
                return
            }
            drawer.set(false)
            const shifted = shiftedOffset(next)
            // The docked card's bottom edge has met the screen's bottom inset: it becomes the PIP.
            const meetsInset = resting.get() === 0 && shifted >= -insets.bottom
            if (onMinimize !== undefined && meetsInset) {
                pip.start(event)
                scheduleOnRN(onMinimize)
                return
            }
            height.set(withSpring(dockFrame.height, DOCK_MODE_SPRING))
            width.set(withSpring(dockFrame.width, DOCK_MODE_SPRING))
            offset.set(withSpring(shifted, DOCK_MODE_SPRING))
        },
        onDeactivate: event => {
            'worklet'
            driving.set(false)
            if (pip.active.get()) {
                pip.drop(event.velocityX, event.velocityY)
                return
            }
            const velocity = event.velocityY
            const fast = Math.abs(velocity) > DOCK_TRANSITION_VELOCITY
            const minimizes =
                onMinimize !== undefined &&
                fast &&
                velocity > 0 &&
                resting.get() === 0 &&
                !drawer.get()
            const opens = (fast && velocity < 0) || (!fast && drawer.get())
            settle(opens ? 1 : 0, velocity)
            if (minimizes) scheduleOnRN(onMinimize)
        },
        // A drag that was cancelled halfway settles where it rested.
        onFinalize: () => {
            'worklet'
            if (!driving.get()) return
            driving.set(false)
            if (pip.active.get()) pip.drop(0, 0)
            else settle(resting.get() === 1 ? 1 : 0)
        },
    })
}

/** How the pan starts: past a slop, or decided by hand from the touches. */
export interface PanActivation {
    activeOffsetY?: [number, number]
    failOffsetX?: [number, number]
    manualActivation?: boolean
    onTouchesDown?: (event: GestureTouchEvent) => void
    onTouchesMove?: (event: GestureTouchEvent) => void
}

/**
 * Returns the pan's activation options. Over fixed chrome it starts past the slop. Over a list it decides by hand
 * as `SheetDrag` does: down from the list's top, or any vertical drag while the panel is not fully open. Without a
 * `motion` (a card that cannot grow) only the drag down counts.
 */
export function useDecideOverList(
    motion: DockMotion | undefined,
    scrollAtTop: SharedValue<boolean> | undefined,
): PanActivation {
    const startX = useSharedValue(0)
    const startY = useSharedValue(0)
    const decided = useSharedValue(true)
    if (scrollAtTop === undefined)
        return { activeOffsetY: SLOP_RANGE, failOffsetX: SLOP_RANGE }
    const height = motion?.height
    const fullHeight = motion?.geometry.height ?? 0
    return {
        manualActivation: true,
        onTouchesDown: (event: GestureTouchEvent) => {
            'worklet'
            const touch = event.allTouches[0]
            if (!touch) return
            startX.set(touch.absoluteX)
            startY.set(touch.absoluteY)
            decided.set(false)
        },
        onTouchesMove: (event: GestureTouchEvent) => {
            'worklet'
            if (decided.get()) return
            const touch = event.allTouches[0]
            if (!touch) return
            const dx = touch.absoluteX - startX.get()
            const dy = touch.absoluteY - startY.get()
            if (Math.abs(dx) < DECIDE_SLOP && Math.abs(dy) < DECIDE_SLOP) return
            decided.set(true)
            const drag =
                Math.abs(dy) > Math.abs(dx) &&
                scrollAtTop.get() &&
                (dy > 0 ||
                    (height !== undefined && height.get() < fullHeight - 1))
            if (drag) GestureStateManager.activate(event.handlerTag)
            else GestureStateManager.fail(event.handlerTag)
        },
    }
}
