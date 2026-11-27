import { Platform } from 'react-native'
import { NitroModules } from 'react-native-nitro-modules'
import type { IsocordExpressionFlight } from './specs/IsocordExpressionFlight.nitro'

export type { IsocordExpressionFlight }

export default Platform.OS === 'android'
    ? NitroModules.createHybridObject<IsocordExpressionFlight>(
          'IsocordExpressionFlight',
      )
    : null
