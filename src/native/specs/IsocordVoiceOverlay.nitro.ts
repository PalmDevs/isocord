import type { HybridObject } from 'react-native-nitro-modules'

/** Values the call bubble's native side owns (HybridIsocordVoiceOverlay.kt). */
export interface VoiceOverlayConstants {
    /** The bubble's React root, for AppRegistry. */
    componentName: string
    /** The PIP's least distance from the screen's edges and bars, dp. The bubble keeps it too. */
    pipWindowOffset: number
}

/**
 * The call bubble over other apps (HybridIsocordVoiceOverlay.kt, reference MobileVoiceOverlayModule). Native shows it
 * while the setting is on, a call runs and the app is in the background, and moves it. The bubble's contents are the
 * React root named `componentName`.
 */
export interface IsocordVoiceOverlay
    extends HybridObject<{ android: 'kotlin' }> {
    getConstants(): VoiceOverlayConstants
    /** The overlay setting. */
    setEnabled(enabled: boolean): void
    /** The call's channel, or undefined without one. A bubble dropped in the trash stays away until it changes. */
    setChannel(channelId: string | undefined): void
    /** Whether the user allows drawing over other apps. */
    canDrawOverlays(): boolean
    /** Resolves true once drawing over apps is allowed. Opens the system page for it first when it is not. */
    requestPermission(): Promise<boolean>
    /** Brings the app to the front. */
    openApp(): void
}
