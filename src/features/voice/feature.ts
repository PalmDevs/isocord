import native from '../../native/IsocordVoice'
import { leave } from './actions'
import { registerGatewayHandlers } from './gatewayEvents'
import { listenToVoiceEvents } from './nativeEvents'
import { syncVoiceOverlay } from './overlay/overlayLifecycle'
import { panelRequestStore } from './panel/panelRequest'
import { preJoinStore } from './prejoin/preJoinStore'
import { streamPreviewsStore } from './prejoin/streamPreviews'
import { rtcStore } from './rtc'
import { registerVoiceSettings } from './settings/applyVoiceSettings'
import { registerSinkWants, sinkStore } from './sinkWants'
import { streamsStore } from './streams'
import { VoiceOverlay } from './VoiceOverlay'
import type { Feature } from '../../core/feature'

/**
 * Voice, video and Go Live. The gateway side is here (ops 4 and 18 to 20, voice states, voice and stream servers),
 * and the media is native (`IsocordVoice`). docs/voice.md describes the split.
 */
export const voiceFeature: Feature = {
    name: 'voice',
    stores: [
        rtcStore,
        streamsStore,
        sinkStore,
        preJoinStore,
        streamPreviewsStore,
        panelRequestStore,
    ],
    setup: session => {
        if (!native) return undefined
        const offGateway = registerGatewayHandlers(session)
        const offNative = listenToVoiceEvents(session)
        const offSinkWants = registerSinkWants(session)
        const offSettings = registerVoiceSettings(session)
        const offOverlay = syncVoiceOverlay(session)
        return () => {
            // An account switch or logout leaves the call first.
            leave(session, true)
            offGateway()
            offNative()
            offSinkWants()
            offSettings()
            offOverlay()
        }
    },
    overlays: { voice: VoiceOverlay },
}
