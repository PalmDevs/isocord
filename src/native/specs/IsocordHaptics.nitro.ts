import type { HybridObject } from 'react-native-nitro-modules'

/** Haptic feedback through the vibrator (HybridIsocordHaptics.kt). */
export interface IsocordHaptics extends HybridObject<{ android: 'kotlin' }> {
    /** HapticUtils' IMPACT_MEDIUM: `effectTick` on Android 10 and later, `impactLight` below. */
    impactMedium(): void
}
