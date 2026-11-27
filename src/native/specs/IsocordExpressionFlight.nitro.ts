import type { HybridObject } from 'react-native-nitro-modules'

/** Coordinates shared-element flights from expression pickers to ChatView (HybridIsocordExpressionFlight.kt). */
export interface IsocordExpressionFlight
    extends HybridObject<{ android: 'kotlin' }> {
    /** Binds a staged picker tile (`flightId`) to a pending chat message `nonce`, starting the flight. */
    bind(flightId: string, nonce: string): void
}
