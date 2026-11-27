import { NitroModules } from 'react-native-nitro-modules'
import type { IsocordTrace } from './specs/IsocordTrace.nitro'

export type { IsocordTrace }

export default NitroModules.createHybridObject<IsocordTrace>('IsocordTrace')
