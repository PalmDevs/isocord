import { NitroModules } from 'react-native-nitro-modules'
import type { IsocordNotifications } from './specs/IsocordNotifications.nitro'

export type { IsocordNotifications }

export default NitroModules.createHybridObject<IsocordNotifications>(
    'IsocordNotifications',
)
