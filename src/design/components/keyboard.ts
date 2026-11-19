import { Keyboard } from 'react-native'

const blurs = new Set<() => void>()

/**
 * Hides the keyboard before an overlay (sheet, alert, menu) opens over the screen. `Keyboard.dismiss` only knows
 * React Native's own inputs; native ones (the chat input) register their blur with `onDismissKeyboard`.
 */
export function dismissKeyboard(): void {
    Keyboard.dismiss()
    for (const blur of blurs) blur()
}

/** Adds a native input's blur to `dismissKeyboard`; returns the removal. */
export function onDismissKeyboard(blur: () => void): () => void {
    blurs.add(blur)
    return () => {
        blurs.delete(blur)
    }
}
