import overlayNative from '../../../native/IsocordVoiceOverlay'
import { panelRequestStore } from '../panel/panelRequest'
import { rtcStore } from '../rtc'
import { setVoiceSetting, voiceSettingsStore } from '../settings/voiceSettings'
import type { Session } from '../../../core/session'

/**
 * MobileVoiceOverlayLifecycleManager: tells native the setting and the call's channel, and native shows the bubble
 * while the app is in the background. The reference asks for the permission again at start when it was revoked.
 * Isocord turns the setting off instead. Returns the cleanup.
 */
export function syncVoiceOverlay(session: Session): () => void {
    if (
        voiceSettingsStore.getState().mobileOverlay &&
        !overlayNative.canDrawOverlays()
    )
        setVoiceSetting('mobileOverlay', false)
    const rtc = session.get(rtcStore)
    overlayNative.setEnabled(voiceSettingsStore.getState().mobileOverlay)
    overlayNative.setChannel(rtc.getState().channelId ?? undefined)
    const offs = [
        voiceSettingsStore.subscribe((state, previous) => {
            if (state.mobileOverlay !== previous.mobileOverlay)
                overlayNative.setEnabled(state.mobileOverlay)
        }),
        rtc.subscribe((state, previous) => {
            if (state.channelId === previous.channelId) return
            overlayNative.setChannel(state.channelId ?? undefined)
            // A panel asked for by a call that ended opens nothing.
            if (!state.channelId)
                session.get(panelRequestStore).setState({ requested: false })
        }),
    ]
    return () => {
        for (const off of offs) off()
        overlayNative.setChannel(undefined)
    }
}

/**
 * Turns the overlay on once drawing over apps is allowed (handleOverlayEnable). A refusal leaves it off. Turning it
 * off needs nothing.
 */
export function setMobileOverlay(on: boolean): void {
    if (!on) {
        setVoiceSetting('mobileOverlay', false)
        return
    }
    void overlayNative
        .requestPermission()
        .then(granted => setVoiceSetting('mobileOverlay', granted))
        .catch(() => setVoiceSetting('mobileOverlay', false))
}
