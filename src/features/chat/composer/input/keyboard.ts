import { useEffect } from 'react'
import { BackHandler, Keyboard } from 'react-native'
import { KeyboardEvents } from 'react-native-keyboard-controller'
import { deviceStorage } from '../../../../core/storage'
import { onDismissKeyboard } from '../../../../design/components/keyboard'
import type { LocalStore } from '../state/ComposerContext'
import type { ComposerInput } from './nativeInput'

const KEYBOARD_HEIGHT_KEY = 'keyboardHeight'
/** The reference's KeyboardUIStore: 253 until a keyboard has been seen. The panel's floor is in useKeyboardAreaMotion. */
const DEFAULT_KEYBOARD_HEIGHT = 253

/**
 * Resets of every mounted composer, so code outside the chat (the panels' swipe-away) can put them back to rest.
 * Mounted views, not account data: each removes itself on unmount.
 */
const resetters = new Set<() => void>()

/**
 * Puts every composer back to its plain state: the input loses focus (the keyboard goes), and the custom keyboard
 * panel and media row close. A plain module-level function so a gesture worklet can hand it to `scheduleOnRN`.
 */
export function dismissComposers(): void {
    for (const reset of resetters) reset()
}

/** The keyboard's last known height (dp), kept across launches so a panel can open before any keyboard has. */
export function lastKeyboardHeight(): number {
    return (
        deviceStorage.getNumber(KEYBOARD_HEIGHT_KEY) ?? DEFAULT_KEYBOARD_HEIGHT
    )
}

/**
 * Keyboard bookkeeping: its height is remembered for the panel area, and a keyboard that comes up replaces an open
 * panel.
 */
export function useKeyboardTracking(store: LocalStore): void {
    useEffect(() => {
        const subscriptions = [
            KeyboardEvents.addListener('keyboardWillShow', event =>
                store.setState(state => ({
                    keyboardOpen: true,
                    keyboardHeight:
                        event.height > 0 ? event.height : state.keyboardHeight,
                })),
            ),
            KeyboardEvents.addListener('keyboardDidShow', event => {
                const nextHeight = event.height > 0 ? event.height : undefined
                if (nextHeight !== undefined)
                    deviceStorage.set(KEYBOARD_HEIGHT_KEY, nextHeight)
                // The keyboard replaces a panel, unless it came up for a field inside the panel.
                store.setState(state => ({
                    keyboardOpen: true,
                    awaitingKeyboard: false,
                    keyboardHeight: nextHeight ?? state.keyboardHeight,
                    panel: state.panelTyping ? state.panel : null,
                }))
            }),
            KeyboardEvents.addListener('keyboardDidHide', () =>
                store.setState({ keyboardOpen: false }),
            ),
        ]
        return () => {
            for (const subscription of subscriptions) subscription.remove()
        }
    }, [store])
}

/** Swiping the chat away or leaving it blurs the input (Keyboard.dismiss does not know the native input). */
export function useDismissal(store: LocalStore, input: ComposerInput): void {
    useEffect(() => {
        const reset = () => {
            store.setState({
                panel: null,
                panelTyping: false,
                awaitingKeyboard: false,
                mediaRowOpen: false,
            })
            input.blur()
            // A field of the panel (its search) may hold the keyboard instead.
            Keyboard.dismiss()
        }
        resetters.add(reset)
        // An overlay opening hides the keyboard: the native input loses focus, a custom panel stays.
        const removeBlur = onDismissKeyboard(input.blur)
        return () => {
            resetters.delete(reset)
            removeBlur()
        }
    }, [store, input])
}

/** Back closes an open panel before it leaves the chat. */
export function useBackClosesPanel(store: LocalStore, open: boolean): void {
    useEffect(() => {
        if (!open) return
        const subscription = BackHandler.addEventListener(
            'hardwareBackPress',
            () => {
                store.setState({
                    panel: null,
                    panelTyping: false,
                    awaitingKeyboard: false,
                })
                return true
            },
        )
        return () => subscription.remove()
    }, [open, store])
}
