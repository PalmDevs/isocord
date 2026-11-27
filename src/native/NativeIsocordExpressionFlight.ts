import { Platform, TurboModuleRegistry } from 'react-native'
import type { TurboModule } from 'react-native'

/** Coordinates shared-element flights from expression pickers to ChatView (ExpressionFlightModule.kt). */
export interface Spec extends TurboModule {
    /** Binds a staged picker tile (`flightId`) to a pending chat message `nonce`, starting the flight. */
    bind(flightId: string, nonce: string): void
}

export default Platform.OS === 'android'
    ? TurboModuleRegistry.getEnforcing<Spec>('IsocordExpressionFlight')
    : null
