import { withTiming } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import {
    DECELERATED_EASING,
    PANEL_CLOSE_MS,
    PANEL_OPEN_MS,
    STANDARD_EASING,
} from '../../../design/tokens/motion'
import type { SharedValue } from 'react-native-reanimated'

// Panel timings of the reference client on Android (modules/panels/native/PanelsConfig.tsx).
/** How long opening a chat waits for its native list to draw before sliding in anyway. */
export const DRAW_TIMEOUT_MS = 150

/** Slides a panel in (`show`) or out, calling `onEnd` on the JS thread once it finished. */
export function slideTo(
    x: SharedValue<number>,
    width: number,
    show: boolean,
    swipe: boolean,
    onEnd?: () => void,
) {
    'worklet'
    x.set(
        withTiming(
            show ? 0 : width,
            {
                duration: show ? PANEL_OPEN_MS : PANEL_CLOSE_MS,
                easing: swipe ? DECELERATED_EASING : STANDARD_EASING,
            },
            finished => {
                'worklet'
                if (finished && onEnd) scheduleOnRN(onEnd)
            },
        ),
    )
}
