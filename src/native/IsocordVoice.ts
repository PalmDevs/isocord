import { Platform } from 'react-native'
import { NitroModules } from 'react-native-nitro-modules'
import type { IsocordVoice, VoiceConstants } from './specs/IsocordVoice.nitro'

export type { IsocordVoice, VoiceConstants }

export default Platform.OS === 'android'
    ? NitroModules.createHybridObject<IsocordVoice>('IsocordVoice')
    : null
