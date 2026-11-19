import { TurboModuleRegistry } from 'react-native'
import type { TurboModule } from 'react-native'

/** The launch splash (StartupModule.kt). */
export interface Spec extends TurboModule {
    /** Dismisses the splash once the real UI is on screen. */
    hideSplash(): void
}

export default TurboModuleRegistry.getEnforcing<Spec>('IsocordStartup')
