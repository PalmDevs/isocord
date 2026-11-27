import type { HybridObject } from 'react-native-nitro-modules'

/** The app's own font scale on top of the system one (HybridIsocordFontScale.kt). */
export interface IsocordFontScale extends HybridObject<{ android: 'kotlin' }> {
    /** The saved scale, 1 by default. */
    getCustomFontScale(): number
    /** Saves the scale and restarts the app with it. */
    setCustomFontScale(scale: number): void
}
