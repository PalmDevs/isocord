import { Platform } from 'react-native'
import { NitroModules } from 'react-native-nitro-modules'
import type { BackPreviewFrame, IsocordBack } from './specs/IsocordBack.nitro'

export type { BackPreviewFrame, IsocordBack }

export default Platform.OS === 'android'
    ? NitroModules.createHybridObject<IsocordBack>('IsocordBack')
    : null
