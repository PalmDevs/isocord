import { NitroModules } from 'react-native-nitro-modules'
import type { IsocordVoiceOverlay } from './specs/IsocordVoiceOverlay.nitro'

export type { IsocordVoiceOverlay }

const voiceOverlay = NitroModules.createHybridObject<IsocordVoiceOverlay>(
    'IsocordVoiceOverlay',
)

export default voiceOverlay

export const { componentName, pipWindowOffset } = voiceOverlay.getConstants()
