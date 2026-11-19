import { TurboModuleRegistry } from 'react-native'
import type { TurboModule } from 'react-native'

/** The app's own font scale on top of the system one (FontScaleModule in FontScale.kt). */
export interface Spec extends TurboModule {
    /** The saved scale, 1 by default. */
    getCustomFontScale(): number
    /** Saves the scale and restarts the app with it. */
    setCustomFontScale(scale: number): void
}

export default TurboModuleRegistry.getEnforcing<Spec>('IsocordFontScale')
