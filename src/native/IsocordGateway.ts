import { NitroModules } from 'react-native-nitro-modules'
import type { IsocordGateway } from './specs/IsocordGateway.nitro'

export type { IsocordGateway }

export default NitroModules.createHybridObject<IsocordGateway>('IsocordGateway')
