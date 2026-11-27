import { useEffect, useRef } from 'react'
import { useWindowDimensions } from 'react-native'
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller'
import { useAnimatedStyle, useSharedValue } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { scheduleOnRN } from 'react-native-worklets'
import { animateTo } from './usePanelSheet'
import type { LocalStore } from '../state/ComposerContext'
import type { PanelSheet } from './usePanelSheet'

/** Space between the input's card and the keyboard or panel under it. */
const KEYBOARD_GAP = 8
/** NAV_BAR_HEIGHT_MULTILINE: an expanded sheet stops this far below the status bar. */
const TOP_GAP = 56
/** KeyboardUIStore's floor: a panel is never shorter than this, even over a shorter IME. */
const PANEL_MIN_HEIGHT = 200

/** Returns the room a keyboard or panel of `height` takes under the input: the gap grows in with it. */
function room(height: number) {
    'worklet'
    return height + Math.min(KEYBOARD_GAP, height)
}

/**
 * useKeyboardActionSheetHeight: returns the sheet's snap points.
 * `min` is the IME's height, at least PANEL_MIN_HEIGHT. A tall one leaves TOP_GAP to expand into.
 * `max` is the window less the status bar and TOP_GAP.
 */
export function useSheetBounds(imeHeight: number) {
    const insets = useSafeAreaInsets()
    const { height: windowHeight } = useWindowDimensions()
    const max = Math.max(0, windowHeight - insets.top - TOP_GAP)
    const rest = Math.max(imeHeight, PANEL_MIN_HEIGHT)
    const min = rest >= max ? Math.max(0, max - TOP_GAP) : rest
    return { min, max }
}

/**
 * Drives the sheet and the room under the input through the panel's transitions.
 * Two heights meet here: the panel's (`sheet.min`) and the IME's (live, or `keyboardHeight` while it opens).
 * The room is the larger of the IME's, the sheet's (up to `min`) and `handoff`, which holds a closing panel's room
 * until the IME it hands over to has opened. Returns the room's animated style.
 */
export function useKeyboardAreaMotion({
    store,
    sheet,
    bottomOffset,
    expanded,
    onClosed,
}: {
    store: LocalStore
    sheet: PanelSheet
    bottomOffset: number
    expanded: boolean
    onClosed: () => void
}) {
    const keyboard = useReanimatedKeyboardAnimation()
    const handoff = useSharedValue(0)
    const { height, closingFrom, min } = sheet

    // Runs inside the setState that changes the panel, before the native input hides or shows the IME.
    useEffect(
        () =>
            store.subscribe((state, previous) => {
                if (state.panel !== previous.panel) {
                    if (state.panel === null) {
                        // Slides away whole from where it was, without re-layout.
                        closingFrom.set(Math.max(min, height.get()))
                        if (state.awaitingKeyboard) {
                            handoff.set(room(Math.min(height.get(), min)))
                            animateTo(handoff, room(state.keyboardHeight))
                        }
                        animateTo(height, 0, 0, finished => {
                            'worklet'
                            if (finished) scheduleOnRN(onClosed)
                        })
                    } else {
                        closingFrom.set(0)
                        // Takes the IME's room at once, so the input stays put while the IME hides.
                        const ime = -keyboard.height.get()
                        if (
                            previous.panel === null &&
                            previous.keyboardOpen &&
                            ime > 1
                        )
                            height.set(ime)
                        animateTo(height, min)
                    }
                }
                if (!state.awaitingKeyboard) {
                    // The IME holds the room from here (the larger one wins), or none is coming.
                    if (previous.awaitingKeyboard) animateTo(handoff, 0)
                } else if (state.keyboardHeight !== previous.keyboardHeight) {
                    // The opening IME told its real height.
                    animateTo(handoff, room(state.keyboardHeight))
                }
            }),
        [store, min, height, closingFrom, handoff, keyboard.height, onClosed],
    )

    // An open sheet at rest follows `min` (an IME of another height). An expanded one stays.
    const expandedNow = useRef(expanded)
    expandedNow.current = expanded
    useEffect(() => {
        if (store.getState().panel !== null && !expandedNow.current)
            animateTo(height, min)
    }, [store, min, height])

    return useAnimatedStyle(() => {
        const ime = Math.max(0, -keyboard.height.get())
        const panel = Math.min(height.get(), min)
        return {
            height: Math.max(
                room(ime),
                room(panel),
                handoff.get(),
                bottomOffset,
            ),
        }
    })
}
