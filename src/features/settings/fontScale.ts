import { createStore } from 'zustand/vanilla'
import native from '../../native/NativeIsocordFontScale'

/** UserSettingsConstants' FontScales: the zoom levels the slider steps through. */
export const FONT_SCALES = [0.75, 0.875, 0.9375, 1, 1.125, 1.25, 1.5, 1.75, 2]

interface FontScaleState {
    /** The saved scale, applied natively since launch. */
    persistedFontScale: number
    /** The scale picked on the slider, applied once saved. */
    fontScale: number
}

const persisted = native.getCustomFontScale()

/** DEFAULT_FONT_SCALE_STORE_STATE: leaving the Appearance screen drops an unsaved pick. */
export const DEFAULT_FONT_SCALE_STATE: FontScaleState = {
    persistedFontScale: persisted,
    fontScale: persisted,
}

/** FontScaleStore. */
export const fontScaleStore = createStore<FontScaleState>(
    () => DEFAULT_FONT_SCALE_STATE,
)

/** NativeFontModule.setCustomFontScale: saves the scale and restarts the app with it. */
export function saveFontScale(scale: number) {
    native.setCustomFontScale(scale)
}
