import { usePanGesture } from 'react-native-gesture-handler'
import { useSharedValue } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import {
    PANEL_MIN_FLING_VELOCITY,
    PANEL_TOUCH_SLOP,
} from '../../../design/tokens/motion'
import { dismissComposers } from '../composer'
import { slideTo } from './slide'
import type { SharedValue } from 'react-native-reanimated'
import type { ChatPanelState } from './useChatPanel'
import type { DetailsPanel } from './useDetailsPanel'
import type { StackedChat } from './useStackedChat'
import type { ThreadCreation } from './useThreadCreation'

/**
 * How far from the left edge a rightward drag may start to close the channel details. The reference closes its
 * details screen with the back button; a drag from anywhere would fight the tabs' own horizontal swipes.
 */
const DETAILS_CLOSE_EDGE = 24

/** Whether a released drag leaves the panel open: by fling direction, else by which half it is in. */
function shouldShow(
    event: { velocityX: number; canceled?: boolean },
    x: number,
    width: number,
    whenCanceled: boolean,
) {
    'worklet'
    if (event.canceled) return whenCanceled
    if (Math.abs(event.velocityX) > PANEL_MIN_FLING_VELOCITY)
        return event.velocityX < 0
    return x < width / 2
}

/** Slides a released panel to its end and tells React whether it is shown. */
function settle(
    x: SharedValue<number>,
    width: number,
    show: boolean,
    setShown: (show: boolean) => void,
    closed: () => void,
) {
    'worklet'
    scheduleOnRN(setShown, show)
    slideTo(x, width, show, true, show ? undefined : closed)
}

/**
 * Moves the panels with horizontal drags. Vertical drags fail the gesture so lists keep scrolling.
 * With the chat open, only a rightward drag (closing it) activates.
 * A leftward one is the native list's swipe to reply, which activation would cancel.
 * With the swipe setting on "channel details", a leftward drag pulls the details in and rows no longer swipe.
 * Returns `dragging` too: a drag of any layer is in progress.
 */
export function usePanelDrag({
    width,
    enabled,
    detailsOnSwipe,
    dragging,
    chat,
    details,
    stack,
    create,
}: {
    width: number
    /** The tab is on screen and has a channel. */
    enabled: boolean
    detailsOnSwipe: boolean
    dragging: SharedValue<boolean>
    chat: ChatPanelState
    details: DetailsPanel
    stack: StackedChat
    create: ThreadCreation
}) {
    // Destructured: a worklet must capture these one by one, not the hook results that hold state.
    const {
        x: translateX,
        open,
        drawn,
        channelId,
        setShown: setOpen,
        waitingForRows,
        openFromSwipe,
    } = chat
    const { x: detailsX, setShown: setDetailsShown } = details
    const { closed: detailsClosed } = details
    const topStack = stack.topOpen
    const fallbackStackX = useSharedValue(width)
    const hasStack = topStack !== undefined
    const stackX = topStack?.x ?? fallbackStackX
    const setStackShown = (show: boolean) => {
        if (topStack) stack.setEntryShown(topStack.key, show)
    }
    const stackClosed = () => {
        if (topStack) stack.closed(topStack.key)
    }
    const {
        x: createX,
        setShown: setCreateShown,
        closed: createClosed,
    } = create
    // What a drag moves, decided when it starts: the chat panel, the stacked chat over it, or the details.
    const dragsDetails = useSharedValue(false)
    const dragsStack = useSharedValue(false)
    const dragsCreate = useSharedValue(false)
    const pan = usePanGesture({
        enabled: enabled && !details.open && !waitingForRows && !stack.waiting,
        activeOffsetX: [
            open && !detailsOnSwipe ? -width : -PANEL_TOUCH_SLOP,
            PANEL_TOUCH_SLOP,
        ],
        failOffsetY: [-PANEL_TOUCH_SLOP, PANEL_TOUCH_SLOP],
        onActivate: event => {
            dragging.set(true)
            dragsDetails.set(
                detailsOnSwipe &&
                    translateX.get() === 0 &&
                    createX.get() === width &&
                    event.translationX < 0,
            )
            dragsCreate.set(!dragsDetails.get() && createX.get() < width)
            dragsStack.set(
                !dragsDetails.get() &&
                    !dragsCreate.get() &&
                    hasStack &&
                    stackX.get() < width,
            )
        },
        onFinalize: () => {
            dragging.set(false)
        },
        onUpdate: event => {
            const target = dragsDetails.get()
                ? detailsX
                : dragsCreate.get()
                  ? createX
                  : dragsStack.get()
                    ? stackX
                    : translateX
            const position = target.get()
            // MainTabsChannelScreenStack: drag the frame while content loads.
            target.set(Math.max(0, Math.min(width, position + event.changeX)))
        },
        onDeactivate: event => {
            // A canceled drag: the system took the touch (its back gesture starts at the screen edge), so put the
            // panel back where it was. Committing here closed the chat and its composer, so the back event that
            // follows found no handler left and left the app.
            if (dragsDetails.get()) {
                const show = shouldShow(event, detailsX.get(), width, false)
                // Blurs the native input and closes its panels once the drag commits. A module-level
                // function: objects captured by the worklet (Keyboard, the composer) do not reach the UI runtime.
                if (show) scheduleOnRN(dismissComposers)
                settle(detailsX, width, show, setDetailsShown, detailsClosed)
                return
            }
            if (dragsCreate.get()) {
                const show = shouldShow(event, createX.get(), width, true)
                if (!show) scheduleOnRN(dismissComposers)
                settle(createX, width, show, setCreateShown, createClosed)
                return
            }
            if (dragsStack.get()) {
                const show = shouldShow(event, stackX.get(), width, true)
                if (!show) scheduleOnRN(dismissComposers)
                settle(stackX, width, show, setStackShown, stackClosed)
                return
            }
            const show = shouldShow(event, translateX.get(), width, open)
            if (show && !open && !drawn && channelId) {
                scheduleOnRN(openFromSwipe, channelId)
                return
            }
            if (open && !show) scheduleOnRN(dismissComposers)
            scheduleOnRN(setOpen, show)
            slideTo(translateX, width, show, true)
        },
    })
    // Closes the details by a drag from the left edge.
    const closePan = usePanGesture({
        enabled: details.open,
        hitSlop: { left: 0, width: DETAILS_CLOSE_EDGE },
        activeOffsetX: [-width, PANEL_TOUCH_SLOP],
        failOffsetY: [-PANEL_TOUCH_SLOP, PANEL_TOUCH_SLOP],
        onActivate: () => {
            dragging.set(true)
        },
        onFinalize: () => {
            dragging.set(false)
        },
        onUpdate: event => {
            detailsX.set(
                Math.max(0, Math.min(width, detailsX.get() + event.changeX)),
            )
        },
        onDeactivate: event => {
            // Canceled: the system back gesture took the edge touch. Its back event closes the details.
            const show = shouldShow(event, detailsX.get(), width, true)
            settle(detailsX, width, show, setDetailsShown, detailsClosed)
        },
    })
    return { pan, closePan }
}
