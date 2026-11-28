import { useEffect, useEffectEvent } from 'react'
import {
    interpolate,
    useReducedMotion,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { MODAL_HIDDEN, MODAL_SPRING } from '../../../../design/tokens/motion'
import type { SharedValue } from 'react-native-reanimated'

export interface CardPresence {
    /** 0 hidden like a closed alert, 1 shown. */
    shown: SharedValue<number>
    /** How far a finger has pulled the pre-join card down, in px. */
    drag: SharedValue<number>
}

/**
 * Returns the card's presence. It enters on mount and leaves while `closing`, as AlertPile's cards do (MODAL_SPRING
 * between shown and MODAL_HIDDEN). `onExited` runs once it has left. Reduced motion skips the springs, as AlertPile
 * does.
 */
export function useCardPresence(
    closing: boolean,
    onExited?: () => void,
): CardPresence {
    const reducedMotion = useReducedMotion()
    const shown = useSharedValue(0)
    const drag = useSharedValue(0)
    const exited = useEffectEvent(() => onExited?.())
    useEffect(() => {
        const done = () => exited()
        if (reducedMotion) {
            shown.set(closing ? 0 : 1)
            drag.set(0)
            if (closing) done()
            return
        }
        if (!closing) {
            shown.set(withSpring(1, MODAL_SPRING))
            drag.set(withSpring(0, MODAL_SPRING))
            return
        }
        shown.set(
            withSpring(0, MODAL_SPRING, finished => {
                'worklet'
                if (finished) scheduleOnRN(done)
            }),
        )
    }, [shown, drag, reducedMotion, closing])
    return { shown, drag }
}

/** Returns AlertPile's fade, scale and drop for `presence`, for the card's style. */
export function presenceStyle({ shown }: CardPresence) {
    'worklet'
    const progress = shown.get()
    return {
        opacity: interpolate(progress, [0, 1], [MODAL_HIDDEN.opacity, 1]),
        scale: interpolate(progress, [0, 1], [MODAL_HIDDEN.scale, 1]),
        translateY: interpolate(progress, [0, 1], [MODAL_HIDDEN.translateY, 0]),
    }
}
