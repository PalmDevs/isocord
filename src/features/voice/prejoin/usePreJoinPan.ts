import { usePanGesture } from 'react-native-gesture-handler'
import { useSharedValue, withSpring } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { DOCK_MODE_SPRING } from '../../../design/tokens/motion'
import { DOCK_TRANSITION_VELOCITY } from '../panel/dock/dockConstants'
import { useDecideOverList } from '../panel/dock/useDockPan'
import type { SharedValue } from 'react-native-reanimated'
import type { CardPresence } from '../panel/dock/useCardPresence'

/** A release dragged past this share of the card's height dismisses it. */
const DISMISS_FRACTION = 0.5

export interface PreJoinPanOptions {
    /** The card's measured height. */
    cardHeight: number
    onDismiss: () => void
    /** Set around the scrolling list, as `useDockPan`'s: it drags only down from the list's top. */
    scrollAtTop?: SharedValue<boolean>
}

/**
 * Returns the pan that pulls the pre-join card down. It never grows: a drag up does nothing. A fast swipe down
 * (QuestDock's transition velocity) or a drag past half its height dismisses it. Anything else springs it back.
 */
export function usePreJoinPan(
    { drag }: CardPresence,
    { cardHeight, onDismiss, scrollAtTop }: PreJoinPanOptions,
) {
    const startY = useSharedValue(0)
    const driving = useSharedValue(false)
    const decide = useDecideOverList(undefined, scrollAtTop)
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
            startY.set(event.absoluteY - drag.get())
        },
        onUpdate: event => {
            'worklet'
            drag.set(Math.max(0, event.absoluteY - startY.get()))
        },
        onDeactivate: event => {
            'worklet'
            driving.set(false)
            const dismisses =
                event.velocityY > DOCK_TRANSITION_VELOCITY ||
                drag.get() > cardHeight * DISMISS_FRACTION
            if (dismisses) scheduleOnRN(onDismiss)
            else drag.set(withSpring(0, DOCK_MODE_SPRING))
        },
        // A drag that was cancelled halfway springs back.
        onFinalize: () => {
            'worklet'
            if (!driving.get()) return
            driving.set(false)
            drag.set(withSpring(0, DOCK_MODE_SPRING))
        },
    })
}
